"""
Financial Account ViewSets.

Hosts `FinancialAccountViewSet` (cash registers, bank accounts, etc.)
and `FinancialAccountCategoryViewSet`. Extracted from `account_views.py`
for the 300-line maintainability ceiling. Re-exported by
`account_views.py` so URL routing and external imports stay unchanged.
"""
from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization, User
)
from django.db import models
from apps.finance.models import FinancialAccount, FinancialAccountCategory
from apps.finance.serializers import (
    FinancialAccountSerializer, FinancialAccountCategorySerializer,
)


class FinancialAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FinancialAccount.objects.select_related('ledger_account', 'category').all()
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
            from decimal import Decimal
            from django.db import transaction as db_transaction

            name = request.data.get('name')
            acct_type = request.data.get('type')
            currency = request.data.get('currency', 'USD')
            site_id = request.data.get('site_id')
            is_pos_enabled = request.data.get('is_pos_enabled', False)
            description = request.data.get('description', '')

            # ── Link mode: 'direct' = link to existing node, 'sub_account' = create child first ──
            link_mode = request.data.get('link_mode', 'sub_account')

            if not name or not acct_type:
                return Response({"error": "name and type are required"}, status=status.HTTP_400_BAD_REQUEST)

            # ─── STEP 1: Resolve target COA node ──────────────────────────
            # Accept either 'ledger_account' (preferred) or legacy 'parent_coa_id'
            target_coa_id = request.data.get('ledger_account') or request.data.get('parent_coa_id')

            if not target_coa_id:
                return Response(
                    {"error": "ledger_account is required. Select a COA node from the Chart of Accounts."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            target_coa = ChartOfAccount.objects.filter(
                id=target_coa_id, organization=organization
            ).first()
            if not target_coa:
                return Response(
                    {"error": f"COA node (id={target_coa_id}) not found in this organization."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ─── Validate target COA ──────────────────────────────────────
            if not target_coa.is_active:
                return Response(
                    {"error": f"COA node '{target_coa.code} - {target_coa.name}' is inactive. Select an active node."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if hasattr(target_coa, 'is_structure_locked') and target_coa.is_structure_locked:
                if link_mode == 'sub_account':
                    return Response(
                        {"error": f"COA node '{target_coa.code}' is structure-locked. Cannot create sub-accounts under it."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # ─── POS constraint: must be ASSET-type ──────────────────────
            if is_pos_enabled and target_coa.type not in ('ASSET',):
                return Response(
                    {"error": f"POS accounts must be linked to ASSET-type COA entries, not '{target_coa.type}'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ─── STEP 2: Create based on link_mode ────────────────────────
            with db_transaction.atomic():
                if link_mode == 'direct':
                    # Mode 1: Link FinancialAccount directly to existing COA node
                    ledger_node = target_coa
                else:
                    # Mode 2 (default): Create dedicated child COA, then link
                    last_child = ChartOfAccount.objects.filter(
                        organization=organization,
                        code__startswith=f"{target_coa.code}."
                    ).order_by('-code').first()

                    suffix = (int(last_child.code.split('.')[-1]) + 1) if last_child else 1
                    child_code = f"{target_coa.code}.{str(suffix).zfill(3)}"

                    ledger_node = ChartOfAccount.objects.create(
                        organization=organization,
                        code=child_code,
                        name=name,
                        type=target_coa.type,
                        sub_type=acct_type,
                        parent=target_coa,
                        is_system_only=True,
                        is_active=True,
                        balance=Decimal('0.00')
                    )

                account = FinancialAccount.objects.create(
                    organization=organization,
                    name=name,
                    type=acct_type,
                    currency=currency,
                    description=description,
                    site_id=site_id,
                    is_pos_enabled=is_pos_enabled,
                    ledger_account=ledger_node
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

        instance = self.get_object()

        # ── Safeguard 1: Block if linked to an active POS register ──
        from apps.pos.models import POSRegister
        linked_registers = POSRegister.objects.filter(
            models.Q(cash_account=instance) |
            models.Q(reserve_account=instance) |
            models.Q(allowed_accounts=instance),
            is_active=True,
        ).distinct()

        if linked_registers.exists():
            names = ', '.join(r.name for r in linked_registers[:5])
            return Response(
                {"error": f'Cannot delete "{instance.name}" — it is linked to active register(s): {names}. Unlink or deactivate the register(s) first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Safeguard 2: Soft-deactivate if account has transactions ──
        from apps.finance.models import JournalEntryLine
        has_transactions = JournalEntryLine.objects.filter(
            financial_account=instance
        ).exists()

        if has_transactions:
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            return Response(
                {"message": f'Account "{instance.name}" has existing transactions and cannot be permanently deleted. It has been deactivated instead.'},
                status=status.HTTP_200_OK
            )

        # ── No links, no transactions → safe to hard-delete ──
        return super().destroy(request, *args, **kwargs)


class FinancialAccountCategoryViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FinancialAccountCategory.objects.select_related('coa_parent').all()
    serializer_class = FinancialAccountCategorySerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['organization'] = request.user.organization_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=request.user.organization)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.accounts.exists():
            return Response(
                {'error': f'Cannot delete category "{instance.name}" — it has {instance.accounts.count()} linked accounts. Move or delete them first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
