"""
Closing — Closing-chain continuity helper.

Per-account continuity check between an old year's closing balance and
the next year's opening balance. The strongest correctness invariant
short of replaying every JE — catches missing accounts, wrong amounts,
zero-sum traps, and scope bleed.

Extracted from `_assert_close_integrity` for the 300-line maintainability
ceiling. Module-private to the closing pipeline.
"""
import logging
from decimal import Decimal
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def assert_closing_chain_continuity(organization, fiscal_year, next_year, tol):
    """For every BS account, the old-year closing net must equal the
    new-year opening net per scope. Raises ValidationError on the
    first scope with breaks; the message lists every drifted account.

    Reads from `OpeningBalance` or from POSTED OPENING JE lines based
    on the `USE_JE_OPENING` setting — both paths yield the same per-
    account net under dual-write, so we pick one to avoid double-
    reporting (`validate_opening_ob_vs_je` is the dedicated drift
    check between paths).
    """
    if next_year is None:
        return  # Nothing to reconcile; warning already logged upstream.

    from apps.finance.models import JournalEntryLine, OpeningBalance
    from apps.finance.models import ChartOfAccount as _COA
    from django.conf import settings as _s
    from django.db.models import Sum, Q

    use_je_opening = getattr(_s, 'USE_JE_OPENING', False)

    for scope in ('OFFICIAL', 'INTERNAL'):
        # Old-year closing state per BS account (net = debit - credit)
        # aggregated across all POSTED, non-superseded lines in the
        # year. Filter to BS types since P&L zeros out at close and
        # carries nothing. `clears_at_close=True` accounts were
        # already verified zero above — they'd drop out naturally
        # here too, but we leave them so an unexpected non-zero
        # surfaces as a continuity break rather than a silent ignore.
        close_rows = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope=scope,
            account__type__in=['ASSET', 'LIABILITY', 'EQUITY'],
        ).filter(
            Q(journal_entry__fiscal_year=fiscal_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=fiscal_year.start_date,
              journal_entry__transaction_date__date__lte=fiscal_year.end_date)
        ).values('account_id').annotate(d=Sum('debit'), c=Sum('credit'))
        close_by_acc = {
            r['account_id']: (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
            for r in close_rows
        }

        # New-year opening state per account — source depends on
        # USE_JE_OPENING flag. Both paths produce the same per-account
        # net under dual-write; we only pick one so a drift between
        # them (the job of validate_opening_ob_vs_je) doesn't double-
        # report here.
        if use_je_opening:
            ob_rows = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__fiscal_year=next_year,
                journal_entry__journal_type='OPENING',
                journal_entry__journal_role='SYSTEM_OPENING',
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
            ).values('account_id').annotate(d=Sum('debit'), c=Sum('credit'))
            ob_by_acc = {
                r['account_id']: (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
                for r in ob_rows
            }
        else:
            ob_qs = OpeningBalance.objects.filter(
                organization=organization, fiscal_year=next_year, scope=scope,
            ).values('account_id', 'debit_amount', 'credit_amount')
            ob_by_acc = {
                r['account_id']: (r['debit_amount'] or Decimal('0.00')) - (r['credit_amount'] or Decimal('0.00'))
                for r in ob_qs
            }

        # Per-account drift report — accumulate all violations so the
        # error message surfaces every broken account, not just the
        # first one. Much faster to debug "5 accounts drifted" than
        # "account 1200 drifted → fix → rerun → account 2100 drifted".
        breaks = []
        all_accounts = set(close_by_acc) | set(ob_by_acc)
        for acc_id in all_accounts:
            old_close = close_by_acc.get(acc_id, Decimal('0.00'))
            new_open = ob_by_acc.get(acc_id, Decimal('0.00'))

            # Non-zero closes must match; zero closes that picked up
            # an OB row are also a break (ghost opening with no prior
            # state). Tolerance absorbs rounding-split cents only.
            if (old_close - new_open).copy_abs() > tol:
                breaks.append({
                    'account_id': acc_id,
                    'old_close': old_close,
                    'new_open': new_open,
                    'diff': (old_close - new_open),
                })

        if breaks:
            # Pull codes/names once for readable error text
            acc_ids = [b['account_id'] for b in breaks]
            acc_map = {
                a.id: (a.code, a.name)
                for a in _COA.objects.filter(id__in=acc_ids)
            }
            lines = []
            for b in breaks:
                code, name = acc_map.get(b['account_id'], ('?', '?'))
                lines.append(
                    f"  {code} {name}: close={b['old_close']} "
                    f"open={b['new_open']} diff={b['diff']}"
                )
            raise ValidationError(
                f"[{scope}] Closing-chain continuity failed on "
                f"{len(breaks)} account(s) — rollback triggered, year "
                f"NOT finalized:\n" + "\n".join(lines)
            )
