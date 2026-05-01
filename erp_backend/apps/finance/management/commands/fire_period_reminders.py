"""Daily scheduler for fiscal-period AND fiscal-year reminders.

Fires four auto-task events across every organization:
  - PERIOD_CLOSING_SOON   — today == period.end_date   - days_before
  - PERIOD_STARTING_SOON  — today == period.start_date - days_before
  - YEAR_CLOSING_SOON     — today == year.end_date     - days_before
  - YEAR_STARTING_SOON    — today == year.start_date   - days_before

Each rule can override the lead-time via `conditions.days_before`. If unset,
the tenant-wide setting `Organization.settings['period_reminder_days_before']`
is used (default: 7). The scheduler collects all distinct lead-times across
applicable rules plus the org default, and fires one event per (period or
year, lead-time) pair on the matching day. The engine then dispatches only
the rule(s) whose days_before matches.

Intended to be run once per day via cron / Celery beat:
    0 6 * * *  python manage.py fire_period_reminders
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.finance.models import (
    CloseChecklistRun,
    FiscalPeriod,
    FiscalYear,
)
from erp.connector_registry import connector
from erp.models import Organization

# Pattern D: management-command-time imports — eager resolution is fine here.
# AutoTaskRule has no connector capability yet; direct import keeps lookup
# semantics intact for the lead-day rule resolution helper below.
from apps.workspace.models import AutoTaskRule  # noqa: E402  (Pattern D: management cmd)


def fire_auto_tasks(organization, event, context):
    """Thin wrapper that routes through the connector capability."""
    return connector.execute(
        'workspace.auto_tasks.fire',
        org_id=organization.id,
        organization=organization,
        event=event,
        context=context,
    ) or []

DEFAULT_LEAD_DAYS = 7


class Command(BaseCommand):
    help = "Fire PERIOD_CLOSING_SOON / PERIOD_STARTING_SOON auto-task events for today."

    def add_arguments(self, parser):
        parser.add_argument(
            '--as-of', type=str, default=None,
            help="Override today's date for testing (YYYY-MM-DD).",
        )
        parser.add_argument(
            '--org', type=int, default=None,
            help="Restrict to a single organization id (default: all).",
        )

    def handle(self, *args, **opts):
        if opts.get('as_of'):
            today = date.fromisoformat(opts['as_of'])
        else:
            today = date.today()

        orgs = Organization.objects.all()
        if opts.get('org'):
            orgs = orgs.filter(id=opts['org'])

        total_fired = 0
        for org in orgs:
            org_default = self._org_default_lead_days(org)

            for trigger, field, label_key in (
                ('PERIOD_CLOSING_SOON', 'end_date', 'Ends on'),
                ('PERIOD_STARTING_SOON', 'start_date', 'Starts on'),
            ):
                lead_days_set = self._rule_lead_times_for(org, trigger, org_default)
                for lead_days in lead_days_set:
                    target = today + timedelta(days=lead_days)
                    filters = {'organization': org, field: target}
                    if trigger == 'PERIOD_CLOSING_SOON':
                        filters['status'] = 'OPEN'
                    periods = FiscalPeriod.objects.filter(**filters).select_related('fiscal_year')
                    for period in periods:
                        fire_auto_tasks(org, trigger, {
                            'reference': f'Period {period.name}',
                            'days_before': lead_days,
                            'extra': {
                                'object_type': 'FiscalPeriod',
                                'object_id': period.id,
                                'Period': period.name,
                                label_key: str(getattr(period, field)),
                                'Days out': lead_days,
                            },
                        })
                        total_fired += 1

            for trigger, field, label_key in (
                ('YEAR_CLOSING_SOON', 'end_date', 'Ends on'),
                ('YEAR_STARTING_SOON', 'start_date', 'Starts on'),
            ):
                lead_days_set = self._rule_lead_times_for(org, trigger, org_default)
                for lead_days in lead_days_set:
                    target = today + timedelta(days=lead_days)
                    filters = {'organization': org, field: target}
                    if trigger == 'YEAR_CLOSING_SOON':
                        # Skip already-finalized years.
                        filters['is_closed'] = False
                    years = FiscalYear.objects.filter(**filters)
                    for fy in years:
                        fire_auto_tasks(org, trigger, {
                            'reference': f'Fiscal Year {fy.name}',
                            'days_before': lead_days,
                            'extra': {
                                'object_type': 'FiscalYear',
                                'object_id': fy.id,
                                'Fiscal Year': fy.name,
                                label_key: str(getattr(fy, field)),
                                'Days out': lead_days,
                            },
                        })
                        total_fired += 1

            # Checklist-overdue: any active run whose target end_date is
            # within `days_before` days of today AND still has incomplete
            # required items. One event per (run, lead-time) — the rule's
            # template typically lists the missing items in the task body.
            chk_lead_days_set = self._rule_lead_times_for(
                org, 'CHECKLIST_ITEM_OVERDUE', org_default,
            )
            for lead_days in chk_lead_days_set:
                target = today + timedelta(days=lead_days)
                runs = CloseChecklistRun.objects.filter(
                    organization=org, status='OPEN',
                ).select_related('fiscal_year', 'fiscal_period', 'template')
                for run in runs:
                    target_obj = run.fiscal_year or run.fiscal_period
                    if target_obj is None:
                        continue
                    if target_obj.end_date != target:
                        continue
                    missing_qs = run.item_states.filter(
                        item__is_required=True, is_complete=False,
                    ).select_related('item')
                    missing_count = missing_qs.count()
                    if missing_count == 0:
                        continue
                    target_label = (
                        f'Fiscal Year {run.fiscal_year.name}' if run.fiscal_year_id
                        else f'Period {run.fiscal_period.name}'
                    )
                    missing_summary = "; ".join(
                        s.item.name for s in missing_qs[:5]
                    )
                    fire_auto_tasks(org, 'CHECKLIST_ITEM_OVERDUE', {
                        'reference': f'Checklist {target_label}',
                        'days_before': lead_days,
                        'extra': {
                            'object_type': 'CloseChecklistRun',
                            'object_id': run.id,
                            'Target': target_label,
                            'Missing items': missing_count,
                            'Sample': missing_summary,
                            'Days out': lead_days,
                        },
                    })
                    total_fired += 1

        self.stdout.write(self.style.SUCCESS(
            f"Fired {total_fired} fiscal/checklist reminder events for {today}."
        ))

    @staticmethod
    def _org_default_lead_days(org):
        try:
            raw = (org.settings or {}).get('period_reminder_days_before')
            return int(raw) if raw is not None else DEFAULT_LEAD_DAYS
        except (TypeError, ValueError):
            return DEFAULT_LEAD_DAYS

    @staticmethod
    def _rule_lead_times_for(org, trigger, org_default):
        """Distinct days_before values that need to be checked for this trigger.
        Each active rule contributes either its own conditions.days_before or
        the org default when that field is unset."""
        out = set()
        rules = AutoTaskRule.objects.filter(
            organization=org, trigger_event=trigger, is_active=True,
        ).only('conditions')
        for r in rules:
            val = (r.conditions or {}).get('days_before')
            try:
                out.add(int(val) if val is not None else org_default)
            except (TypeError, ValueError):
                out.add(org_default)
        if not out:
            # Even without rules we still fire — lets operators wire rules
            # later and not miss reminders for today.
            out.add(org_default)
        return out
