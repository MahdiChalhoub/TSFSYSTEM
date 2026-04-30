"""
Closing — Opening Balance ↔ JE drift validation and OB rebuild.

Phase-3 dual-read safety net + repair tool. Extracted from
`closing_service.py` for the 300-line maintainability ceiling.
Re-attached to `ClosingService` as static methods by the facade.
"""
import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)


def validate_opening_ob_vs_je(organization, fiscal_year):
    """
    Dual-read validator — Phase 3 safety net. Computes opening balances
    two ways and reports any drift:

      Path A (legacy): sum OpeningBalance rows for (fy, scope)
      Path B (new):   sum JournalEntryLine rows for the OPENING JE
                      of (fy, scope)

    Returns a structured report with per-(account, scope) diffs. Any
    row with |diff| > 1¢ is a drift. Safe to call during production —
    read-only.

    Flow:
      during backfill        → both paths should agree from day one
      during dual-write      → same (both paths populated simultaneously)
      before cutover (Phase 3) → run across all (org, fy) and require
                                 100% zero-drift before flipping the
                                 USE_JE_OPENING flag
    """
    from apps.finance.models import OpeningBalance, JournalEntryLine
    from django.db.models import Sum

    tol = Decimal('0.01')
    report = {
        'fiscal_year_id': fiscal_year.id,
        'fiscal_year_name': fiscal_year.name,
        'scopes': {},
        'has_drift': False,
    }

    for scope in ('OFFICIAL', 'INTERNAL'):
        # Path A — OpeningBalance rows keyed by account
        ob_by_acc: dict[int, Decimal] = {}
        ob_qs = OpeningBalance.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            scope=scope,
        ).select_related('account')
        for ob in ob_qs:
            net = (ob.debit_amount or Decimal('0.00')) - (ob.credit_amount or Decimal('0.00'))
            ob_by_acc[ob.account_id] = net

        # Path B — active SYSTEM_OPENING JE lines for this (fy, scope).
        # - POSTED + not superseded: exclude historical versions
        # - journal_role='SYSTEM_OPENING': exclude user-entered
        #   capital-injection / manual opening entries. Those are
        #   legitimate journal_type='OPENING' but represent user
        #   activity, not the system's authoritative carry-forward
        #   from the prior year close. The OB table mirrors only the
        #   carry-forward, so only system rows are comparable.
        je_by_acc: dict[int, Decimal] = {}
        je_lines = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__fiscal_year=fiscal_year,
            journal_entry__scope=scope,
            journal_entry__journal_type='OPENING',
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__journal_role='SYSTEM_OPENING',
        ).values('account_id').annotate(
            d=Sum('debit'), c=Sum('credit'),
        )
        for row in je_lines:
            je_by_acc[row['account_id']] = (row['d'] or Decimal('0.00')) - (row['c'] or Decimal('0.00'))

        # Diff: union of keys, report any account where abs(A - B) > tol
        drifts = []
        all_accounts = set(ob_by_acc) | set(je_by_acc)
        for acc_id in all_accounts:
            a = ob_by_acc.get(acc_id, Decimal('0.00'))
            b = je_by_acc.get(acc_id, Decimal('0.00'))
            diff = (a - b).copy_abs()
            if diff > tol:
                drifts.append({
                    'account_id': acc_id,
                    'ob_net': a,
                    'je_net': b,
                    'diff': diff,
                })

        # Accounting equation sanity on each path (should be 0)
        sum_ob = sum(ob_by_acc.values(), Decimal('0.00'))
        sum_je = sum(je_by_acc.values(), Decimal('0.00'))

        # Account coverage — a balance match isn't enough; a missing
        # account on either side can net to zero while hiding real
        # data loss (e.g. OB has A=0 and JE has B=+100/C=-100 → sum
        # still 0 but account set differs). Track membership diffs
        # explicitly.
        only_in_ob = sorted(set(ob_by_acc) - set(je_by_acc))
        only_in_je = sorted(set(je_by_acc) - set(ob_by_acc))

        report['scopes'][scope] = {
            'ob_accounts': len(ob_by_acc),
            'je_accounts': len(je_by_acc),
            'drifts': drifts,
            'ob_sum': sum_ob,
            'je_sum': sum_je,
            'ob_balanced': sum_ob.copy_abs() <= tol,
            'je_balanced': sum_je.copy_abs() <= tol,
            'only_in_ob': only_in_ob,
            'only_in_je': only_in_je,
            'coverage_match': not only_in_ob and not only_in_je,
        }
        if (drifts or only_in_ob or only_in_je
            or not (sum_ob.copy_abs() <= tol)
            or not (sum_je.copy_abs() <= tol)):
            report['has_drift'] = True

    return report


