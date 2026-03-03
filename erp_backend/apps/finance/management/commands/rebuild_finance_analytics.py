"""
Management command: rebuild_finance_analytics
=============================================
Manual trigger for finance daily summary rebuild.
Usage:
    python manage.py rebuild_finance_analytics
    python manage.py rebuild_finance_analytics --date 2026-03-01
    python manage.py rebuild_finance_analytics --org 5 --backfill 30
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Rebuild FinanceDailySummary precomputed analytics table'

    def add_arguments(self, parser):
        parser.add_argument('--date', type=str, default=None,
                            help='ISO date to rebuild (default: yesterday)')
        parser.add_argument('--org', type=int, default=None,
                            help='Organization ID to rebuild (default: all)')
        parser.add_argument('--backfill', type=int, default=None,
                            help='Number of past days to backfill')

    def handle(self, *args, **options):
        from apps.finance.tasks import (
            rebuild_finance_daily_summary,
            backfill_finance_summary,
        )

        org_id   = options.get('org')
        date_str = options.get('date')
        backfill = options.get('backfill')

        if backfill:
            self.stdout.write(f'Backfilling {backfill} days...')
            result = backfill_finance_summary(org_id=org_id, days=backfill)
            self.stdout.write(self.style.SUCCESS(
                f"Backfill complete: {result['days_processed']} days processed"
            ))
        else:
            target = date_str or str((timezone.now() - timezone.timedelta(days=1)).date())
            self.stdout.write(f'Rebuilding FinanceDailySummary for date={target} org={org_id or "ALL"}...')
            result = rebuild_finance_daily_summary(org_id=org_id, date_str=target)
            self.stdout.write(self.style.SUCCESS(
                f"Done: {result.get('upserted_rows', 0)} rows upserted for {result.get('date')}"
            ))
