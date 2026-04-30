"""
ChartOfAccountViewSet mixin — Migration preview (smart account-target
classifier). Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id,
)


class COAMigrationPreviewMixin:
    """@action method that builds an enriched migration plan preview."""

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
