from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization, User
)
from apps.finance.models import FinancialAccount, ChartOfAccount
from apps.finance.serializers import FinancialAccountSerializer, ChartOfAccountSerializer
from apps.finance.services import FinancialAccountService, LedgerService

class FinancialAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FinancialAccount.objects.select_related('ledger_account').all()
    serializer_class = FinancialAccountSerializer

    # Permission code → account type mapping
    PERM_TYPE_MAP = {
        'finance.account.cash': 'CASH',
        'finance.account.bank': 'BANK',
        'finance.account.mobile': 'MOBILE',
        'finance.account.petty_cash': 'PETTY_CASH',
        'finance.account.savings': 'SAVINGS',
        'finance.account.foreign': 'FOREIGN',
        'finance.account.escrow': 'ESCROW',
        'finance.account.investment': 'INVESTMENT',
    }

    def _user_has_permission(self, user, code):
        """Check if user's role includes a specific permission code."""
        if user.is_superuser:
            return True
        if not hasattr(user, 'role') or not user.role:
            return False
        return user.role.permissions.filter(code=code).exists()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Superusers and users with finance.account.all bypass type filtering
        if user.is_superuser or self._user_has_permission(user, 'finance.account.all'):
            return qs

        # No role = no accounts (except assigned cash register)
        if not hasattr(user, 'role') or not user.role:
            if user.cash_register_id:
                return qs.filter(id=user.cash_register_id)
            return qs.none()

        # Get user's permitted account types from their role's permissions
        user_perms = set(user.role.permissions.values_list('code', flat=True))
        allowed_types = [
            acct_type for perm_code, acct_type in self.PERM_TYPE_MAP.items()
            if perm_code in user_perms
        ]

        if not allowed_types:
            # Fallback: show only assigned cash register
            if user.cash_register_id:
                return qs.filter(id=user.cash_register_id)
            return qs.none()

        return qs.filter(type__in=allowed_types)

    def create(self, request, *args, **kwargs):
        # Gate account creation behind finance.account.manage permission
        if not self._user_has_permission(request.user, 'finance.account.manage'):
            return Response({"error": "Permission denied: finance.account.manage required"}, status=status.HTTP_403_FORBIDDEN)

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            from apps.finance.models import ChartOfAccount
            from erp.services import ConfigurationService
            from decimal import Decimal
            from django.db import transaction as db_transaction
            
            name = request.data.get('name')
            acct_type = request.data.get('type')
            currency = request.data.get('currency', 'USD')
            site_id = request.data.get('site_id')
            is_pos_enabled = request.data.get('is_pos_enabled', False)
            
            if not name or not acct_type:
                return Response({"error": "name and type are required"}, status=status.HTTP_400_BAD_REQUEST)

            # ─── STEP 1: Resolve parent COA ───────────────────────────────
            # Priority: explicit request param > posting rules > sub_type match
            parent_coa_id = request.data.get('ledger_account') or request.data.get('parent_coa_id')
            parent_coa = None

            if parent_coa_id:
                # Explicit parent provided — validate it
                parent_coa = ChartOfAccount.objects.filter(
                    id=parent_coa_id, organization=organization
                ).first()
                if not parent_coa:
                    return Response(
                        {"error": f"Selected parent COA (id={parent_coa_id}) not found in this organization."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                # Resolve from posting rules based on account type (NO hardcoded codes)
                rules = ConfigurationService.get_posting_rules(organization)

                # Map account types to posting-rule keys (section, key)
                ACCOUNT_TYPE_TO_RULE = {
                    'CASH':       [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'PETTY_CASH': [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'MOBILE':     [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'BANK':       [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'SAVINGS':    [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'FOREIGN':    [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'ESCROW':     [('automation', 'customerRoot'), ('sales', 'receivable')],
                    'INVESTMENT': [('automation', 'customerRoot'), ('sales', 'receivable')],
                }

                rule_chain = ACCOUNT_TYPE_TO_RULE.get(acct_type, [])
                for rule_section, rule_key in rule_chain:
                    parent_id_from_rules = rules.get(rule_section, {}).get(rule_key)
                    if parent_id_from_rules:
                        parent_coa = ChartOfAccount.objects.filter(
                            id=parent_id_from_rules, organization=organization
                        ).first()
                        if parent_coa:
                            break

                # Last resort: match by sub_type
                if not parent_coa:
                    parent_coa = ChartOfAccount.objects.filter(
                        organization=organization, sub_type=acct_type
                    ).first()

            # ─── GUARD: No parent = no account ────────────────────────────
            if not parent_coa:
                return Response(
                    {"error": f"Cannot create account: no parent COA found for type '{acct_type}'. "
                              f"Please configure your Chart of Accounts and posting rules first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ─── STEP 2: Validate POS constraint ─────────────────────────
            if is_pos_enabled and parent_coa.type not in ('ASSET',):
                return Response(
                    {"error": f"POS accounts must be linked to ASSET-type COA entries, not '{parent_coa.type}'. "
                              f"Please select a Cash, Bank, or similar asset account."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ─── STEP 3: Create child COA + Financial Account (atomic) ───
            with db_transaction.atomic():
                last_child = ChartOfAccount.objects.filter(
                    organization=organization,
                    code__startswith=f"{parent_coa.code}."
                ).order_by('-code').first()
                
                suffix = (int(last_child.code.split('.')[-1]) + 1) if last_child else 1
                child_code = f"{parent_coa.code}.{str(suffix).zfill(3)}"
                
                child_coa = ChartOfAccount.objects.create(
                    organization=organization,
                    code=child_code,
                    name=name,
                    type=parent_coa.type,
                    sub_type=acct_type,
                    parent=parent_coa,
                    is_system_only=True,
                    is_active=True,
                    balance=Decimal('0.00')
                )
                
                account = FinancialAccount.objects.create(
                    organization=organization,
                    name=name,
                    type=acct_type,
                    currency=currency,
                    site_id=site_id,
                    is_pos_enabled=is_pos_enabled,
                    ledger_account=child_coa
                )

            serializer = self.get_serializer(account)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def assign_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            user = User.objects.get(id=user_id, organization=organization)
            account = FinancialAccount.objects.get(id=pk, organization=organization)
            
            user.cash_register = account
            user.save()
            
            return Response({"message": "User assigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            user = User.objects.get(id=user_id, organization=organization)
            
            if user.cash_register_id == int(pk):
                user.cash_register = None
                user.save()
            
            return Response({"message": "User unassigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        if not self._user_has_permission(request.user, 'finance.account.manage'):
            return Response({"error": "Permission denied: finance.account.manage required"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ChartOfAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

    @action(detail=False, methods=['get'])
    def templates(self, request):
        from erp.coa_templates import TEMPLATES
        data = [{"key": k, "name": k.replace('_', ' ')} for k in TEMPLATES.keys()]
        return Response(data)

    @action(detail=False, methods=['get'])
    def coa(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response([], status=status.HTTP_200_OK)
        
        organization = Organization.objects.get(id=organization_id)
        
        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested
        
        include_inactive = request.query_params.get('include_inactive') == 'true'
        
        accounts = LedgerService.get_chart_of_accounts(organization, scope, include_inactive)
        
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "subType": acc.sub_type,
                "isActive": acc.is_active,
                "parentId": acc.parent_id,
                "syscohadaCode": acc.syscohada_code,
                "syscohadaClass": acc.syscohada_class,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance)
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        template_key = request.data.get('template_key')
        reset = request.data.get('reset', False)
        
        if not template_key:
            return Response({"error": "template_key is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            LedgerService.apply_coa_template(organization, template_key, reset)
            return Response({"message": "Template applied successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def migrate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        mappings = request.data.get('mappings', [])
        description = request.data.get('description', "COA Migration")
        
        if not mappings:
            return Response({"error": "Mappings are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            LedgerService.migrate_coa(organization, mappings, description)
            return Response({"message": "Migration completed successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def finalize_setup(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            from django.core.exceptions import ValidationError
            LedgerService.validate_finance_readiness(organization)
            return Response({"message": "Finance module activated successfully"})
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested
        
        result = LedgerService.get_account_statement(organization, pk, start_date, end_date, scope)
        
        from apps.finance.serializers import JournalEntryLineSerializer
        account_data = ChartOfAccountSerializer(result['account']).data
        lines_data = JournalEntryLineSerializer(result['lines'], many=True).data
        
        return Response({
            "account": account_data,
            "opening_balance": float(result['opening_balance']),
            "lines": lines_data
        })

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        as_of = request.query_params.get('as_of')
        
        # --- STRICT SCOPE ISOLATION ---
        from erp.middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        requested = (request.query_params.get('scope') or 'OFFICIAL').upper()
        if authorized == 'official' and requested == 'INTERNAL':
            requested = 'OFFICIAL'
        scope = requested
        
        accounts = LedgerService.get_trial_balance(organization, as_of, scope)
        
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance),
                "parent_id": acc.parent_id
            })
        return Response(data)
