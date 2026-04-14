from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization, User
)
from django.db import models
from apps.finance.models import FinancialAccount, FinancialAccountCategory, ChartOfAccount
from apps.finance.serializers import FinancialAccountSerializer, FinancialAccountCategorySerializer, ChartOfAccountSerializer
from apps.finance.services import FinancialAccountService, LedgerService

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


class ChartOfAccountViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        """Return flat COA list with parent info for tree building."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response([], status=status.HTTP_200_OK)
        qs = ChartOfAccount.objects.filter(
            organization_id=org_id, is_active=True
        ).order_by('code').values(
            'id', 'code', 'name', 'type', 'sub_type', 'parent_id',
            'system_role', 'allow_posting', 'is_system_only',
            'class_code', 'normal_balance', 'balance',
        )
        return Response(list(qs))

    @action(detail=False, methods=['post'], url_path='create-node')
    def create_node(self, request):
        """Create a COA header node (sub-category) under a parent."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        parent_id = request.data.get('parent_id')
        name = request.data.get('name')
        if not parent_id or not name:
            return Response({"error": "parent_id and name are required"}, status=status.HTTP_400_BAD_REQUEST)

        parent = ChartOfAccount.objects.filter(id=parent_id, organization=organization).first()
        if not parent:
            return Response({"error": "Parent account not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate child code
        last_child = ChartOfAccount.objects.filter(
            organization=organization, code__startswith=f"{parent.code}."
        ).order_by('-code').first()
        suffix = (int(last_child.code.split('.')[-1]) + 1) if last_child else 1
        child_code = f"{parent.code}.{str(suffix).zfill(2)}"

        node = ChartOfAccount.objects.create(
            organization=organization,
            code=child_code,
            name=name,
            type=parent.type,
            sub_type=request.data.get('sub_type', parent.sub_type),
            normal_balance=parent.normal_balance,
            allow_posting=False,  # Header node — no direct postings
            parent=parent,
            is_active=True,
        )
        return Response({
            'id': node.id, 'code': node.code, 'name': node.name,
            'type': node.type, 'parent_id': node.parent_id,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Legacy endpoint — returns hardcoded template list."""
        from erp.coa_templates import TEMPLATES
        data = [{"key": k, "name": k.replace('_', ' ')} for k in TEMPLATES.keys()]
        return Response(data)

    # ═══════════════════════════════════════════════════════════════
    # Database-Backed COA Template Endpoints
    # ═══════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='db-templates')
    def db_templates(self, request):
        """List all available COA templates (system + org-custom)."""
        from apps.finance.models.coa_template import COATemplate
        organization_id = get_current_tenant_id()

        # System templates (org=NULL) + custom templates for this org
        qs = COATemplate.objects.filter(
            models.Q(is_system=True, organization__isnull=True) |
            models.Q(is_custom=True, organization_id=organization_id)
        ).order_by('is_custom', 'name')

        data = []
        for tpl in qs:
            data.append({
                'key': tpl.key,
                'name': tpl.name,
                'region': tpl.region,
                'description': tpl.description,
                'icon': tpl.icon,
                'accent_color': tpl.accent_color,
                'is_system': tpl.is_system,
                'is_custom': tpl.is_custom,
                'account_count': tpl.account_count,
                'posting_rule_count': tpl.posting_rules.count(),
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='db-templates/(?P<template_key>[\\w]+)')
    def db_template_detail(self, request, template_key=None):
        """Get full template detail with accounts from normalized model."""
        from apps.finance.models.coa_template import COATemplate, COATemplateAccount
        organization_id = get_current_tenant_id()

        tpl = COATemplate.objects.filter(
            models.Q(key=template_key, is_system=True, organization__isnull=True) |
            models.Q(key=template_key, is_custom=True, organization_id=organization_id)
        ).first()

        if not tpl:
            return Response({'error': f'Template {template_key} not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prefer normalized model, fallback to JSON
        norm_accounts = tpl.template_accounts.all()
        if norm_accounts.exists():
            accounts = [{
                'code': a.code, 'name': a.name, 'type': a.type,
                'sub_type': a.sub_type, 'system_role': a.system_role,
                'parent_code': a.parent_code, 'normal_balance': a.normal_balance,
                'posting_purpose': a.posting_purpose, 'business_domain': a.business_domain,
                'is_reconcilable': a.is_reconcilable, 'is_bank_account': a.is_bank_account,
                'is_tax_account': a.is_tax_account, 'normalized_name': a.normalized_name,
            } for a in norm_accounts]
        else:
            accounts = tpl.accounts

        return Response({
            'key': tpl.key, 'name': tpl.name, 'region': tpl.region,
            'description': tpl.description, 'icon': tpl.icon,
            'accent_color': tpl.accent_color, 'is_system': tpl.is_system,
            'is_custom': tpl.is_custom,
            'accounts': accounts, 'account_count': len(accounts),
        })

    @action(detail=False, methods=['get'], url_path='db-templates/(?P<template_key>[\\w]+)/posting-rules')
    def db_template_posting_rules(self, request, template_key=None):
        """Preview posting rules for a template BEFORE import."""
        from apps.finance.models.coa_template import COATemplate

        organization_id = get_current_tenant_id()
        tpl = COATemplate.objects.filter(
            models.Q(key=template_key, is_system=True, organization__isnull=True) |
            models.Q(key=template_key, is_custom=True, organization_id=organization_id)
        ).first()

        if not tpl:
            return Response({'error': f'Template {template_key} not found'}, status=status.HTTP_404_NOT_FOUND)

        rules = tpl.posting_rules.all().order_by('module', 'event_code')
        data = [{
            'event_code': r.event_code,
            'account_code': r.account_code,
            'module': r.module,
            'description': r.description,
        } for r in rules]

        return Response({
            'template_key': tpl.key,
            'template_name': tpl.name,
            'rules': data,
            'total': len(data),
        })

    @action(detail=False, methods=['post'], url_path='db-templates/create')
    def db_template_create(self, request):
        """Create a custom COA template for the current organization."""
        from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        key = request.data.get('key', '').strip().upper().replace(' ', '_')
        name = request.data.get('name', '').strip()

        if not key or not name:
            return Response({'error': 'key and name are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check uniqueness within this org
        if COATemplate.objects.filter(key=key, organization=organization).exists():
            return Response({'error': f'Template key {key} already exists'}, status=status.HTTP_400_BAD_REQUEST)

        tpl = COATemplate.objects.create(
            key=key,
            name=name,
            region=request.data.get('region', 'Custom'),
            description=request.data.get('description', ''),
            icon=request.data.get('icon', 'FileText'),
            accent_color=request.data.get('accent_color', 'var(--app-info)'),
            is_system=False,
            is_custom=True,
            organization=organization,
            accounts=request.data.get('accounts', []),
        )

        # Create posting rules if provided
        rules = request.data.get('posting_rules', [])
        if rules:
            rule_objects = [
                COATemplatePostingRule(
                    template=tpl,
                    event_code=r['event_code'],
                    account_code=r['account_code'],
                    description=r.get('description', ''),
                )
                for r in rules
            ]
            COATemplatePostingRule.objects.bulk_create(rule_objects)

        return Response({
            'key': tpl.key,
            'name': tpl.name,
            'account_count': tpl.account_count,
            'posting_rule_count': tpl.posting_rules.count(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['put'], url_path='db-templates/(?P<template_key>[\\w]+)/update')
    def db_template_update(self, request, template_key=None):
        """Update a custom template (system templates cannot be modified)."""
        from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
        organization_id = get_current_tenant_id()

        tpl = COATemplate.objects.filter(
            key=template_key, is_custom=True, organization_id=organization_id
        ).first()

        if not tpl:
            return Response({'error': 'Custom template not found (system templates cannot be edited)'},
                            status=status.HTTP_404_NOT_FOUND)

        # Update fields
        for field in ['name', 'region', 'description', 'icon', 'accent_color', 'accounts']:
            if field in request.data:
                setattr(tpl, field, request.data[field])
        tpl.save()

        # Update posting rules if provided
        if 'posting_rules' in request.data:
            COATemplatePostingRule.objects.filter(template=tpl).delete()
            rules = request.data['posting_rules']
            if rules:
                COATemplatePostingRule.objects.bulk_create([
                    COATemplatePostingRule(
                        template=tpl,
                        event_code=r['event_code'],
                        account_code=r['account_code'],
                        description=r.get('description', ''),
                    )
                    for r in rules
                ])

        return Response({'message': 'Template updated', 'account_count': tpl.account_count})

    @action(detail=False, methods=['delete'], url_path='db-templates/(?P<template_key>[\\w]+)/delete')
    def db_template_delete(self, request, template_key=None):
        """Delete a custom template (system templates cannot be deleted)."""
        from apps.finance.models.coa_template import COATemplate
        organization_id = get_current_tenant_id()

        deleted, _ = COATemplate.objects.filter(
            key=template_key, is_custom=True, organization_id=organization_id
        ).delete()

        if not deleted:
            return Response({'error': 'Custom template not found or is a system template'},
                            status=status.HTTP_404_NOT_FOUND)

        return Response({'message': f'Template {template_key} deleted'})

    # ─── Migration Mapping Endpoints ─────────────────────────────────

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps/(?P<source_key>[\\w]+)/(?P<target_key>[\\w]+)')
    def migration_map(self, request, source_key=None, target_key=None):
        """Get pre-built account mapping between two templates with quality KPIs."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        maps = COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).order_by('source_account_code', 'mapping_type', 'target_account_code').values(
            'source_account_code', 'target_account_code', 'notes',
            'match_level', 'confidence_score', 'status', 'mapping_type',
            'is_manual_override', 'mapping_reason',
            'group_key', 'allocation_percent',
        )
        maps_list = list(maps)

        # Quality KPIs
        total = len(maps_list)
        by_level = {}
        mapped = 0
        unmapped = 0
        for m in maps_list:
            level = m.get('match_level', 'UNMAPPED')
            by_level[level] = by_level.get(level, 0) + 1
            if m.get('target_account_code'):
                mapped += 1
            else:
                unmapped += 1

        # Critical roles coverage
        critical_roles = ['CASH_ACCOUNT', 'RECEIVABLE', 'PAYABLE', 'REVENUE', 'COGS',
                          'VAT_INPUT', 'VAT_OUTPUT', 'RETAINED_EARNINGS', 'P_L_SUMMARY']
        source_roles = set(source.template_accounts.exclude(
            system_role__isnull=True
        ).exclude(system_role='').values_list('system_role', flat=True))
        critical_present = [r for r in critical_roles if r in source_roles]
        # Check which critical roles have mapped targets
        critical_mapped = 0
        for r in critical_present:
            src_acct = source.template_accounts.filter(system_role=r).first()
            if src_acct:
                has_map = any(m['source_account_code'] == src_acct.code and m.get('target_account_code') for m in maps_list)
                if has_map:
                    critical_mapped += 1

        return Response({
            'source_key': source_key, 'target_key': target_key,
            'source_name': source.name, 'target_name': target.name,
            'mappings': maps_list, 'total': total,
            'quality': {
                'mapped': mapped, 'unmapped': unmapped,
                'by_level': by_level,
                'coverage_pct': round((mapped / max(total, 1)) * 100, 1),
                'critical_roles_total': len(critical_present),
                'critical_roles_mapped': critical_mapped,
                'critical_roles_coverage_pct': round((critical_mapped / max(len(critical_present), 1)) * 100, 1),
            },
        })

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/rematch')
    def migration_map_rematch(self, request):
        """Server-side re-match using the 4-level algorithm with used_targets tracking."""
        import unicodedata, re
        from apps.finance.models.coa_template import (
            COATemplate, COATemplateAccount, COATemplateMigrationMap
        )

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        def normalize_name(name):
            name = unicodedata.normalize('NFD', name)
            name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
            name = name.lower().strip()
            name = re.sub(r'[^a-z0-9 ]', '', name)
            name = re.sub(r'\s+', ' ', name)
            return name

        SYNONYMS = {
            'cash in hand': ['caisse', 'petty cash', 'encaisse'],
            'accounts receivable': ['trade receivables', 'clients', 'creances clients', 'clients et comptes rattaches'],
            'accounts payable': ['trade payables', 'fournisseurs', 'fournisseurs et comptes rattaches'],
            'revenue': ['sales revenue', 'ventes', 'ventes de marchandises', 'chiffre daffaires'],
            'cost of goods sold': ['cogs', 'cout des ventes', 'achats de marchandises', 'achats'],
            'retained earnings': ['report a nouveau', 'resultats reportes'],
            'salary expense': ['salaires et traitements', 'charges de personnel', 'frais de personnel'],
            'depreciation expense': ['dotations aux amortissements', 'amortissements'],
            'bank account': ['banques', 'banques comptes courants'],
            'vat input': ['tva deductible', 'tva recuperable'],
            'vat output': ['tva collectee', 'tva facturee'],
            'inventory': ['stocks', 'marchandises', 'stocks de marchandises'],
            'buildings': ['constructions', 'batiments'],
            'equipment': ['materiel et outillage', 'materiel technique'],
            'vehicles': ['materiel de transport'],
            'furniture': ['mobilier', 'materiel de bureau'],
            'land': ['terrains'],
            'software': ['logiciels'],
        }

        def find_synonym_group(normalized):
            for key, syns in SYNONYMS.items():
                if normalized == normalize_name(key) or normalized in [normalize_name(s) for s in syns]:
                    return key
            return None

        src_accts = list(COATemplateAccount.objects.filter(template=source).order_by('code'))
        tgt_accts = list(COATemplateAccount.objects.filter(template=target).order_by('code'))

        # Build target indexes
        tgt_by_role, tgt_by_code, tgt_by_norm, tgt_by_syn, tgt_by_key = {}, {}, {}, {}, {}
        for t in tgt_accts:
            if t.system_role:
                tgt_by_role.setdefault(t.system_role, []).append(t)
            tgt_by_code[t.code] = t
            norm = t.normalized_name or normalize_name(t.name)
            tgt_by_norm.setdefault(norm, []).append(t)
            syn = find_synonym_group(norm)
            if syn:
                tgt_by_syn.setdefault(syn, []).append(t)
            key = f"{t.type}|{t.sub_type}|{t.business_domain}"
            tgt_by_key.setdefault(key, []).append(t)

        used = set()
        new_maps = []

        for src in src_accts:
            tgt_code, level, conf, reason = '', 'UNMAPPED', 0.0, 'No suitable match found'

            # Level 1: Role
            if src.system_role and src.system_role in tgt_by_role:
                cands = [t for t in tgt_by_role[src.system_role] if t.code not in used]
                if cands:
                    tgt_code, level, conf = cands[0].code, 'ROLE', 1.0
                    reason = f"System role: {src.system_role}"
                    used.add(tgt_code)

            # Level 2: Code + type + balance
            if not tgt_code and src.code in tgt_by_code:
                t = tgt_by_code[src.code]
                if t.code not in used and t.type == src.type and t.normal_balance == src.normal_balance:
                    tgt_code, level, conf = t.code, 'CODE', 0.8
                    reason = f"Code+type+balance: {src.code}"
                    used.add(tgt_code)

            # Level 3: Name / synonym
            if not tgt_code:
                src_norm = src.normalized_name or normalize_name(src.name)
                if src_norm in tgt_by_norm:
                    cands = [t for t in tgt_by_norm[src_norm] if t.code not in used]
                    if cands:
                        tgt_code, level, conf = cands[0].code, 'NAME', 0.7
                        reason = f"Name: '{src_norm}'"
                        used.add(tgt_code)
                if not tgt_code:
                    syn = find_synonym_group(src_norm)
                    if syn and syn in tgt_by_syn:
                        cands = [t for t in tgt_by_syn[syn] if t.code not in used and t.type == src.type]
                        if cands:
                            tgt_code, level, conf = cands[0].code, 'NAME', 0.6
                            reason = f"Synonym: '{syn}'"
                            used.add(tgt_code)

            # Level 4: Type+SubType+Domain
            if not tgt_code:
                key = f"{src.type}|{src.sub_type}|{src.business_domain}"
                if key in tgt_by_key:
                    cands = [t for t in tgt_by_key[key] if t.code not in used]
                    if cands:
                        tgt_code, level, conf = cands[0].code, 'TYPE_SUBTYPE', 0.4
                        reason = f"Type+SubType+Domain: {key}"
                        used.add(tgt_code)

            new_maps.append((src.code, tgt_code, level, conf, reason))

        # ── Pass 2: fallback for remaining unmapped — allow target reuse (N:1) ──
        for i, (sc, tc, lv, co, rs) in enumerate(new_maps):
            if tc:
                continue  # already matched

            src = next((a for a in src_accts if a.code == sc), None)
            if not src:
                continue

            # Try role match (without used constraint)
            if src.system_role and src.system_role in tgt_by_role:
                cands = tgt_by_role[src.system_role]
                if cands:
                    new_maps[i] = (sc, cands[0].code, 'ROLE', 0.5, f"Role (shared): {src.system_role}")
                    continue

            # Try name/synonym match
            src_norm = src.normalized_name or normalize_name(src.name)
            if src_norm in tgt_by_norm:
                new_maps[i] = (sc, tgt_by_norm[src_norm][0].code, 'NAME', 0.4, f"Name (shared): '{src_norm}'")
                continue
            syn = find_synonym_group(src_norm)
            if syn and syn in tgt_by_syn:
                cands = [t for t in tgt_by_syn[syn] if t.type == src.type]
                if cands:
                    new_maps[i] = (sc, cands[0].code, 'NAME', 0.35, f"Synonym (shared): '{syn}'")
                    continue

            # Try type match (without used constraint)
            key = f"{src.type}|{src.sub_type}|{src.business_domain}"
            if key in tgt_by_key:
                new_maps[i] = (sc, tgt_by_key[key][0].code, 'TYPE_SUBTYPE', 0.2, f"Type (shared): {key}")
                continue

        # Delete old maps for this pair and bulk create new ones
        COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).delete()

        objs = [COATemplateMigrationMap(
            source_template=source, target_template=target,
            source_account_code=sc, target_account_code=tc,
            match_level=lv, confidence_score=co,
            status='AUTO_MATCHED' if tc else 'UNMAPPED_OPTIONAL',
            mapping_type='ONE_TO_ONE', mapping_reason=rs, notes=rs,
        ) for sc, tc, lv, co, rs in new_maps]
        COATemplateMigrationMap.objects.bulk_create(objs)

        mapped = sum(1 for _, tc, _, _, _ in new_maps if tc)
        by_level = {}
        for _, _, lv, _, _ in new_maps:
            by_level[lv] = by_level.get(lv, 0) + 1

        return Response({
            'message': f'Re-matched: {mapped}/{len(new_maps)} mapped',
            'total': len(new_maps), 'mapped': mapped,
            'by_level': by_level,
        })

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps')
    def migration_maps_list(self, request):
        """List all available migration map pairs (which template→template maps exist)."""
        from apps.finance.models.coa_template import COATemplateMigrationMap

        pairs = COATemplateMigrationMap.objects.values(
            'source_template__key', 'source_template__name',
            'target_template__key', 'target_template__name',
        ).annotate(mapping_count=models.Count('id')).order_by('source_template__key')

        return Response([{
            'source_key': p['source_template__key'],
            'source_name': p['source_template__name'],
            'target_key': p['target_template__key'],
            'target_name': p['target_template__name'],
            'mapping_count': p['mapping_count'],
        } for p in pairs])

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/save')
    def migration_map_save(self, request):
        """Create or update migration mappings between two templates with match metadata."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')
        mappings = request.data.get('mappings', [])

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'One or both templates not found'}, status=status.HTTP_404_NOT_FOUND)

        # Map for confidence inference from notes
        def infer_match_metadata(notes_str):
            notes = (notes_str or '').lower()
            if 'role' in notes:
                return 'ROLE', 1.0
            elif 'same code' in notes or 'code' in notes:
                return 'CODE', 0.8
            elif 'name' in notes:
                return 'NAME', 0.6
            elif 'type' in notes:
                return 'TYPE_SUBTYPE', 0.4
            elif notes_str:
                return 'MANUAL', 0.5
            return 'UNMAPPED', 0.0

        # Upsert all mappings
        created, updated = 0, 0
        for m in mappings:
            match_level = m.get('match_level')
            confidence = m.get('confidence_score')
            if not match_level:
                match_level, confidence = infer_match_metadata(m.get('notes', ''))

            defaults = {
                'target_account_code': m.get('target_account_code', ''),
                'notes': m.get('notes', ''),
                'match_level': match_level,
                'confidence_score': confidence or 0.0,
                'status': m.get('status', 'AUTO_MATCHED'),
                'mapping_type': m.get('mapping_type', 'ONE_TO_ONE'),
                'mapping_reason': m.get('notes', ''),
                'is_manual_override': m.get('is_manual_override', False),
            }

            obj, was_created = COATemplateMigrationMap.objects.update_or_create(
                source_template=source,
                target_template=target,
                source_account_code=m['source_account_code'],
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response({
            'message': f'Saved {created + updated} mappings ({created} new, {updated} updated)',
            'created': created, 'updated': updated,
        })

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
                "rollup_balance": float(acc.rollup_balance),
                # ── Fields needed by migration page ──
                "template_origin": acc.template_origin,
                "allow_posting": acc.allow_posting,
                "is_system_only": acc.is_system_only,
                "system_role": acc.system_role,
                "balance": float(acc.balance),
                "balance_official": float(acc.balance_official),
            })
        return Response(data)

    @action(detail=False, methods=['get'])
    def coa_status(self, request):
        """Return current COA state with import_case detection.

        import_case values:
          EMPTY       — no active accounts at all → direct import
          UNTOUCHED   — accounts exist but zero transactions, zero balances,
                        and no custom/extra sub-accounts beyond the template
                        → safe to delete & replace without migration
          NEEDS_MIGRATION — accounts have transactions, balances, or custom
                        sub-accounts → full migration required
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine
        from django.db.models import Count, Q, Sum
        from decimal import Decimal

        org_accounts = ChartOfAccount.objects.filter(organization_id=organization_id, is_active=True)
        account_count = org_accounts.count()
        journal_count = JournalEntry.objects.filter(organization_id=organization_id).count()

        # Get the dominant template (most active accounts)
        template_stats = (
            org_accounts.values('template_origin')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        templates = {r['template_origin']: r['count'] for r in template_stats if r['template_origin']}
        current_template = max(templates, key=templates.get) if templates else None

        # ── Detect import_case ──────────────────────────────────────────
        if account_count == 0:
            import_case = 'EMPTY'
        else:
            # Check for any journal entry lines referencing org accounts
            has_journal_lines = JournalEntryLine.objects.filter(
                organization_id=organization_id
            ).exists()

            # Check for any non-zero balances
            has_balances = org_accounts.filter(
                Q(balance__gt=Decimal('0')) | Q(balance__lt=Decimal('0')) |
                Q(balance_official__gt=Decimal('0')) | Q(balance_official__lt=Decimal('0'))
            ).exists()

            # Check for custom/extra accounts (accounts not from the template)
            has_custom_accounts = org_accounts.filter(
                Q(template_origin__isnull=True) | Q(template_origin='')
            ).exists()

            if not has_journal_lines and not has_balances and not has_custom_accounts:
                import_case = 'UNTOUCHED'
            else:
                import_case = 'NEEDS_MIGRATION'

        # Per-account balances for migration display
        account_balances = []
        for acc in org_accounts.order_by('code'):
            account_balances.append({
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "balance": float(acc.balance) if acc.balance else 0,
                "template_origin": acc.template_origin,
            })

        return Response({
            "current_template": current_template,
            "templates": templates,
            "account_count": account_count,
            "journal_entry_count": journal_count,
            "has_data": journal_count > 0,
            "needs_migration": import_case == 'NEEDS_MIGRATION',
            "import_case": import_case,
            "accounts": account_balances,
        })

    @action(detail=False, methods=['post'])
    def migration_preview(self, request):
        """Return enriched account data for the Migration Execution Screen.
        
        4-level smart matching algorithm:
          Level 1 — system_role match (RECEIVABLE→RECEIVABLE, strongest)
          Level 2 — exact code match (code exists in target template)
          Level 3 — normalized name match (accent-stripped, lowercased)
          Level 4 — class_code + type fallback (same account class)
        
        Custom detection:
          An account is "custom" if it was NOT seeded from any template
          (template_origin is NULL or empty), meaning the user added it manually.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)

        target_template_key = request.data.get('target_template_key', '')
        if not target_template_key:
            return Response({"error": "target_template_key is required"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.finance.models import ChartOfAccount, JournalEntryLine
        from apps.finance.models.coa_template import COATemplateAccount, normalize_account_name
        from django.db.models import Count, Q

        # ── 1. Get all active org accounts with transaction counts ──
        org_accounts = (
            ChartOfAccount.objects
            .filter(organization_id=organization_id, is_active=True)
            .annotate(txn_count=Count('journalentryline', filter=Q(journalentryline__isnull=False)))
            .select_related('parent')
            .order_by('code')
        )

        # ── 2. Build target template lookup structures ──
        target_template_rows = list(
            COATemplateAccount.objects
            .filter(template__key=target_template_key)
            .values('code', 'name', 'type', 'parent_code', 'system_role',
                    'normalized_name', 'sub_type', 'business_domain')
        )

        target_by_code = {}          # code → target account dict
        target_by_role = {}          # system_role → target account dict
        target_by_norm_name = {}     # normalized_name → target account dict
        target_by_type = {}          # type → [target accounts]

        for ta in target_template_rows:
            td = {
                'code': ta['code'],
                'name': ta['name'],
                'type': ta['type'],
                'parent_code': ta['parent_code'],
            }
            target_by_code[ta['code']] = td

            if ta.get('system_role'):
                target_by_role[ta['system_role']] = td

            norm = ta.get('normalized_name', '')
            if norm:
                target_by_norm_name[norm] = td

            acc_type = ta.get('type', '')
            if acc_type:
                target_by_type.setdefault(acc_type, []).append(td)

        target_codes_set = set(target_by_code.keys())

        # ── 3. Determine the current source template key ──
        # (most common template_origin across org accounts)
        origin_counts = {}
        for acc in org_accounts:
            origin = acc.template_origin
            if origin:
                origin_counts[origin] = origin_counts.get(origin, 0) + 1
        source_template_key = max(origin_counts, key=origin_counts.get) if origin_counts else None

        # ── 4. Build source template role → code map for role-based matching ──
        source_role_map = {}  # system_role → source code
        if source_template_key:
            source_template_roles = list(
                COATemplateAccount.objects
                .filter(template__key=source_template_key, system_role__isnull=False)
                .values('code', 'system_role')
            )
            for sr in source_template_roles:
                source_role_map[sr['code']] = sr['system_role']

        # ── 5. Classify each account ──
        accounts_data = []
        for acc in org_accounts:
            balance = float(acc.balance) if acc.balance else 0
            txn_count = acc.txn_count or 0

            # Custom detection: account has no template_origin → user-added
            has_template_origin = bool(acc.template_origin and acc.template_origin.strip())
            is_custom = not has_template_origin

            # ── Smart target suggestion (4 levels) ──
            suggested_target = None
            suggestion_reason = None

            # Level 1: System role match
            # If this source account has a system_role, find same role in target
            source_role = source_role_map.get(acc.code) or getattr(acc, 'system_role', None)
            if source_role and source_role in target_by_role:
                suggested_target = target_by_role[source_role]
                suggestion_reason = 'EXACT_MATCH'  # role match is the strongest

            # Level 2: Exact code match
            if not suggested_target and acc.code in target_by_code:
                suggested_target = target_by_code[acc.code]
                suggestion_reason = 'EXACT_MATCH'

            # Level 3: Normalized name match
            if not suggested_target:
                try:
                    acc_norm_name = normalize_account_name(acc.name) if acc.name else ''
                    if acc_norm_name and acc_norm_name in target_by_norm_name:
                        suggested_target = target_by_norm_name[acc_norm_name]
                        suggestion_reason = 'EXACT_MATCH'
                except Exception:
                    pass

            # Level 4: Parent-based inheritance (for sub-accounts)
            if not suggested_target and acc.parent:
                parent_code = acc.parent.code
                # Check if parent has a match in the target
                if parent_code in target_by_code:
                    suggested_target = target_by_code[parent_code]
                    suggestion_reason = 'PARENT_MATCH'
                else:
                    # Try parent's role
                    parent_role = source_role_map.get(parent_code) or getattr(acc.parent, 'system_role', None)
                    if parent_role and parent_role in target_by_role:
                        suggested_target = target_by_role[parent_role]
                        suggestion_reason = 'PARENT_MATCH'

            # Level 5: Type fallback — match by account type, prefer leaf accounts
            if not suggested_target:
                acc_type = acc.type or ''
                type_candidates = target_by_type.get(acc_type, [])
                if type_candidates:
                    # Prefer accounts without children (leaf) for posting accounts
                    # For header accounts, prefer parent-level accounts
                    if acc.allow_posting:
                        # Find a leaf-level target
                        for tc in type_candidates:
                            if tc['parent_code']:  # has a parent = leaf-ish
                                suggested_target = tc
                                suggestion_reason = 'TYPE_MATCH'
                                break
                    if not suggested_target and type_candidates:
                        suggested_target = type_candidates[0]
                        suggestion_reason = 'TYPE_MATCH'

            # ── Determine category ──
            if balance != 0:
                category = 'HAS_BALANCE'
            elif txn_count > 0:
                category = 'HAS_TRANSACTIONS'
            elif is_custom:
                category = 'CUSTOM'
            else:
                category = 'CLEAN'

            accounts_data.append({
                'code': acc.code,
                'name': acc.name,
                'type': acc.type or '',
                'balance': balance,
                'txn_count': txn_count,
                'parent_code': acc.parent.code if acc.parent else None,
                'parent_name': acc.parent.name if acc.parent else None,
                'template_origin': acc.template_origin,
                'is_custom': is_custom,
                'category': category,
                'suggested_target': suggested_target,
                'suggestion_reason': suggestion_reason,
                'allow_posting': acc.allow_posting,
            })

        # ── Summary stats ──
        has_balance = [a for a in accounts_data if a['category'] == 'HAS_BALANCE']
        has_txns = [a for a in accounts_data if a['category'] == 'HAS_TRANSACTIONS']
        custom = [a for a in accounts_data if a['is_custom']]

        return Response({
            'target_template': target_template_key,
            'target_codes_count': len(target_codes_set),
            'summary': {
                'total_accounts': len(accounts_data),
                'with_balance': len(has_balance),
                'with_transactions': len(has_txns),
                'custom_accounts': len(custom),
                'total_balance': sum(a['balance'] for a in has_balance),
            },
            'accounts': accounts_data,
            'target_template_accounts': list(target_by_code.values()),
        })

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        template_key = request.data.get('template_key')
        reset = request.data.get('reset', False)
        account_mapping = request.data.get('account_mapping', {})
        # account_mapping: { "old_code": "new_target_code", ... }
        # Used to remap journal entries from source accounts to target accounts
        
        if not template_key:
            return Response({"error": "template_key is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from apps.finance.models import ChartOfAccount, PostingRule
            from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule
            from django.db import transaction as db_transaction
            import logging
            logger = logging.getLogger(__name__)

            # ── Phase 1: Snapshot old accounts before import ──
            old_accounts_by_code = {}
            if account_mapping:
                old_accounts_by_code = {
                    a.code: a for a in ChartOfAccount.objects.filter(
                        organization=organization, is_active=True
                    )
                }

            # ── Phase 2: Apply the new template ──
            LedgerService.apply_coa_template(organization, template_key, reset)

            # ── Phase 3: Remap references using account_mapping ──
            remapped_count = 0
            financial_accounts_remapped = 0
            remap_errors = []
            if account_mapping:
                with db_transaction.atomic():
                    from apps.finance.models import JournalEntryLine, FinancialAccount

                    # Build new code→account lookup (after import)
                    new_accounts_by_code = {
                        a.code: a for a in ChartOfAccount.objects.filter(
                            organization=organization, is_active=True
                        )
                    }

                    for source_code, target_code in account_mapping.items():
                        if not target_code or source_code == target_code:
                            continue  # skip unmapped or same-code entries

                        # Find the target account in the new COA
                        target_account = new_accounts_by_code.get(target_code)
                        if not target_account:
                            remap_errors.append(
                                f"Target account {target_code} not found for source {source_code}"
                            )
                            continue

                        # Find the source account (may be deactivated after import)
                        source_account = old_accounts_by_code.get(source_code)
                        if not source_account:
                            # Try by code in current DB (might still exist as inactive)
                            source_account = ChartOfAccount.objects.filter(
                                organization=organization, code=source_code
                            ).first()

                        if not source_account:
                            remap_errors.append(
                                f"Source account {source_code} not found"
                            )
                            continue

                        # Remap journal entry lines
                        updated = JournalEntryLine.objects.filter(
                            organization=organization,
                            account=source_account,
                        ).update(account=target_account)

                        if updated > 0:
                            remapped_count += updated
                            logger.info(
                                f"Remapped {updated} journal lines: "
                                f"{source_code} → {target_code}"
                            )

                        # Remap posting rules
                        PostingRule.objects.filter(
                            organization=organization,
                            account=source_account,
                        ).update(account=target_account)

                        # Remap financial accounts (bank, cash, etc.)
                        fa_updated = FinancialAccount.objects.filter(
                            organization=organization,
                            ledger_account=source_account,
                        ).update(ledger_account=target_account)
                        if fa_updated > 0:
                            financial_accounts_remapped += fa_updated
                            logger.info(
                                f"Remapped {fa_updated} financial accounts: "
                                f"{source_code} → {target_code}"
                            )

            # ── Phase 3b: Auto-remap orphaned PostingRules & FinancialAccounts ──
            # PostingRules/FinancialAccounts pointing to deactivated accounts
            # that weren't covered by account_mapping get auto-remapped by
            # matching system_role or code in the new active COA.
            orphan_fixed = 0
            try:
                from apps.finance.models import FinancialAccount
                new_active = {
                    a.code: a for a in ChartOfAccount.objects.filter(
                        organization=organization, is_active=True
                    )
                }
                new_by_role = {}
                for a in new_active.values():
                    if a.system_role:
                        new_by_role[a.system_role] = a

                # Fix PostingRules pointing to inactive accounts
                orphan_rules = PostingRule.objects.filter(
                    organization=organization,
                    account__is_active=False,
                )
                for rule in orphan_rules:
                    old_acct = rule.account
                    # Try: same code in new COA → same system_role → deactivate rule
                    new_acct = new_active.get(old_acct.code)
                    if not new_acct and old_acct.system_role:
                        new_acct = new_by_role.get(old_acct.system_role)
                    if new_acct:
                        rule.account = new_acct
                        rule.save(update_fields=['account'])
                        orphan_fixed += 1
                    else:
                        rule.is_active = False
                        rule.save(update_fields=['is_active'])

                # Fix FinancialAccounts pointing to inactive ledger accounts
                orphan_fas = FinancialAccount.objects.filter(
                    organization=organization,
                    ledger_account__isnull=False,
                    ledger_account__is_active=False,
                )
                for fa in orphan_fas:
                    old_acct = fa.ledger_account
                    new_acct = new_active.get(old_acct.code)
                    if not new_acct and old_acct.system_role:
                        new_acct = new_by_role.get(old_acct.system_role)
                    if new_acct:
                        fa.ledger_account = new_acct
                        fa.save(update_fields=['ledger_account'])
                        financial_accounts_remapped += 1
            except Exception as exc:
                logger.warning("Orphan remap warning (non-fatal): %s", exc)

            # ── Phase 4: Auto-sync posting rules from the template ──
            posting_synced = 0
            try:
                tpl = COATemplate.objects.filter(key=template_key).first()
                if tpl:
                    tpl_rules = COATemplatePostingRule.objects.filter(template=tpl)
                    org_accts = {a.code: a for a in ChartOfAccount.objects.filter(organization=organization, is_active=True)}

                    for rule in tpl_rules:
                        acct = org_accts.get(rule.account_code)
                        if not acct:
                            # Try fuzzy: strip dots / leading zeros
                            norm = rule.account_code.lstrip('0').replace('.', '')
                            for code, a in org_accts.items():
                                if code.lstrip('0').replace('.', '') == norm:
                                    acct = a
                                    break
                        if acct:
                            _, created = PostingRule.objects.update_or_create(
                                organization=organization,
                                event_code=rule.event_code,
                                defaults={
                                    'account': acct,
                                    'module': rule.module or rule.event_code.split('.', 1)[0],
                                    'source': 'SEED',
                                    'description': rule.description,
                                    'is_active': True,
                                },
                            )
                            if created:
                                posting_synced += 1
            except Exception as exc:
                logger.warning("Posting rules auto-sync warning: %s", exc)

            return Response({
                "message": f"Template applied successfully. {posting_synced} posting rules synced. {remapped_count} journal lines remapped. {financial_accounts_remapped} financial accounts remapped. {orphan_fixed} orphan rules fixed.",
                "posting_rules_synced": posting_synced,
                "journal_lines_remapped": remapped_count,
                "financial_accounts_remapped": financial_accounts_remapped,
                "orphan_rules_fixed": orphan_fixed,
                "remap_errors": remap_errors,
            })
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
        target_template_key = request.data.get('targetTemplateKey')
        target_template_accounts = request.data.get('targetTemplateAccounts', [])
        
        if not mappings:
            return Response({"error": "Mappings are required"}, status=status.HTTP_400_BAD_REQUEST)
        if not target_template_key:
            return Response({"error": "Target template key is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            result = LedgerService.migrate_coa(
                organization, mappings, description,
                target_template_key=target_template_key,
                target_template_accounts=target_template_accounts,
            )
            return Response({
                "message": "Migration completed successfully",
                "renamed": result.get('renamed', 0),
                "deleted": result.get('deleted', 0),
                "created": result.get('created', 0),
            })
        except Exception as e:
            import traceback, logging
            logging.getLogger(__name__).error("Migration failed: %s\n%s", e, traceback.format_exc())
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

    # ═══════════════════════════════════════════════════════════════
    #  Phase 4 — Quality KPIs + Phase 5 — Approval Workflow
    # ═══════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='db-templates/migration-maps/quality')
    def migration_map_quality(self, request):
        """Compute quality KPIs for a template migration map."""
        from apps.finance.models.coa_template import (
            COATemplate, COATemplateAccount, COATemplateMigrationMap
        )

        source_key = request.query_params.get('source_key')
        target_key = request.query_params.get('target_key')
        if not source_key or not target_key:
            return Response({'error': 'source_key and target_key required'}, status=status.HTTP_400_BAD_REQUEST)

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        maps = list(COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ))
        source_accts = list(COATemplateAccount.objects.filter(template=source))
        target_accts = list(COATemplateAccount.objects.filter(template=target))

        total = len(maps)
        if total == 0:
            return Response({'error': 'No migration maps found', 'total': 0})

        # ── Match Level Distribution ──
        by_level = {}
        for m in maps:
            lvl = m.match_level or 'UNKNOWN'
            by_level[lvl] = by_level.get(lvl, 0) + 1

        # ── Confidence Distribution ──
        conf_high = sum(1 for m in maps if (m.confidence_score or 0) >= 0.7)
        conf_med = sum(1 for m in maps if 0.3 <= (m.confidence_score or 0) < 0.7)
        conf_low = sum(1 for m in maps if (m.confidence_score or 0) < 0.3 and m.target_account_code)
        conf_none = sum(1 for m in maps if not m.target_account_code)

        # ── Mapping Type Distribution ──
        by_type = {}
        for m in maps:
            mt = m.mapping_type or 'ONE_TO_ONE'
            by_type[mt] = by_type.get(mt, 0) + 1

        # ── Coverage ──
        mapped_source_codes = set(m.source_account_code for m in maps if m.target_account_code)
        mapped_target_codes = set(m.target_account_code for m in maps if m.target_account_code)
        source_codes = set(a.code for a in source_accts)
        target_codes = set(a.code for a in target_accts)
        unmapped_sources = source_codes - mapped_source_codes
        unmapped_targets = target_codes - mapped_target_codes

        # ── Critical Role Coverage ──
        CRITICAL_ROLES = {
            'CASH_ACCOUNT', 'BANK_ACCOUNT', 'RECEIVABLE', 'PAYABLE',
            'REVENUE', 'COGS', 'P_L_SUMMARY', 'RETAINED_EARNINGS',
            'INVENTORY_ASSET', 'INPUT_VAT', 'OUTPUT_VAT',
        }
        critical_source = [a for a in source_accts if a.system_role in CRITICAL_ROLES]
        critical_mapped = [a for a in critical_source if a.code in mapped_source_codes]
        critical_unmapped = [a for a in critical_source if a.code not in mapped_source_codes]

        # ── Risk Metrics ──
        no_direct = sum(1 for m in maps if m.mapping_type == 'NO_DIRECT_MATCH')
        manual_review = sum(1 for m in maps if m.status == 'MANUAL_REVIEW')

        # ── Overall Score (0-100) ──
        coverage_pct = (len(mapped_source_codes) / len(source_codes) * 100) if source_codes else 0
        critical_pct = (len(critical_mapped) / len(critical_source) * 100) if critical_source else 100
        avg_confidence = (sum(m.confidence_score or 0 for m in maps) / total * 100) if total else 0
        quality_score = round(
            coverage_pct * 0.4 +        # 40% weight: overall coverage
            critical_pct * 0.35 +        # 35% weight: critical role coverage
            avg_confidence * 0.25,       # 25% weight: average confidence
            1
        )

        return Response({
            'source_key': source_key,
            'target_key': target_key,
            'quality_score': quality_score,
            'total_mappings': total,
            'coverage': {
                'source_total': len(source_codes),
                'source_mapped': len(mapped_source_codes),
                'source_pct': round(coverage_pct, 1),
                'target_total': len(target_codes),
                'target_covered': len(mapped_target_codes),
                'target_pct': round(len(mapped_target_codes) / len(target_codes) * 100, 1) if target_codes else 0,
                'unmapped_sources': sorted(list(unmapped_sources))[:20],
                'unmapped_targets': sorted(list(unmapped_targets))[:20],
            },
            'match_levels': by_level,
            'mapping_types': by_type,
            'confidence': {
                'high': conf_high,
                'medium': conf_med,
                'low': conf_low,
                'unmapped': conf_none,
                'avg': round(avg_confidence, 1),
            },
            'critical_roles': {
                'total': len(critical_source),
                'mapped': len(critical_mapped),
                'pct': round(critical_pct, 1),
                'unmapped': [{'code': a.code, 'name': a.name, 'role': a.system_role} for a in critical_unmapped],
            },
            'risk': {
                'no_direct_match': no_direct,
                'manual_review': manual_review,
                'risk_level': 'LOW' if quality_score >= 80 else 'MEDIUM' if quality_score >= 60 else 'HIGH',
            },
        })

    @action(detail=False, methods=['post'], url_path='db-templates/migration-maps/set-status')
    def migration_map_set_status(self, request):
        """Set approval status on a migration map pair (Draft → Reviewed → Approved → Published)."""
        from apps.finance.models.coa_template import COATemplate, COATemplateMigrationMap

        source_key = request.data.get('source_key')
        target_key = request.data.get('target_key')
        new_status = request.data.get('status', '').upper()
        VALID_STATUSES = ('DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED')
        if new_status not in VALID_STATUSES:
            return Response({'error': f'Invalid status. Must be one of: {VALID_STATUSES}'}, status=status.HTTP_400_BAD_REQUEST)

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        updated = COATemplateMigrationMap.objects.filter(
            source_template=source, target_template=target
        ).update(status=new_status)

        return Response({
            'source_key': source_key,
            'target_key': target_key,
            'status': new_status,
            'updated': updated,
            'message': f'Set {updated} mappings to {new_status}',
        })

    # ═══════════════════════════════════════════════════════════════
    #  Migration Execution Engine — Phase 6 endpoints
    # ═══════════════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='coa-migration/create-session')
    def migration_session_create(self, request):
        """Create a new DRAFT migration session for the current org."""
        from apps.finance.models.coa_template import COATemplate, COAMigrationSession

        source_key = request.data.get('source_template_key')
        target_key = request.data.get('target_template_key')
        migration_date = request.data.get('migration_date')

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Source or target template not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check for existing active session
        existing = COAMigrationSession.objects.filter(
            organization=request.organization,
            status__in=['DRAFT', 'DRY_RUN', 'APPROVED', 'EXECUTING'],
        ).first()
        if existing:
            return Response({
                'error': f'Active migration session already exists (id={existing.id}, status={existing.status})',
                'session_id': existing.id,
            }, status=status.HTTP_409_CONFLICT)

        session = COAMigrationSession.objects.create(
            organization=request.organization,
            source_template=source,
            target_template=target,
            migration_date=migration_date,
            status='DRAFT',
        )
        return Response({
            'session_id': session.id,
            'status': session.status,
            'source_key': source.key,
            'target_key': target.key,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='coa-migration/dry-run')
    def migration_session_dry_run(self, request):
        """Run dry-run analysis on an existing session — populates account plans."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import run_dry_run

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            report = run_dry_run(session)
            return Response({
                'session_id': session.id,
                'status': session.status,
                'report': report,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='coa-migration/session/(?P<session_id>[0-9]+)')
    def migration_session_detail(self, request, session_id=None):
        """Get session details with all account plans."""
        from apps.finance.models.coa_template import COAMigrationSession

        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        plans = session.account_plans.select_related('source_account').order_by(
            'migration_mode', 'source_account__code'
        )

        plans_data = []
        for p in plans:
            plans_data.append({
                'id': p.id,
                'source_code': p.source_account.code if p.source_account else '',
                'source_name': p.source_account.name if p.source_account else '',
                'source_type': p.source_account.type if p.source_account else '',
                'target_code': p.target_account_code,
                'target_name': p.target_account_name,
                'migration_mode': p.migration_mode,
                'is_mode_overridden': p.is_mode_overridden,
                'balance': float(p.balance_at_migration) if p.balance_at_migration else 0,
                'journal_lines': p.journal_line_count,
                'posting_rules': p.posting_rule_count,
                'financial_accounts': p.financial_account_count,
                'children': p.children_count,
                'historically_locked': p.historically_locked,
                'allocation_percent': float(p.allocation_percent) if p.allocation_percent else None,
                'group_key': p.group_key,
                'is_executed': p.is_executed,
            })

        return Response({
            'session': {
                'id': session.id,
                'source_key': session.source_template.key,
                'source_name': session.source_template.name,
                'target_key': session.target_template.key,
                'target_name': session.target_template.name,
                'migration_date': session.migration_date.isoformat() if session.migration_date else None,
                'status': session.status,
                'version': session.version,
                'is_locked': session.is_locked,
                'dry_run_report': session.dry_run_report,
                'created_at': session.created_at.isoformat(),
            },
            'plans': plans_data,
            'total': len(plans_data),
        })

    @action(detail=False, methods=['post'], url_path='coa-migration/approve')
    def migration_session_approve(self, request):
        """Approve a DRY_RUN session for execution."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import approve_session

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = approve_session(session, user=request.user)
            return Response({'session_id': session.id, **result})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='coa-migration/execute')
    def migration_session_execute(self, request):
        """Execute an approved migration session."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import execute_migration

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            report = execute_migration(session, user=request.user)
            return Response({'session_id': session.id, 'status': session.status, 'report': report})
        except ValueError as e:
            return Response({'error': str(e), 'session_id': session.id}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e), 'session_id': session.id}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='coa-migration/blockers/(?P<session_id>[0-9]+)')
    def migration_session_blockers(self, request, session_id=None):
        """Check pre-execution blockers for a session."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import run_blocker_checks

        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        blockers = run_blocker_checks(session)
        return Response({
            'session_id': session.id,
            'blocker_count': len([b for b in blockers if b['severity'] == 'BLOCKER']),
            'warning_count': len([b for b in blockers if b['severity'] == 'WARNING']),
            'blockers': blockers,
            'can_proceed': all(b['severity'] != 'BLOCKER' for b in blockers),
        })
