"""
PostingRule Views
=================
CRUD ViewSet for PostingRule model.
Provides list, create, update, delete, plus bulk-sync, completeness validation, and audit trail.
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import PostingRule
from apps.finance.serializers.posting_rule_serializers import PostingRuleSerializer


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
        """Return posting rules grouped by module."""
        org_id = get_current_tenant_id()
        rules = PostingRule.objects.filter(
            organization_id=org_id, is_active=True
        ).select_related('account').order_by('module', 'event_code')

        grouped = {}
        for rule in rules:
            if rule.module not in grouped:
                grouped[rule.module] = []
            grouped[rule.module].append(PostingRuleSerializer(rule).data)

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
