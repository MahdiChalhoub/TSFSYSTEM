"""
Closing — Year-end integrity gate.

Runs immediately before marking a fiscal year FINALIZED. Any failure
raises ValidationError, triggering rollback of the enclosing
transaction.atomic(). Extracted from `closing_service.py` for the
300-line maintainability ceiling. Re-attached to `ClosingService` as a
static method by the facade.
"""
import logging
from decimal import Decimal
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def _assert_close_integrity(organization, fiscal_year, next_year):
    """Reconciliation gate run just before marking the year FINALIZED.
    Any failure raises ValidationError, triggering rollback of the
    enclosing transaction.atomic(). Invariants:
      0. Period-state: zero OPEN periods under a year about to finalize.
      1. Double-entry: ΣDebit = ΣCredit across every POSTED line × scope.
      2. Accounting equation: ΣASSET = ΣLIABILITY + ΣEQUITY per scope.
      3. P&L zeroing: ΣINCOME = 0 AND ΣEXPENSE = 0 per scope.
      4. Contra-equity (clears_at_close=True) sums to 0 per scope.
      5. Closing-chain continuity per BS account (delegated below).
    """
    from apps.finance.models import JournalEntryLine
    from apps.finance.services.closing_service import ClosingService
    from apps.finance.services.closing_chain_continuity import (
        assert_closing_chain_continuity,
    )
    from django.db.models import Sum, Q

    tol = ClosingService._RECON_TOLERANCE

    def _sum_by_type(account_type: str, scope: str) -> Decimal:
        """Net balance (debit - credit) across all accounts of a given
        type, restricted to this fiscal year's scope."""
        agg = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__scope=scope,
            account__type=account_type,
        ).filter(
            Q(journal_entry__fiscal_year=fiscal_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=fiscal_year.start_date,
              journal_entry__transaction_date__date__lte=fiscal_year.end_date)
        ).aggregate(
            d=Sum('debit'), c=Sum('credit'),
        )
        return (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))

    # ── 0. Period-state invariant ──
    # A FINALIZED year must have zero open periods — anything else
    # is a UX lie. Catches cases where the force-close step missed a
    # period (e.g. if a signal or concurrent action reopened one
    # between force-close and finalize).
    from apps.finance.models import FiscalPeriod
    open_periods = list(
        FiscalPeriod.objects.filter(
            fiscal_year=fiscal_year, is_closed=False,
        ).values_list('name', flat=True)
    )
    if open_periods:
        raise ValidationError(
            f"Cannot finalize {fiscal_year.name}: {len(open_periods)} period(s) "
            f"still OPEN ({', '.join(open_periods)}). Force-close step did not "
            f"cover these — rollback triggered, year NOT finalized."
        )

    for scope in ('OFFICIAL', 'INTERNAL'):
        # Double-entry invariant — every JE line pair debits and credits
        # equal amounts, so the global sum across all posted lines in
        # this year-and-scope must be zero. Redundant with the A=L+E
        # check in theory, but surfaces corruption faster (e.g. a
        # manually-written single-sided JE) and simplifies debugging.
        grand = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__scope=scope,
        ).filter(
            Q(journal_entry__fiscal_year=fiscal_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=fiscal_year.start_date,
              journal_entry__transaction_date__date__lte=fiscal_year.end_date)
        ).aggregate(d=Sum('debit'), c=Sum('credit'))
        total_d = grand['d'] or Decimal('0.00')
        total_c = grand['c'] or Decimal('0.00')
        de_diff = (total_d - total_c).copy_abs()
        if de_diff > tol:
            raise ValidationError(
                f"[{scope}] Double-entry invariant violated: "
                f"ΣDebit={total_d}, ΣCredit={total_c}, diff={de_diff}. "
                f"The ledger contains unbalanced journal entries — "
                f"rollback triggered, year NOT finalized."
            )

        assets = _sum_by_type('ASSET', scope)
        liabilities = _sum_by_type('LIABILITY', scope)
        equity = _sum_by_type('EQUITY', scope)
        income = _sum_by_type('INCOME', scope)
        expense = _sum_by_type('EXPENSE', scope)

        # Normal-balance conventions — assets are debit-positive, the
        # others credit-positive. Flip signs so the equation reads in
        # the traditional direction: Assets = Liabilities + Equity.
        # Using absolute values would hide real errors (a negative
        # asset sum means something's inverted and should fail).
        lhs = assets
        rhs = (-liabilities) + (-equity)
        diff = (lhs - rhs).copy_abs()
        if diff > tol:
            raise ValidationError(
                f"[{scope}] Accounting equation failed: "
                f"Assets={lhs}, Liabilities+Equity={rhs}, diff={diff}. "
                f"The closing journal entry did not balance the books — "
                f"rollback triggered, year NOT finalized."
            )

        if income.copy_abs() > tol:
            raise ValidationError(
                f"[{scope}] Income accounts did not zero out after close: "
                f"residual={income}. Check the closing JE for missing "
                f"INCOME account lines — rollback triggered."
            )
        if expense.copy_abs() > tol:
            raise ValidationError(
                f"[{scope}] Expense accounts did not zero out after close: "
                f"residual={expense}. Check the closing JE for missing "
                f"EXPENSE account lines — rollback triggered."
            )

        # Contra-equity (clears_at_close=True) must zero out exactly
        # like P&L — they're swept to RE in the same closing JE. If a
        # draws / dividends-declared account survives the close with
        # non-zero net, the sweep filter missed it and equity will
        # fragment on the opening carry.
        clears_agg = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope=scope,
            account__clears_at_close=True,
        ).filter(
            Q(journal_entry__fiscal_year=fiscal_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=fiscal_year.start_date,
              journal_entry__transaction_date__date__lte=fiscal_year.end_date)
        ).aggregate(d=Sum('debit'), c=Sum('credit'))
        clears_net = (clears_agg['d'] or Decimal('0.00')) - (clears_agg['c'] or Decimal('0.00'))
        if clears_net.copy_abs() > tol:
            raise ValidationError(
                f"[{scope}] Contra-equity (clears_at_close) accounts did not "
                f"zero out after close: residual={clears_net}. The closing JE "
                f"missed a draws/dividends/treasury-stock account — rollback "
                f"triggered, year NOT finalized."
            )

        # ── Parent-account posting invariant ──
        # No journal entry line in this year may target a parent /
        # header account. Parents are pure aggregations of their
        # children; any direct posting to them is a data bug. List
        # every offender so the user can reclassify before retrying.
        from django.db.models import Count as _Count2, Q as _Q2
        from apps.finance.models import ChartOfAccount as _COA_parent
        # Count only ACTIVE children — archived ghosts don't make
        # a parent (consistent with `clean()` and `check_parent_purity`).
        parent_ids = list(
            _COA_parent.objects
            .annotate(n=_Count2('children', filter=_Q2(children__is_active=True)))
            .filter(organization=organization, n__gt=0)
            .values_list('id', flat=True)
        )
        if parent_ids:
            off_rows = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
                account_id__in=parent_ids,
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).values(
                'account_id', 'account__code', 'account__name',
            ).annotate(
                d=Sum('debit'), c=Sum('credit'),
                n_lines=_Count2('id'),
            )
            offenders = []
            for r in off_rows:
                net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                if (net.copy_abs() > tol) or r['n_lines']:
                    offenders.append(
                        f"  {r['account__code']} {r['account__name']}: "
                        f"net={net} across {r['n_lines']} line(s)"
                    )
            if offenders:
                raise ValidationError(
                    f"[{scope}] Parent/header accounts hold direct JE "
                    f"postings — they must be pure aggregations of their "
                    f"children. Reclassify these lines to leaf accounts "
                    f"before closing. Offenders:\n"
                    + "\n".join(offenders)
                )

    # ── Revenue-recognition integrity ──
    # Refuse to finalize while any orphan satisfied obligation,
    # over-recognised row, or significantly overdue straight-line
    # release is present. Getting this wrong misreports revenue on
    # the P&L of the closing year.
    try:
        from apps.finance.services.revenue_recognition_service import (
            RevenueRecognitionService as _RRS,
        )
        rev_rpt = _RRS.check_revenue_recognition_integrity(organization)
    except Exception:
        rev_rpt = {'clean': True, 'overdue_rows': [], 'orphan_obligations': [], 'over_recognised_rows': []}
    if not rev_rpt['clean']:
        lines = []
        for r in rev_rpt.get('overdue_rows', []):
            lines.append(
                f"  overdue: DR#{r['id']} '{r['name']}' lag={r['lag_months']}mo "
                f"(expected={r['expected']}, recognised={r['recognised']})"
            )
        for o in rev_rpt.get('orphan_obligations', []):
            lines.append(
                f"  orphan obligation: PO#{o['id']} '{o['description']}' "
                f"allocation={o['allocation_amount']}"
            )
        for r in rev_rpt.get('over_recognised_rows', []):
            lines.append(
                f"  over-recognised: DR#{r['id']} '{r['name']}' remaining={r['remaining']}"
            )
        if lines:
            raise ValidationError(
                "Revenue-recognition integrity failed — fix before close:\n"
                + "\n".join(lines)
            )

    # ── FX integrity ──
    # If this org runs multi-currency, refuse to finalize while any
    # foreign-currency line is missing an exchange_rate, or while any
    # closed period has foreign-currency activity but no
    # CurrencyRevaluation row. Either condition corrupts the
    # translated balance sheet.
    fx_rpt = ClosingService.check_fx_integrity(organization)
    if not fx_rpt['clean']:
        lines = []
        if fx_rpt.get('stale_rate_lines', 0):
            lines.append(f"  stale-rate lines: {fx_rpt['stale_rate_lines']}")
        for p in fx_rpt.get('missing_revaluation_periods', []):
            lines.append(f"  missing revaluation: period {p['name']} (id={p['fiscal_period_id']})")
        for o in fx_rpt.get('orphaned_revaluations', []):
            lines.append(f"  orphaned revaluation: id={o['revaluation_id']} net={o['net_gain_loss']}")
        if lines:
            raise ValidationError(
                "FX integrity failed — fix before close:\n" + "\n".join(lines)
            )

    # ── Sub-ledger integrity (control accounts) ──
    # Every line on a control account (AR, AP, employee advances)
    # must carry partner identification — otherwise aging, statements,
    # and collection reports silently go wrong. Cross-scope since
    # control accounts can have lines in either. Runs once at the
    # end of the scope loop so both OFFICIAL and INTERNAL surface.
    sub_rpt = ClosingService.check_subledger_integrity(organization)
    if not sub_rpt['clean']:
        offender_lines = []
        for off in sub_rpt['offenders']:
            extra = (
                f" partner_ids={off.get('partner_ids')}"
                if off.get('partner_ids') else ''
            )
            offender_lines.append(
                f"  [{off['scope']}] {off['code']} {off['name']} "
                f"kind={off['kind']}: {off['n_lines']} line(s), "
                f"net={off['net']}{extra}"
            )
        raise ValidationError(
            f"Sub-ledger integrity failed — control-account lines "
            f"missing or orphan partner references. Fix before close:\n"
            + "\n".join(offender_lines)
        )

    # ── Full closing-chain continuity (every BS account) ──
    # Delegated to a focused helper so the orchestrator stays under
    # the 300-line maintainability ceiling.
    assert_closing_chain_continuity(organization, fiscal_year, next_year, tol)
