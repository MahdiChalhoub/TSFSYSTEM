"""
Posting Completeness Validator
==============================
Validates that an organization has all required posting rules configured.
Returns a structured report with coverage stats and missing rules by criticality.
"""
import logging
from apps.finance.services.posting_event_catalog import POSTING_EVENT_CATALOG

logger = logging.getLogger(__name__)


class PostingCompletenessValidator:
    """
    Validates posting rule coverage for an organization.

    Usage:
        report = PostingCompletenessValidator.validate(organization)
        # report = {
        #     'total_events': 120,
        #     'configured': 85,
        #     'coverage_pct': 71,
        #     'missing_critical': [...],
        #     'missing_standard': [...],
        #     'missing_optional': [...],
        #     'missing_conditional': [...],
        #     'is_ready': True/False,
        #     'summary': 'Finance setup: 85/120 events configured (71%)'
        # }
    """

    @staticmethod
    def validate(organization):
        """Run full completeness check against the event catalog."""
        from apps.finance.models import PostingRule

        # Load all active rules for this org
        active_rules = set(
            PostingRule.objects.filter(
                organization=organization, is_active=True
            ).values_list('event_code', flat=True)
        )

        total = 0
        configured = 0
        missing = {
            'CRITICAL': [],
            'STANDARD': [],
            'OPTIONAL': [],
            'CONDITIONAL': [],
        }

        for event in POSTING_EVENT_CATALOG:
            if not event.get('is_active', True):
                continue
            total += 1
            code = event['code']
            if code in active_rules:
                configured += 1
            else:
                criticality = event.get('criticality', 'STANDARD')
                missing[criticality].append({
                    'code': code,
                    'module': event['module'],
                    'description': event.get('description', ''),
                })

        coverage_pct = round((configured / total * 100)) if total > 0 else 0
        has_critical_gaps = len(missing['CRITICAL']) > 0

        return {
            'total_events': total,
            'configured': configured,
            'coverage_pct': coverage_pct,
            'missing_critical': missing['CRITICAL'],
            'missing_standard': missing['STANDARD'],
            'missing_optional': missing['OPTIONAL'],
            'missing_conditional': missing['CONDITIONAL'],
            'is_ready': not has_critical_gaps,
            'summary': f"Finance setup: {configured}/{total} events configured ({coverage_pct}%)",
            'blockers': [
                f"CRITICAL: {m['code']} — {m['description']}"
                for m in missing['CRITICAL']
            ],
        }

    @staticmethod
    def get_module_coverage(organization):
        """Get coverage broken down by module."""
        from apps.finance.models import PostingRule

        active_rules = set(
            PostingRule.objects.filter(
                organization=organization, is_active=True
            ).values_list('event_code', flat=True)
        )

        modules = {}
        for event in POSTING_EVENT_CATALOG:
            mod = event['module']
            if mod not in modules:
                modules[mod] = {'total': 0, 'configured': 0, 'missing': []}
            modules[mod]['total'] += 1
            if event['code'] in active_rules:
                modules[mod]['configured'] += 1
            else:
                modules[mod]['missing'].append(event['code'])

        for mod, data in modules.items():
            data['coverage_pct'] = round((data['configured'] / data['total'] * 100)) if data['total'] > 0 else 0

        return modules
