"""
Management command: aggregate_sales_daily
==========================================
Pre-aggregates daily sales data into the SalesDailySummary table.
Idempotent — rebuild the same day repeatedly without duplicating rows.

Usage:
    python manage.py aggregate_sales_daily                       # yesterday (default)
    python manage.py aggregate_sales_daily --date 2026-02-28     # specific date
    python manage.py aggregate_sales_daily --date 2026-02-01 --days 28  # date range
    python manage.py aggregate_sales_daily --org myslug          # one org only

Schedule: run nightly via cron or Celery beat:
  0 1 * * * cd /app && python manage.py aggregate_sales_daily >> /var/log/erp/analytics.log 2>&1
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from erp.models import Organization


class Command(BaseCommand):
    help = 'Pre-aggregate daily sales into SalesDailySummary'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date', type=str, default=None,
            help='Target date YYYY-MM-DD (default: yesterday)'
        )
        parser.add_argument(
            '--days', type=int, default=1,
            help='Number of days to aggregate starting from --date (default: 1)'
        )
        parser.add_argument(
            '--org', type=str, default=None,
            help='Limit to a single organization slug'
        )

    def handle(self, *args, **options):
        from apps.pos.services.analytics_service import SalesAnalyticsService

        if options['date']:
            try:
                start = date.fromisoformat(options['date'])
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Invalid date format: {options['date']}. Use YYYY-MM-DD."))
                return
        else:
            start = date.today() - timedelta(days=1)

        days = options['days']
        dates = [start + timedelta(days=i) for i in range(days)]

        orgs = Organization.objects.filter(is_active=True)
        if options['org']:
            orgs = orgs.filter(slug=options['org'])
            if not orgs.exists():
                self.stderr.write(self.style.ERROR(f"No active org with slug '{options['org']}'"))
                return

        total_rows = 0
        for org in orgs:
            for target_date in dates:
                try:
                    rows = SalesAnalyticsService.aggregate_day(org, target_date)
                    count = len(rows)
                    total_rows += count
                    if count:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"[{org.slug}] {target_date} → {count} summary row(s) written"
                            )
                        )
                    else:
                        self.stdout.write(f"[{org.slug}] {target_date} → no orders, skipped")
                except Exception as exc:
                    self.stderr.write(
                        self.style.ERROR(f"[{org.slug}] {target_date} → ERROR: {exc}")
                    )
                    import traceback
                    self.stderr.write(traceback.format_exc())

        self.stdout.write(self.style.SUCCESS(
            f'Done. {total_rows} summary row(s) written across {len(dates)} day(s).'
        ))
