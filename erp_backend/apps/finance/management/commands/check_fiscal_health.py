"""
Fiscal data health check — run before deploying the fiscal-audit changes.

Reports (and optionally attempts to fix) pre-existing data that would be
blocked by the new model-level validators:
  - FiscalYear rows with null start_date / end_date
  - FiscalYear rows with start_date >= end_date
  - FiscalPeriod rows outside their parent year's [start, end]
  - FiscalPeriod rows with null dates
  - Orphan JournalEntries (fiscal_year NULL) within any existing FY range
"""
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = "Report fiscal-data health issues before migrating / deploying new validators."

    def add_arguments(self, parser):
        parser.add_argument(
            '--org', type=int, default=None,
            help="Restrict to a single organization id (default: all).",
        )

    def handle(self, *args, **opts):
        from apps.finance.models import FiscalYear, FiscalPeriod, JournalEntry

        org_id = opts.get('org')
        org_filter = {'organization_id': org_id} if org_id else {}

        self.stdout.write(self.style.NOTICE("== Fiscal Year issues =="))
        fy_null = FiscalYear.objects.filter(**org_filter).filter(
            Q(start_date__isnull=True) | Q(end_date__isnull=True)
        )
        self._report("FiscalYears with null dates", fy_null, lambda y: f"#{y.id} {y.name}")

        fy_with_dates = FiscalYear.objects.filter(**org_filter).exclude(
            start_date__isnull=True
        ).exclude(end_date__isnull=True)
        bad = [y for y in fy_with_dates if y.start_date >= y.end_date]
        self._report("FiscalYears with start_date >= end_date", bad, lambda y: f"#{y.id} {y.name} {y.start_date}→{y.end_date}")

        self.stdout.write(self.style.NOTICE("\n== Fiscal Period issues =="))
        fp_null = FiscalPeriod.objects.filter(**org_filter).filter(
            Q(start_date__isnull=True) | Q(end_date__isnull=True)
        )
        self._report("FiscalPeriods with null dates", fp_null, lambda p: f"#{p.id} {p.name}")

        fp_oob = []
        for p in FiscalPeriod.objects.filter(**org_filter).select_related('fiscal_year'):
            fy = p.fiscal_year
            if not (p.start_date and p.end_date and fy and fy.start_date and fy.end_date):
                continue
            if p.start_date < fy.start_date or p.end_date > fy.end_date:
                fp_oob.append(p)
        self._report(
            "FiscalPeriods outside parent year bounds",
            fp_oob,
            lambda p: f"#{p.id} {p.name} ({p.start_date}→{p.end_date}) in FY {p.fiscal_year.name}",
        )

        self.stdout.write(self.style.NOTICE("\n== Orphan JournalEntries =="))
        orphans = JournalEntry.objects.filter(**org_filter).filter(fiscal_year__isnull=True)
        orphan_in_range = 0
        for je in orphans[:500]:  # sample
            d = je.transaction_date.date() if hasattr(je.transaction_date, 'date') else je.transaction_date
            if FiscalYear.objects.filter(
                organization_id=je.organization_id, start_date__lte=d, end_date__gte=d
            ).exists():
                orphan_in_range += 1
        self.stdout.write(
            f"  Orphan JEs total (fiscal_year NULL): {orphans.count()}  "
            f"— of first 500 sampled, {orphan_in_range} fall inside some FY's date range "
            f"(these would be backfilled at year-end close)."
        )

        self.stdout.write(self.style.SUCCESS("\nDone."))

    def _report(self, label, queryset_or_list, formatter):
        items = list(queryset_or_list) if not isinstance(queryset_or_list, list) else queryset_or_list
        count = len(items)
        if count == 0:
            self.stdout.write(self.style.SUCCESS(f"  {label}: 0 (OK)"))
            return
        self.stdout.write(self.style.WARNING(f"  {label}: {count}"))
        for x in items[:20]:
            self.stdout.write(f"    - {formatter(x)}")
        if count > 20:
            self.stdout.write(f"    ... and {count - 20} more")