def rebuild_ob_from_je(organization, fiscal_year, user=None):
    """
    Rebuild OpeningBalance rows from the authoritative OPENING JE lines
    for a single fiscal year. Use this — NOT the reverse — to repair
    drift: JE is the source of truth after Phase 2, OB is the legacy
    derived view that must follow.

    Deletes all existing OB rows for this fiscal_year (both scopes)
    and recreates them from the current POSTED OPENING JE lines.
    No-op (but reported) for years with no OPENING JE.

    Idempotent — safe to run repeatedly. Returns a dict report.
    """
    from apps.finance.models import JournalEntryLine, JournalEntry, OpeningBalance
    from django.db.models import Sum

    report = {
        'fiscal_year_id': fiscal_year.id,
        'fiscal_year_name': fiscal_year.name,
        'scopes_rebuilt': 0,
        'rows_written': 0,
        'rows_deleted': 0,
        'skipped_reason': None,
    }

    # Ensure an active SYSTEM_OPENING JE exists for at least one
    # scope — otherwise we'd wipe OB without an authoritative
    # carry-forward to replace it with.
    je_exists = JournalEntry.objects.filter(
        organization=organization,
        fiscal_year=fiscal_year,
        journal_type='OPENING',
        journal_role='SYSTEM_OPENING',
        status='POSTED',
        is_superseded=False,
    ).exists()
    if not je_exists:
        report['skipped_reason'] = 'no POSTED OPENING JE to rebuild from — close the prior year first'
        return report

    with transaction.atomic():
        # Lock the FY row to serialize with concurrent backfill runs.
        from apps.finance.models import FiscalYear
        FiscalYear.objects.select_for_update().get(pk=fiscal_year.pk)

        # Wipe existing OB rows for this year (both scopes) — we'll
        # rebuild them fully from JE data below. Deletion is safe
        # because OpeningBalance has no downstream FK dependents.
        deleted, _ = OpeningBalance.objects.filter(
            organization=organization, fiscal_year=fiscal_year,
        ).delete()
        report['rows_deleted'] = deleted

        for scope in ('OFFICIAL', 'INTERNAL'):
            # Aggregate active SYSTEM_OPENING JE lines by account.
            # OB mirrors only the authoritative carry-forward — user-
            # entered capital injections (journal_role=USER_GENERAL)
            # are 2026 activity, not a representation of year-end
            # state. Including them would pollute OB with amounts
            # that didn't exist at prior-year close.
            lines = (
                JournalEntryLine.objects
                .filter(
                    journal_entry__organization=organization,
                    journal_entry__fiscal_year=fiscal_year,
                    journal_entry__journal_type='OPENING',
                    journal_entry__journal_role='SYSTEM_OPENING',
                    journal_entry__status='POSTED',
                    journal_entry__is_superseded=False,
                    journal_entry__scope=scope,
                )
                .values('account_id')
                .annotate(d=Sum('debit'), c=Sum('credit'))
            )
            for row in lines:
                debit = row['d'] or Decimal('0.00')
                credit = row['c'] or Decimal('0.00')
                if debit == Decimal('0.00') and credit == Decimal('0.00'):
                    continue
                OpeningBalance.objects.create(
                    organization=organization,
                    account_id=row['account_id'],
                    fiscal_year=fiscal_year,
                    scope=scope,
                    debit_amount=debit,
                    credit_amount=credit,
                    source='TRANSFER',
                    created_by=user,
                    notes=f'Rebuilt from OPENING JE ({scope})',
                )
                report['rows_written'] += 1
            report['scopes_rebuilt'] += 1

    logger.info(
        f"ClosingService.rebuild_ob_from_je: {fiscal_year.name} — "
        f"deleted {report['rows_deleted']}, wrote {report['rows_written']} "
        f"across {report['scopes_rebuilt']} scopes."
    )
    return report
