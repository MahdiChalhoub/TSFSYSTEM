"""
Reset year-end close state (TEST/DEV ONLY).

Wipes the artifacts produced by `close_fiscal_year` so it can be re-run
cleanly under the corrected M7 / Option A logic:
  - All OpeningBalance rows (regenerated next time year-end close runs)
  - All closing JournalEntries (journal_type='CLOSING') and their lines
  - FiscalYear.status reset to OPEN (and closed_at / closed_by cleared)
  - FiscalYear FK pointers (closing_journal_entry, internal_closing_journal_entry) cleared
  - FiscalPeriod.status reset to OPEN if it was CLOSED/HARD_LOCKED/SOFT_LOCKED

Does NOT touch:
  - FiscalYear / FiscalPeriod rows themselves (start/end dates, names)
  - Any other JournalEntries (only journal_type='CLOSING' is removed)
  - ChartOfAccount balances (those are derived; they self-correct on next refresh)

⚠️  Refuse to run if --i-know-what-im-doing is not passed.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "DEV ONLY — wipe year-end close artifacts so the new M7 logic can re-close cleanly."

    def add_arguments(self, parser):
        parser.add_argument(
            '--i-know-what-im-doing', action='store_true',
            help="Required confirmation flag.",
        )
        parser.add_argument(
            '--org', type=int, default=None,
            help="Restrict to a single organization id (default: all).",
        )

    def handle(self, *args, **opts):
        if not opts.get('i_know_what_im_doing'):
            self.stderr.write(self.style.ERROR(
                "Refusing to run. Pass --i-know-what-im-doing to proceed."
            ))
            return

        from django.db import connection
        from apps.finance.models import (
            FiscalYear, FiscalPeriod, OpeningBalance,
            JournalEntry, JournalEntryLine,
        )

        org_id = opts.get('org')
        org_filter = {'organization_id': org_id} if org_id else {}

        with transaction.atomic():
            # 1. Clear FiscalYear FK pointers first (PROTECT would block JE delete otherwise).
            fy_qs = FiscalYear.objects.filter(**org_filter)
            fy_qs.update(
                closing_journal_entry=None,
                internal_closing_journal_entry=None,
            )

            # 2. Delete closing JE lines + JEs via raw SQL to bypass reverse-cascade
            # checks (some FK reverse-relations may point to tables that don't exist
            # yet in dev DBs — e.g. bank_statement_line). Safe in DEV only.
            closing_je_ids = list(JournalEntry.objects.filter(
                **org_filter, journal_type='CLOSING',
            ).values_list('id', flat=True))
            line_count = 0
            je_count = len(closing_je_ids)
            if closing_je_ids:
                with connection.cursor() as c:
                    placeholders = ','.join(['%s'] * len(closing_je_ids))
                    c.execute(
                        f"DELETE FROM {JournalEntryLine._meta.db_table} "
                        f"WHERE journal_entry_id IN ({placeholders})",
                        closing_je_ids,
                    )
                    line_count = c.rowcount
                    c.execute(
                        f"DELETE FROM {JournalEntry._meta.db_table} "
                        f"WHERE id IN ({placeholders})",
                        closing_je_ids,
                    )

            # 3. Wipe all OpeningBalance rows.
            ob_count = OpeningBalance.objects.filter(**org_filter).count()
            OpeningBalance.objects.filter(**org_filter).delete()

            # 4. Reset FiscalYear status → OPEN.
            year_reset = FiscalYear.objects.filter(**org_filter).exclude(status='OPEN').count()
            for fy in FiscalYear.objects.filter(**org_filter).exclude(status='OPEN'):
                fy.status = 'OPEN'
                fy.closed_at = None
                fy.closed_by = None
                fy.save()

            # 5. Reset FiscalPeriod status → OPEN if locked/closed.
            period_reset = FiscalPeriod.objects.filter(
                **org_filter,
            ).exclude(status__in=('OPEN', 'FUTURE')).count()
            for p in FiscalPeriod.objects.filter(**org_filter).exclude(status__in=('OPEN', 'FUTURE')):
                p.status = 'OPEN'
                p.closed_at = None
                p.closed_by = None
                p.save()

        self.stdout.write(self.style.SUCCESS(
            f"Reset complete:\n"
            f"  - {je_count} closing journal entries deleted ({line_count} lines)\n"
            f"  - {ob_count} opening balances deleted\n"
            f"  - {year_reset} fiscal years reset to OPEN\n"
            f"  - {period_reset} fiscal periods reset to OPEN\n"
            f"\nNext step: re-run year-end close from the UI or via the API."
        ))
