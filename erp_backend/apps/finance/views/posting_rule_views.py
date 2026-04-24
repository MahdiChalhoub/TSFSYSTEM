"""
PostingRule Views
=================
CRUD ViewSet for PostingRule model.
Provides list, create, update, delete, plus bulk-sync, completeness validation, and audit trail.
"""
import logging
from django.db import transaction
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import PostingRule
from apps.finance.serializers.posting_rule_serializers import PostingRuleSerializer

logger = logging.getLogger(__name__)


class PostingRuleViewSet(TenantModelViewSet):
    queryset = PostingRule.objects.select_related('account').all()
    serializer_class = PostingRuleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Optional filters
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        source = self.request.query_params.get('source')
        if source:
            qs = qs.filter(source=source)
        return qs

    def perform_create(self, serializer):
        """Auto-set source to MANUAL when created through API."""
        serializer.save(source='MANUAL')

    @action(detail=False, methods=['get'], url_path='by-module')
    def by_module(self, request):
        """Return posting rules grouped by module.

        Uses .values() + manual dict build instead of per-row DRF
        serialization. Cuts ~2/3 off the wall time for ~100+ rules
        because DRF serializer instantiation dominates at that scale.
        Shape matches PostingRuleSerializer exactly for UI compatibility.
        """
        org_id = get_current_tenant_id()
        rows = (
            PostingRule.objects
            .filter(organization_id=org_id, is_active=True)
            .values(
                'id', 'event_code', 'account_id', 'module', 'source',
                'description', 'is_active', 'created_at', 'updated_at',
                'account__code', 'account__name',
            )
            .order_by('module', 'event_code')
        )

        grouped: dict = {}
        for r in rows:
            mod = r['module']
            if mod not in grouped:
                grouped[mod] = []
            grouped[mod].append({
                'id': r['id'],
                'event_code': r['event_code'],
                'account': r['account_id'],
                'account_code': r['account__code'] or '',
                'account_name': r['account__name'] or '',
                'module': mod,
                'source': r['source'],
                'description': r['description'],
                'is_active': r['is_active'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'updated_at': r['updated_at'].isoformat() if r['updated_at'] else None,
            })
        return Response(grouped)

    @action(detail=False, methods=['post'], url_path='sync-from-json')
    def sync_from_json(self, request):
        """
        Admin action: re-sync posting rules from Organization.settings JSON.
        Useful for catching up after manual JSON edits.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        from erp.services import ConfigurationService
        rules = ConfigurationService.get_posting_rules(org)

        synced = 0
        for section, mappings in rules.items():
            if not isinstance(mappings, dict):
                continue
            for key, account_id in mappings.items():
                if not account_id:
                    continue
                event_code = f"{section}.{key}"
                PostingRule.objects.update_or_create(
                    organization=org,
                    event_code=event_code,
                    defaults={
                        'account_id': account_id,
                        'source': 'AUTO',
                        'is_active': True,
                    }
                )
                synced += 1

        # Clear resolver cache
        from apps.finance.services.posting_resolver import PostingResolver
        PostingResolver.clear_cache(org_id)

        return Response({
            'synced': synced,
            'message': f'{synced} posting rule(s) synced from JSON.'
        })

    @action(detail=False, methods=['get'], url_path='completeness')
    def completeness(self, request):
        """Return posting rule completeness report for this organization."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        from apps.finance.services.posting_completeness import PostingCompletenessValidator
        report = PostingCompletenessValidator.validate(org)
        return Response(report)

    @action(detail=False, methods=['get'], url_path='completeness/by-module')
    def completeness_by_module(self, request):
        """Return posting rule completeness broken down by module."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        from apps.finance.services.posting_completeness import PostingCompletenessValidator
        report = PostingCompletenessValidator.get_module_coverage(org)
        return Response(report)

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        """Return audit trail for posting rule changes."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from apps.finance.models import PostingRuleHistory
        qs = PostingRuleHistory.objects.filter(
            organization_id=org_id
        ).select_related('old_account', 'new_account', 'changed_by').order_by('-timestamp')

        # Optional event_code filter
        event_code = request.query_params.get('event_code')
        if event_code:
            qs = qs.filter(event_code=event_code)

        entries = qs[:100]  # Limit to 100 entries
        data = []
        for entry in entries:
            data.append({
                'event_code': entry.event_code,
                'change_type': entry.change_type,
                'old_account': f"{entry.old_account.code} - {entry.old_account.name}" if entry.old_account else None,
                'new_account': f"{entry.new_account.code} - {entry.new_account.name}" if entry.new_account else None,
                'source': entry.source,
                'changed_by': entry.changed_by.username if entry.changed_by else None,
                'reason': entry.reason,
                'timestamp': entry.timestamp.isoformat(),
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='auto-detect')
    def auto_detect(self, request):
        """
        Run enhanced auto-detect and return confidence-scored results.
        Dry run — does NOT save anything.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        from apps.finance.services.auto_detect_engine import AutoDetectEngine

        results = AutoDetectEngine.detect_all(org)
        summary = AutoDetectEngine.get_detection_summary(org)

        return Response({
            'results': results,
            'summary': summary,
        })

    @action(detail=False, methods=['post'], url_path='auto-detect-apply')
    def auto_detect_apply(self, request):
        """
        Run auto-detect and apply matched results as PostingRules.
        Only creates/updates rules where confidence >= min_confidence.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        min_confidence = int(request.data.get('min_confidence', 70))

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        from apps.finance.services.auto_detect_engine import AutoDetectEngine

        results = AutoDetectEngine.detect_all(org)
        applied = 0

        for event_code, result in results.items():
            if not result['matched'] or result['confidence'] < min_confidence:
                continue

            PostingRule.objects.update_or_create(
                organization=org,
                event_code=event_code,
                defaults={
                    'account_id': result['account_id'],
                    'source': 'AUTO',
                    'is_active': True,
                    'description': f"Auto-detected ({result['confidence']}%): {result['strategy']}",
                }
            )
            applied += 1

        # Clear resolver cache
        from apps.finance.services.posting_resolver import PostingResolver
        PostingResolver.clear_cache(org_id)
        from apps.finance.services.coa_index_cache import clear_coa_cache
        clear_coa_cache(org_id)

        summary = AutoDetectEngine.get_detection_summary(org)

        return Response({
            'applied': applied,
            'min_confidence': min_confidence,
            'summary': summary,
            'message': f'{applied} posting rules auto-detected and saved.'
        })

    @action(detail=False, methods=['get'], url_path='contextual-rules')
    def contextual_rules(self, request):
        """List contextual posting rule overrides for this organization."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from apps.finance.models import ContextualPostingRule
        rules = ContextualPostingRule.objects.filter(
            organization_id=org_id
        ).select_related('base_rule', 'account').order_by('-priority')

        data = []
        for rule in rules:
            data.append({
                'id': rule.id,
                'event_code': rule.event_code,
                'context_type': rule.context_type,
                'context_value': rule.context_value,
                'account_id': rule.account_id,
                'account_code': rule.account.code if rule.account else '',
                'account_name': rule.account.name if rule.account else '',
                'priority': rule.priority,
                'description': rule.description,
                'is_active': rule.is_active,
                'base_event_code': rule.base_rule.event_code if rule.base_rule else '',
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='tax-account-mappings')
    def tax_account_mappings(self, request):
        """List tax account mappings for the default OrgTaxPolicy."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from apps.finance.models import OrgTaxPolicy, TaxAccountMapping
        policy = OrgTaxPolicy.objects.filter(
            organization_id=org_id, is_default=True
        ).first() or OrgTaxPolicy.objects.filter(
            organization_id=org_id
        ).first()

        if not policy:
            return Response({'error': 'No tax policy found'}, status=404)

        mappings = TaxAccountMapping.objects.filter(
            policy=policy
        ).select_related('account').order_by('tax_type')

        data = []
        for m in mappings:
            data.append({
                'id': m.id,
                'tax_type': m.tax_type,
                'tax_type_display': m.get_tax_type_display(),
                'account_id': m.account_id,
                'account_code': m.account.code if m.account else '',
                'account_name': m.account.name if m.account else '',
                'description': m.description,
                'policy_id': m.policy_id,
                'policy_name': policy.name,
            })
        return Response(data)

    @action(detail=False, methods=['post'], url_path='sync-from-template')
    def sync_from_template(self, request):
        """
        Sync posting rules from the org's COA template.
        Bridges COATemplatePostingRule → org PostingRule by matching
        template account codes to the org's actual COA accounts.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        from apps.finance.models import ChartOfAccount
        from apps.finance.models.coa_template import COATemplate, COATemplatePostingRule

        org = Organization.objects.get(id=org_id)

        # Determine which template the org uses
        template_key = None
        if hasattr(org, 'settings') and isinstance(org.settings, dict):
            template_key = org.settings.get('coa_template_key')
        if not template_key:
            # Fallback: try to detect from org region or default to IFRS
            template_key = 'IFRS_COA'
            # If org has a region hint
            region = getattr(org, 'country', '') or ''
            if region.lower() in ('lebanon', 'lb', 'lbn'):
                template_key = 'LEBANESE_PCN'
            elif region.lower() in ('france', 'fr', 'fra'):
                template_key = 'FRENCH_PCG'

        # Allow override from request
        template_key = request.data.get('template_key', template_key)

        tpl = COATemplate.objects.filter(key=template_key).first()
        if not tpl:
            return Response({
                'error': f'Template {template_key} not found. '
                         f'Available: {list(COATemplate.objects.values_list("key", flat=True))}'
            }, status=404)

        # Get template posting rules
        tpl_rules = COATemplatePostingRule.objects.filter(template=tpl)
        if not tpl_rules.exists():
            return Response({
                'error': f'Template {template_key} has no posting rules defined',
                'template_key': template_key,
            }, status=404)

        # Index org's COA accounts by code — 1 query
        org_accounts_by_code = {
            acct.code: acct
            for acct in ChartOfAccount.objects.filter(organization=org).only(
                'id', 'code', 'organization_id',
            )
        }
        # Secondary index for fuzzy (zero-stripped, dot-stripped) lookups
        normalized_index = {
            code.lstrip('0').replace('.', ''): acct
            for code, acct in org_accounts_by_code.items()
        }

        # Preload ALL existing rules for this org in one query so we can
        # classify each template rule as new / updated / unchanged in
        # memory without a per-rule round trip.
        existing_rules = {
            r.event_code: r
            for r in PostingRule.objects.filter(organization=org).only(
                'id', 'event_code', 'account_id', 'module', 'source',
                'description', 'is_active',
            )
        }

        to_create = []          # new PostingRule rows
        to_update = []          # existing rules whose account actually changed
        to_update_fields = set()
        history_to_create = []  # PostingRuleHistory rows, batched
        synced, skipped, no_match = 0, 0, []

        from apps.finance.models.posting_event import PostingRuleHistory

        for tpl_rule in tpl_rules:
            # Fast path: exact code match
            account = org_accounts_by_code.get(tpl_rule.account_code)
            if not account:
                # Fuzzy match via precomputed normalized index
                normalized = tpl_rule.account_code.lstrip('0').replace('.', '')
                account = normalized_index.get(normalized)

            if not account:
                no_match.append({
                    'event_code': tpl_rule.event_code,
                    'account_code': tpl_rule.account_code,
                    'description': tpl_rule.description,
                })
                continue

            module = tpl_rule.module or tpl_rule.event_code.split('.', 1)[0]
            desc = tpl_rule.description

            existing = existing_rules.get(tpl_rule.event_code)
            if existing is None:
                # Brand new — queue for bulk_create + history
                to_create.append(PostingRule(
                    organization=org,
                    event_code=tpl_rule.event_code,
                    account=account,
                    module=module,
                    source='SEED',
                    description=desc,
                    is_active=True,
                ))
                history_to_create.append(PostingRuleHistory(
                    organization=org,
                    event_code=tpl_rule.event_code,
                    change_type='CREATE',
                    new_account=account,
                    new_account_code=account.code,
                    source='SEED',
                ))
                synced += 1
            else:
                # Only update + write history when a field actually changed
                if (existing.account_id != account.id
                        or existing.module != module
                        or existing.source != 'SEED'
                        or existing.description != desc
                        or not existing.is_active):
                    old_account_id = existing.account_id
                    existing.account = account
                    existing.module = module
                    existing.source = 'SEED'
                    existing.description = desc
                    existing.is_active = True
                    to_update.append(existing)
                    to_update_fields.update(
                        ['account', 'module', 'source', 'description', 'is_active']
                    )
                    if old_account_id != account.id:
                        # Resolve old account code from the in-memory index
                        # (no DB round trip; tiny scan over ~134 entries)
                        old_acct_code = ''
                        if old_account_id:
                            for _c, _a in org_accounts_by_code.items():
                                if _a.id == old_account_id:
                                    old_acct_code = _c
                                    break
                        history_to_create.append(PostingRuleHistory(
                            organization=org,
                            event_code=tpl_rule.event_code,
                            change_type='UPDATE',
                            old_account_id=old_account_id,
                            old_account_code=old_acct_code,
                            new_account=account,
                            new_account_code=account.code,
                            source='SEED',
                        ))
                    skipped += 1  # "updated existing"
                # else: no-op — skip write entirely

        # Bulk writes — 3 DB round trips total regardless of rule count.
        # Bypasses PostingRule.save() (which would re-fetch each original
        # and write history per-row), but we've already queued all history
        # entries explicitly above.
        from django.db import transaction as _tx
        with _tx.atomic():
            if to_create:
                PostingRule.objects.bulk_create(to_create, batch_size=500)
            if to_update:
                PostingRule.objects.bulk_update(
                    to_update, list(to_update_fields), batch_size=500,
                )
            if history_to_create:
                PostingRuleHistory.objects.bulk_create(
                    history_to_create, batch_size=500,
                )

        # Clear caches
        try:
            from apps.finance.services.posting_resolver import PostingResolver
            PostingResolver.clear_cache(org_id)
            from apps.finance.services.coa_index_cache import clear_coa_cache
            clear_coa_cache(org_id)
        except Exception:
            pass

        return Response({
            'synced': synced,
            'updated': skipped,
            'unmatched': len(no_match),
            'unmatched_rules': no_match[:20],  # Limit response size
            'template_key': template_key,
            'total_template_rules': tpl_rules.count(),
            'message': f'{synced} new + {skipped} updated posting rules from template {template_key}. '
                       f'{len(no_match)} rules could not be matched to org accounts.',
        })

    # ═══════════════════════════════════════════════════════════════
    # EVENT CATALOG — Dynamic, served from PostingEvent table
    # ═══════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='event-catalog')
    def event_catalog(self, request):
        """
        Serve the full PostingEvent catalog grouped by module.
        This replaces any hardcoded event lists in the frontend.

        Response: { modules: [ { key, label, events: [{code,label,description,criticality,normal_balance,document_type}] } ] }
        """
        from apps.finance.models.posting_event import PostingEvent

        events = PostingEvent.objects.filter(is_active=True).order_by(
            'module', 'document_type', 'line_role'
        )

        # Module display labels
        MODULE_LABELS = dict(PostingEvent.MODULE_CHOICES)

        grouped = {}
        for ev in events:
            if ev.module not in grouped:
                grouped[ev.module] = {
                    'key': ev.module,
                    'label': MODULE_LABELS.get(ev.module, ev.module.title()),
                    'events': [],
                }
            # Derive a human label from line_role
            label = ev.line_role.replace('_', ' ').title()
            if ev.document_type not in ('invoice', ev.module):
                doc_label = ev.document_type.replace('_', ' ').title()
                label = f"{doc_label}: {label}"

            grouped[ev.module]['events'].append({
                'code': ev.code,
                'label': label,
                'description': ev.description,
                'criticality': ev.criticality,
                'normal_balance': ev.normal_balance,
                'document_type': ev.document_type,
                'line_role': ev.line_role,
            })

        return Response({
            'modules': list(grouped.values()),
            'total_events': events.count(),
        })

    # ═══════════════════════════════════════════════════════════════
    # BULK SAVE — Atomic upsert with full audit trail
    # ═══════════════════════════════════════════════════════════════

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        """
        Accept a list of { event_code, account_id, source? } and atomically
        upsert all posting rules. Creates PostingRuleHistory for every change.

        Payload: { rules: [{ event_code, account_id }], reason?: string }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        rules_data = request.data.get('rules', [])
        reason = request.data.get('reason', 'Bulk save from posting rules console')

        if not rules_data:
            return Response({'error': 'No rules provided'}, status=400)

        from erp.models import Organization
        from apps.finance.models.posting_event import PostingRuleHistory
        from apps.finance.models import ChartOfAccount

        org = Organization.objects.get(id=org_id)
        user = request.user if request.user.is_authenticated else None

        # Index current rules
        current_rules = {
            r.event_code: r
            for r in PostingRule.objects.filter(
                organization=org, is_active=True
            ).select_related('account')
        }

        # Index accounts
        account_map = {
            a.id: a for a in ChartOfAccount.objects.filter(organization=org)
        }

        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []

        with transaction.atomic():
            for item in rules_data:
                code = item.get('event_code', '').strip()
                account_id = item.get('account_id')
                source = item.get('source', 'MANUAL')

                if not code:
                    continue

                # Skip if no account specified (means "unmapped")
                if not account_id:
                    skipped_count += 1
                    continue

                account = account_map.get(account_id)
                if not account:
                    errors.append(f'{code}: account {account_id} not found')
                    continue

                existing = current_rules.get(code)
                module = code.split('.', 1)[0] if '.' in code else 'unknown'

                if existing:
                    if existing.account_id == account_id:
                        skipped_count += 1
                        continue

                    # ── Update ──
                    old_account = existing.account
                    old_code = old_account.code if old_account else ''
                    existing.account = account
                    existing.source = source
                    existing.save(update_fields=['account_id', 'source', 'updated_at'])

                    PostingRuleHistory.objects.create(
                        organization=org,
                        event_code=code,
                        change_type='UPDATE',
                        old_account=old_account,
                        old_account_code=old_code,
                        new_account=account,
                        new_account_code=account.code,
                        source=source,
                        changed_by=user,
                        reason=reason,
                    )
                    updated_count += 1
                else:
                    # ── Create ──
                    PostingRule.objects.create(
                        organization=org,
                        event_code=code,
                        account=account,
                        module=module,
                        source=source,
                        description=f'Configured from posting console',
                        is_active=True,
                    )
                    PostingRuleHistory.objects.create(
                        organization=org,
                        event_code=code,
                        change_type='CREATE',
                        new_account=account,
                        new_account_code=account.code,
                        source=source,
                        changed_by=user,
                        reason=reason,
                    )
                    created_count += 1

        # Clear caches
        try:
            from apps.finance.services.posting_resolver import PostingResolver
            PostingResolver.clear_cache(org_id)
        except Exception:
            pass
        try:
            from apps.finance.services.coa_index_cache import clear_coa_cache
            clear_coa_cache(org_id)
        except Exception:
            pass

        return Response({
            'created': created_count,
            'updated': updated_count,
            'skipped': skipped_count,
            'errors': errors[:20],
            'total_processed': len(rules_data),
            'message': f'{created_count} created, {updated_count} updated, {skipped_count} unchanged.',
        })

