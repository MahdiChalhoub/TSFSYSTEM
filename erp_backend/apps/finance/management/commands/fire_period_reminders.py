"""Daily scheduler for fiscal-period reminders.

Fires two auto-task events across every organization:
  - PERIOD_CLOSING_SOON  — today == period.end_date - days_before
  - PERIOD_STARTING_SOON — today == period.start_date - days_before

The lead-time `days_before` is read per-organization from
Organization.settings['period_reminder_days_before'] (default: 7).

Intended to be run once per day via cron / Celery beat:
    0 6 * * *  python manage.py fire_period_reminders
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.finance.models import FiscalPeriod
from apps.workspace.auto_task_service import fire_auto_tasks
from erp.models import Organization

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
            lead_days = self._lead_days_for(org)
            target = today + timedelta(days=lead_days)

            closing = FiscalPeriod.objects.filter(
                organization=org, end_date=target, status='OPEN',
            ).select_related('fiscal_year')
            for period in closing:
                fire_auto_tasks(org, 'PERIOD_CLOSING_SOON', {
                    'reference': f'Period {period.name}',
                    'extra': {
                        'object_type': 'FiscalPeriod',
                        'object_id': period.id,
                        'Period': period.name,
                        'Ends on': str(period.end_date),
                        'Days until close': lead_days,
                    },
                })
                total_fired += 1

            starting = FiscalPeriod.objects.filter(
                organization=org, start_date=target,
            ).select_related('fiscal_year')
            for period in starting:
                fire_auto_tasks(org, 'PERIOD_STARTING_SOON', {
                    'reference': f'Period {period.name}',
                    'extra': {
                        'object_type': 'FiscalPeriod',
                        'object_id': period.id,
                        'Period': period.name,
                        'Starts on': str(period.start_date),
                        'Days until start': lead_days,
                    },
                })
                total_fired += 1

        self.stdout.write(self.style.SUCCESS(
            f"Fired {total_fired} period-reminder events for {today}."
        ))

    @staticmethod
    def _lead_days_for(org):
        try:
            raw = (org.settings or {}).get('period_reminder_days_before')
            return int(raw) if raw is not None else DEFAULT_LEAD_DAYS
        except (TypeError, ValueError):
            return DEFAULT_LEAD_DAYS
