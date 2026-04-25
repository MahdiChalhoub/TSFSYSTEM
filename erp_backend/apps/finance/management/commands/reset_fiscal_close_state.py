"""
Reset year-end close state (TEST/DEV ONLY).

Wipes the artifacts produced by `close_fiscal_year` so it can be re-run
cleanly under the corrected M7 / Option A logic:
  - All OpeningBalance rows (regenerated next time year-end close runs)
  - All closing JournalEntries (journal_type='CLOSING') and their lines
  - All system-generated opening JournalEntries
    (journal_type='OPENING' AND journal_role='SYSTEM_OPENING') and their
    lines — these are the prior year's carry-forward into the next year's
    books. They MUST be removed alongside the closing JEs, otherwise the
    `unique_active_opening_je_per_fy_scope` constraint will reject the
    re-close, AND retained-earnings carry-forwards will double-count.
    USER_GENERAL OPENING entries (e.g. capital injections that happen to
    use journal_type='OPENING') are deliberately NOT touched — they're
    user data, not system artifacts.
  - Both year-level and period-level close snapshots
    (FiscalYearCloseSnapshot, FiscalPeriodCloseSnapshot) — they hold a
    PROTECT-on-delete FK to the closing JE; without removing them the
    JE delete trips an IntegrityError.
  - FiscalYear.status reset to OPEN (and closed_at / closed_by cleared)
  - FiscalYear FK pointers (closing_journal_entry, internal_closing_journal_entry) cleared
  - FiscalPeriod.status reset to OPEN if it was CLOSED/HARD_LOCKED/SOFT_LOCKED

Does NOT touch:
  - FiscalYear / FiscalPeriod rows themselves (start/end dates, names)
  - User-generated journal entries (USER_GENERAL role)
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
        from apps.finance.models.fiscal_models import (
            FiscalYearCloseSnapshot, FiscalPeriodCloseSnapshot,
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

            # 2. Drop close snapshots — they hold a SET_NULL FK to the closing
            # JE in code but a PROTECT FK in some migration states; safer to
            # remove them outright. Scoped strictly to the orgs we're resetting.
            if org_id:
                fp_ids = list(FiscalPeriod.objects.filter(**org_filter).values_list('id', flat=True))
                fy_close_qs = FiscalYearCloseSnapshot.objects.filter(**org_filter)
                fp_close_qs = FiscalPeriodCloseSnapshot.objects.filter(fiscal_period_id__in=fp_ids)
            else:
                fy_close_qs = FiscalYearCloseSnapshot.objects.all()
                fp_close_qs = FiscalPeriodCloseSnapshot.objects.all()
            fy_snap_count = fy_close_qs.count()
            fp_snap_count = fp_close_qs.count()
            fy_close_qs.delete()
            fp_close_qs.delete()

            # 3. Delete closing AND system-opening JE lines + JEs via raw SQL.
            # Both are system-generated artifacts of close: closing zeroes P&L,
            # opening carries forward into the next year. Re-running close
            # regenerates BOTH, so leaving the old opening JE behind would
            # collide with the unique constraint AND double-count retained
            # earnings carry-forward.
            close_je_ids = list(JournalEntry.objects.filter(
                **org_filter, journal_type='CLOSING',
            ).values_list('id', flat=True))
            opening_je_ids = list(JournalEntry.objects.filter(
                **org_filter, journal_type='OPENING', journal_role='SYSTEM_OPENING',
            ).values_list('id', flat=True))
            artifact_je_ids = close_je_ids + opening_je_ids
            line_count = 0
            je_count = len(close_je_ids)
            opening_count = len(opening_je_ids)
            if artifact_je_ids:
                with connection.cursor() as c:
                    placeholders = ','.join(['%s'] * len(artifact_je_ids))
                    c.execute(
                        f"DELETE FROM {JournalEntryLine._meta.db_table} "
                        f"WHERE journal_entry_id IN ({placeholders})",
                        artifact_je_ids,
                    )
                    line_count = c.rowcount
                    c.execute(
                        f"DELETE FROM {JournalEntry._meta.db_table} "
                        f"WHERE id IN ({placeholders})",
                        artifact_je_ids,
                    )

            # 4. Wipe all OpeningBalance rows.
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
            f"  - {je_count} closing journal entries deleted\n"
            f"  - {opening_count} system-opening journal entries deleted\n"
            f"  - {line_count} JE lines removed (closing + opening combined)\n"
            f"  - {fy_snap_count} year-close snapshots dropped\n"
            f"  - {fp_snap_count} period-close snapshots dropped\n"
            f"  - {ob_count} opening balances deleted\n"
            f"  - {year_reset} fiscal years reset to OPEN\n"
            f"  - {period_reset} fiscal periods reset to OPEN\n"
            f"\nNext step: re-run year-end close from the UI or via the API."
        ))
