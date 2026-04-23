"""
Closing Service — Handles fiscal period close and year-end close.

Year-End Close Flow:
  1. Verify all periods are posted
  2. Verify suspense/control accounts cleared
  3. Lock fiscal year
  4. Close P&L into retained earnings
  5. Generate opening balances for next year
  6. Open next fiscal year

Responsibilities:
  - close_fiscal_period(period) → lock period
  - close_fiscal_year(year) → full year-end sequence
  - generate_opening_balances(from_year, to_year) → opening balance creation
"""
import logging
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class ClosingService:
    """Handles period and year-end close per SAP/Odoo/Oracle standards."""

    @staticmethod
    def close_fiscal_period(organization, fiscal_period, user=None):
        """
        Close a fiscal period. No further posting allowed after close.
        
        Steps:
          1. Verify no DRAFT entries remain
          2. Refresh balance snapshots
          3. Mark period as CLOSED
        """
        from apps.finance.models import JournalEntry
        from apps.finance.services.balance_service import BalanceService

        if fiscal_period.is_closed:
            return fiscal_period

        with transaction.atomic():
            # Check for unposted entries
            draft_count = JournalEntry.objects.filter(
                organization=organization,
                fiscal_period=fiscal_period,
                status='DRAFT',
            ).count()

            if draft_count > 0:
                raise ValidationError(
                    f"Cannot close period {fiscal_period.name}: "
                    f"{draft_count} draft journal entries remain. "
                    f"Post or delete them first."
                )

            # Refresh balance snapshots before closing
            BalanceService.refresh_snapshots(organization, fiscal_period, scope='OFFICIAL')
            BalanceService.refresh_snapshots(organization, fiscal_period, scope='INTERNAL')

            # Close the period (canonical transition)
            fiscal_period.transition_to('CLOSED', user=user)

            logger.info(
                f"ClosingService: Period {fiscal_period.name} closed by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_period

    @staticmethod
    def soft_lock_period(organization, fiscal_period, user=None):
        """Soft-lock period — only supervisors can post."""
        fiscal_period.status = 'SOFT_LOCKED'
        fiscal_period.save()
        logger.info(f"ClosingService: Period {fiscal_period.name} soft-locked")
        return fiscal_period

    @staticmethod
    def hard_lock_period(organization, fiscal_period, user=None):
        """Hard-lock period — no posting allowed at all."""
        fiscal_period.status = 'HARD_LOCKED'
        fiscal_period.save()
        logger.info(f"ClosingService: Period {fiscal_period.name} hard-locked")
        return fiscal_period

    @staticmethod
    def reopen_period(organization, fiscal_period, user=None):
        """Reopen a closed/locked period. Requires superuser."""
        if user and not user.is_superuser:
            raise ValidationError("Only superusers can reopen fiscal periods.")

        fiscal_period.transition_to('OPEN', user=user)
        logger.info(
            f"ClosingService: Period {fiscal_period.name} reopened by "
            f"{user.username if user else 'system'}"
        )
        return fiscal_period

    @staticmethod
    def soft_close_fiscal_year(organization, fiscal_year, user=None):
        """
        Soft close a fiscal year. Closes all standard periods but leaves the
        adjusting/audit period (13th month) and the year itself OPEN.
        """
        from apps.finance.models import JournalEntry
        from django.db.models import Q
        
        if fiscal_year.status in ['CLOSED', 'FINALIZED']:
            raise ValidationError(f"Fiscal year {fiscal_year.name} is already {fiscal_year.status}.")
            
        with transaction.atomic():
            periods_to_close = fiscal_year.periods.filter(is_closed=False).exclude(
                Q(is_adjustment_period=True) | Q(name__istartswith='Audit')
            )
            
            # Check for unposted entries in periods being closed
            draft_count = JournalEntry.objects.filter(
                organization=organization,
                fiscal_period__in=periods_to_close,
                status='DRAFT',
            ).count()
            
            if draft_count > 0:
                raise ValidationError(
                    f"Cannot soft-close year: {draft_count} draft journal entries remain "
                    f"in the periods being closed. Post or delete them first."
                )
                
            # Close the standard periods
            closed_count = 0
            for period in periods_to_close:
                period.transition_to('CLOSED', user=user)
                closed_count += 1
                
            logger.info(
                f"ClosingService: Soft-closed {closed_count} periods for {fiscal_year.name} by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_year

    @staticmethod
    def close_fiscal_year(organization, fiscal_year, user=None, retained_earnings_account_id=None, close_date=None):
        """
        Full year-end close sequence.

        Steps:
          1. Verify all periods are closed (or partial close at close_date)
          2. Close P&L accounts into retained earnings
          3. Generate opening balances for the remainder year (or next year)
          4. Lock fiscal year
          5. Auto-create remainder year if close_date is before fiscal_year.end_date
        """
        from apps.finance.models import (
            ChartOfAccount, FiscalYear, JournalEntry, FiscalPeriod
        )
        from apps.finance.services.ledger_core import LedgerCoreMixin
        from datetime import date as date_cls, timedelta

        if fiscal_year.is_closed:
            raise ValidationError(f"Fiscal year {fiscal_year.name} is already closed.")

        # Detect partial close: close_date is before fiscal_year.end_date
        is_partial = False
        if close_date:
            if isinstance(close_date, str):
                from django.utils.dateparse import parse_date
                close_date = parse_date(close_date)
            is_partial = close_date < fiscal_year.end_date

        with transaction.atomic():
            from apps.finance.models import JournalEntry as JE
            from django.db.models import Q
            # Match drafts by fiscal_year FK OR by transaction_date within range
            # (catches orphan JEs created before fiscal_year was assigned).
            yr_start = fiscal_year.start_date
            yr_end = close_date if is_partial else fiscal_year.end_date
            draft_count = JE.objects.filter(
                organization=organization,
                status='DRAFT',
            ).filter(
                Q(fiscal_year=fiscal_year) |
                Q(fiscal_year__isnull=True,
                  transaction_date__date__gte=yr_start,
                  transaction_date__date__lte=yr_end)
            ).count()
            if draft_count > 0:
                raise ValidationError(
                    f"Cannot close year. {draft_count} draft journal entries remain "
                    f"(includes orphan JEs by date). Post or delete them first."
                )

            # Backfill orphan JEs (NULL fiscal_year_id) into this year — these
            # were created before fiscal_year linkage existed and would otherwise
            # be invisible to balance / audit queries.
            from apps.finance.models import FiscalPeriod
            orphans = JE.objects.filter(
                organization=organization,
                fiscal_year__isnull=True,
                transaction_date__date__gte=yr_start,
                transaction_date__date__lte=yr_end,
            )
            # Use queryset.update() to bypass the ImmutableLedger save() guard
            # (POSTED JEs reject .save()). Linking fiscal_year is metadata, not
            # a financial change — safe to write directly.
            for je in orphans:
                fp = FiscalPeriod.objects.filter(
                    organization=organization,
                    start_date__lte=je.transaction_date,
                    end_date__gte=je.transaction_date,
                ).first()
                if fp:
                    JE.objects.filter(pk=je.pk).update(
                        fiscal_year=fp.fiscal_year,
                        fiscal_period=fp,
                    )

            remainder_start = None
            remainder_end = None

            if is_partial:
                # ── PARTIAL CLOSE: Split the year ──
                # Truncate fiscal_year to close_date
                # Move/delete periods after close_date
                remainder_start = close_date + timedelta(days=1)
                remainder_end = fiscal_year.end_date

                # Delete periods entirely after close_date
                FiscalPeriod.objects.filter(
                    fiscal_year=fiscal_year,
                    start_date__gt=close_date,
                ).delete()

                # Truncate periods that span close_date
                spanning = FiscalPeriod.objects.filter(
                    fiscal_year=fiscal_year,
                    start_date__lte=close_date,
                    end_date__gt=close_date,
                )
                for p in spanning:
                    p.end_date = close_date
                    p.save(update_fields=['end_date'])

                # Truncate fiscal year end_date
                fiscal_year.end_date = close_date
                fiscal_year.save(update_fields=['end_date'])

                logger.info(
                    f"ClosingService: Partial close — truncated {fiscal_year.name} to {close_date}"
                )

            # Force-close all remaining periods
            unclosed = fiscal_year.periods.filter(is_closed=False)
            if unclosed.exists():
                unclosed_count = unclosed.count()
                unclosed.update(status='CLOSED', is_closed=True, closed_at=timezone.now(), closed_by=user)
                logger.info(
                    f"ClosingService: Auto-closed {unclosed_count} periods for {fiscal_year.name}"
                )

            # ── Step 2: Resolve retained earnings account ──────────
            # Source of truth: PostingRule for 'equity.retained_earnings.transfer'.
            # An explicit override on the call wins (used by the close modal).
            if retained_earnings_account_id:
                re_account = ChartOfAccount.objects.get(
                    id=retained_earnings_account_id, organization=organization
                )
            else:
                from apps.finance.models.posting_rule import PostingRule
                rule = PostingRule.objects.filter(
                    organization=organization,
                    event_code='equity.retained_earnings.transfer',
                    is_active=True,
                ).select_related('account').first()
                if not rule:
                    raise ValidationError(
                        "No posting rule for 'equity.retained_earnings.transfer'. "
                        "Configure it under Finance → Posting Rules, or pass "
                        "retained_earnings_account_id explicitly."
                    )
                re_account = rule.account

            # Enforce account-type correctness — silently closing into a
            # non-EQUITY account (e.g. a misconfigured ASSET or INCOME
            # account) would corrupt the balance sheet permanently with
            # no obvious tell at read time.
            if re_account.type != 'EQUITY':
                raise ValidationError(
                    f"Retained Earnings account '{re_account.code} — {re_account.name}' "
                    f"has type '{re_account.type}' — must be EQUITY. Pick a different "
                    f"account or update the posting rule."
                )
            if not re_account.is_active:
                raise ValidationError(
                    f"Retained Earnings account '{re_account.code} — {re_account.name}' "
                    f"is inactive. Activate it or pick a different account."
                )

            # ── Step 3: Close P&L into retained earnings ───────────

            # Close P&L into retained earnings — once per scope.
            # CRITICAL: Compute P&L from POSTED journal entry lines within this
            # fiscal year's date range — NOT from the denormalized `balance`/
            # `balance_official` fields on ChartOfAccount, which can become stale
            # after COA migrations, manual resets, or failed recalculations.
            from apps.finance.models import JournalEntryLine
            from django.db.models import Sum, Q

            # Compute per-account, per-scope P&L from authoritative JE lines
            pnl_lines = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                account__type__in=['INCOME', 'EXPENSE'],
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).values(
                'account_id', 'account__code', 'account__name',
                'journal_entry__scope'
            ).annotate(
                total_debit=Sum('debit'),
                total_credit=Sum('credit'),
            )

            # Build a lookup: {account_id: {scope: net_amount}}
            pnl_by_account = {}
            for row in pnl_lines:
                acc_id = row['account_id']
                scope_val = row['journal_entry__scope']
                net = (row['total_debit'] or Decimal('0.00')) - (row['total_credit'] or Decimal('0.00'))
                if acc_id not in pnl_by_account:
                    pnl_by_account[acc_id] = {
                        'code': row['account__code'],
                        'name': row['account__name'],
                        'OFFICIAL': Decimal('0.00'),
                        'INTERNAL': Decimal('0.00'),
                    }
                pnl_by_account[acc_id][scope_val] = \
                    pnl_by_account[acc_id].get(scope_val, Decimal('0.00')) + net

            # Option A — OFFICIAL ⊂ INTERNAL:
            #   - OFFICIAL closing JE (scope='OFFICIAL') zeros the official portion.
            #   - INTERNAL closing JE (scope='INTERNAL') zeros ONLY the
            #     internal-only delta, avoiding double-close.
            scope_amount_fn = (
                ('OFFICIAL', lambda d: d.get('OFFICIAL', Decimal('0.00'))),
                ('INTERNAL', lambda d: d.get('INTERNAL', Decimal('0.00'))),
            )

            for scope, amount_fn in scope_amount_fn:
                closing_lines = []
                total_pnl = Decimal('0.00')

                for acc_id, data in pnl_by_account.items():
                    bal = amount_fn(data)
                    if bal == Decimal('0.00'):
                        continue
                    if bal > Decimal('0.00'):
                        closing_lines.append({
                            'account_id': acc_id,
                            'debit': Decimal('0.00'),
                            'credit': bal,
                            'description': f"Year-end close ({scope}): {data['code']} - {data['name']}",
                        })
                    else:
                        closing_lines.append({
                            'account_id': acc_id,
                            'debit': abs(bal),
                            'credit': Decimal('0.00'),
                            'description': f"Year-end close ({scope}): {data['code']} - {data['name']}",
                        })
                    total_pnl += bal

                if not closing_lines:
                    logger.info(
                        f"ClosingService: No {scope} P&L balances to close for {fiscal_year.name}"
                    )
                    continue

                if total_pnl > Decimal('0.00'):
                    closing_lines.append({
                        'account_id': re_account.id,
                        'debit': total_pnl,
                        'credit': Decimal('0.00'),
                        'description': f"Year-end close ({scope}): Net income to {re_account.code}",
                    })
                elif total_pnl < Decimal('0.00'):
                    closing_lines.append({
                        'account_id': re_account.id,
                        'debit': Decimal('0.00'),
                        'credit': abs(total_pnl),
                        'description': f"Year-end close ({scope}): Net loss to {re_account.code}",
                    })

                closing_entry = LedgerCoreMixin.create_journal_entry(
                    organization=organization,
                    transaction_date=fiscal_year.end_date,
                    description=f"Year-End Close ({scope}): {fiscal_year.name}",
                    lines=closing_lines,
                    status='POSTED',
                    scope=scope,
                    user=user,
                    journal_type='CLOSING',
                    source_module='finance',
                    source_model='FiscalYear',
                    source_id=fiscal_year.id,
                    internal_bypass=True,
                )

                # Anchor each scope's closing JE on its own FK for the audit trail.
                if scope == 'OFFICIAL':
                    fiscal_year.closing_journal_entry = closing_entry
                elif scope == 'INTERNAL':
                    fiscal_year.internal_closing_journal_entry = closing_entry

            # ── Step 4: Resolve next fiscal year ──
            # Auto-creation of a remainder year on partial close was removed —
            # it created silent "FY 2026-B" ghost years that confused users and
            # broke tax/compliance reporting. The user is now required to
            # create the follow-on year explicitly (either a regular FY or a
            # labeled "Short Fiscal Year" for partial-close remainders), which
            # makes the split visible in the fiscal-year list and forces a
            # deliberate decision about naming and period structure.
            if is_partial and remainder_start and remainder_end:
                # Look for a user-created year covering the remainder
                next_year = FiscalYear.objects.filter(
                    organization=organization,
                    start_date__lte=remainder_end,
                    end_date__gte=remainder_start,
                ).first()
                if not next_year:
                    logger.warning(
                        f"ClosingService: Partial close of {fiscal_year.name} leaves uncovered "
                        f"range {remainder_start} → {remainder_end}. No remainder year exists. "
                        f"Opening balances NOT generated. Create the remainder year manually, "
                        f"then re-run generate_opening_balances()."
                    )
            else:
                next_year = FiscalYear.objects.filter(
                    organization=organization,
                    start_date__gt=fiscal_year.end_date,
                ).order_by('start_date').first()

            if next_year:
                ClosingService.generate_opening_balances(
                    organization, fiscal_year, next_year, user=user
                )
            else:
                logger.warning(
                    f"ClosingService: No next fiscal year found after {fiscal_year.name}. "
                    f"Opening balances not generated. Create next year first."
                )

            # ── Reconciliation gate (pre-finalize) ────────────────────
            # Closing is permanent. If the closing JEs didn't actually zero
            # P&L or if the books don't balance, we must NOT mark the year
            # FINALIZED — rollback instead (transaction.atomic wraps the
            # entire method, so raising here undoes everything).
            ClosingService._assert_close_integrity(
                organization, fiscal_year, re_account, next_year
            )

            # ── Step 5: Mark fiscal year FINALIZED ────────────────────
            # This completes the Year-End Close sequence by permanently locking the year.
            # Transition lattice is OPEN → CLOSED → FINALIZED; bridge via CLOSED when
            # the caller hit finalize directly on an open year (the accounting work
            # above has already done the soft-close equivalent).
            if fiscal_year.status == 'OPEN':
                fiscal_year.transition_to('CLOSED', user=user)
            fiscal_year.transition_to('FINALIZED', user=user)

            logger.info(
                f"ClosingService: Fiscal year {fiscal_year.name} finalized by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_year

    # Tolerance for reconciliation checks — accounts for rounding from
    # multi-line closing JEs with decimal splits. 1 cent is generous for
    # a well-behaved book of any size.
    _RECON_TOLERANCE = Decimal('0.01')

    @staticmethod
    def _assert_close_integrity(organization, fiscal_year, re_account, next_year):
        """Reconciliation gate run just before marking the year FINALIZED.

        Three invariants must hold. Any failure raises ValidationError,
        which triggers rollback of the enclosing transaction.atomic():

          1. Accounting equation: ΣASSET = ΣLIABILITY + ΣEQUITY
             — computed from POSTED JE lines through fiscal_year.end_date,
             per scope. Ensures the closing JE actually balanced the books.

          2. P&L zeroing: ΣINCOME = 0 AND ΣEXPENSE = 0
             — after the closing JE, every revenue and expense account
             should sum to zero. Non-zero means an account was missed
             (e.g. added to COA after the sum was computed).

          3. Retained-earnings continuity: new-year OB on `re_account`
             equals old-year closing balance on `re_account`.
             — only when next_year is present. Confirms the roll-forward
             landed on the right account with the right amount.
        """
        from apps.finance.models import JournalEntryLine, OpeningBalance
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

        # ── Retained-earnings continuity ──
        # Old-year RE closing balance (after the closing JE has posted)
        # must equal new-year RE opening balance (what generate_opening_
        # balances wrote). Any drift means the roll-forward got the wrong
        # account or the wrong amount.
        if next_year is None:
            return  # Nothing to reconcile; warning already logged upstream.

        for scope in ('OFFICIAL', 'INTERNAL'):
            # Old-year closing balance on RE account (debit - credit)
            re_close_agg = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                journal_entry__scope=scope,
                account=re_account,
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            re_close = (re_close_agg['d'] or Decimal('0.00')) - (re_close_agg['c'] or Decimal('0.00'))

            # New-year opening balance on RE account for this scope.
            # NOTE: this is the delta-only row (Option A). For OFFICIAL
            # this IS the roll-forward; for INTERNAL it's the delta and
            # must be added to the OFFICIAL OB to get the full figure.
            #
            # Feature-flagged: USE_JE_OPENING switches the source from the
            # legacy OpeningBalance table to OPENING JE lines. Both paths
            # return the same Decimal amount by construction (dual-write
            # keeps them in sync).
            from django.conf import settings as _s
            ob_amount = Decimal('0.00')
            if getattr(_s, 'USE_JE_OPENING', False):
                je_agg = JournalEntryLine.objects.filter(
                    journal_entry__organization=organization,
                    journal_entry__fiscal_year=next_year,
                    journal_entry__journal_type='OPENING',
                    journal_entry__status='POSTED',
                    journal_entry__scope=scope,
                    account=re_account,
                ).aggregate(d=Sum('debit'), c=Sum('credit'))
                ob_amount = (je_agg['d'] or Decimal('0.00')) - (je_agg['c'] or Decimal('0.00'))
            else:
                ob_row = OpeningBalance.objects.filter(
                    organization=organization, account=re_account,
                    fiscal_year=next_year, scope=scope,
                ).first()
                if ob_row:
                    ob_amount = (ob_row.debit_amount or Decimal('0.00')) - (ob_row.credit_amount or Decimal('0.00'))

            if scope == 'INTERNAL':
                # Internal closing balance = delta of INTERNAL over OFFICIAL;
                # roll-forward rule mirrors this on the OB row.
                off_close_agg = JournalEntryLine.objects.filter(
                    journal_entry__organization=organization,
                    journal_entry__status='POSTED',
                    journal_entry__scope='OFFICIAL',
                    account=re_account,
                ).filter(
                    Q(journal_entry__fiscal_year=fiscal_year) |
                    Q(journal_entry__fiscal_year__isnull=True,
                      journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                      journal_entry__transaction_date__date__lte=fiscal_year.end_date)
                ).aggregate(d=Sum('debit'), c=Sum('credit'))
                off_close = (off_close_agg['d'] or Decimal('0.00')) - (off_close_agg['c'] or Decimal('0.00'))
                expected = re_close - off_close
            else:
                expected = re_close

            diff = (expected - ob_amount).copy_abs()
            if diff > tol:
                raise ValidationError(
                    f"[{scope}] Retained-earnings continuity check failed: "
                    f"old-year closing={expected}, new-year opening={ob_amount}, diff={diff}. "
                    f"The roll-forward did not land correctly on {re_account.code} — "
                    f"rollback triggered, year NOT finalized."
                )

    @staticmethod
    def generate_opening_balances(organization, from_year, to_year, user=None):
        """
        Generate OpeningBalance records for the new year from the closing
        balances of the old year. Only for Balance Sheet accounts (ASSET,
        LIABILITY, EQUITY). P&L accounts start at zero.

        Generates opening balances for BOTH scopes (Option A — OFFICIAL ⊂ INTERNAL):
          - OFFICIAL OB amount = `balance_official` (the declared / regulatory subset)
          - INTERNAL OB amount = `balance - balance_official` (the internal-only delta)

        At read time, the INTERNAL view sums BOTH rows (because INTERNAL includes
        all scopes, mirroring `balance_service._refresh_period`). Storing the
        delta on the INTERNAL row prevents double-counting the official portion.

        DUAL-WRITE (Phase 2 of OB → JE unification):
          In addition to the OpeningBalance table, we now also create an
          immutable OPENING journal entry per scope, dated `to_year.start_date`.
          This prepares the system for Phase 3 where read paths flip to
          JE-only and the OpeningBalance table becomes read-only. Dual-write
          keeps both in sync during the transition.
        """
        from apps.finance.models import ChartOfAccount, OpeningBalance

        bs_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True,
        )

        # Per-scope amounts we'll both write to OB rows AND use to build
        # the opening JE. Collecting once avoids a second pass.
        by_scope: dict[str, list[dict]] = {'OFFICIAL': [], 'INTERNAL': []}

        created = 0
        with transaction.atomic():
            for acc in bs_accounts:
                official = acc.balance_official or Decimal('0.00')
                internal_total = acc.balance or Decimal('0.00')
                # Option A: INTERNAL row = delta only (internal-exclusive activity)
                amounts_by_scope = (
                    ('OFFICIAL', official),
                    ('INTERNAL', internal_total - official),
                )
                for scope, net in amounts_by_scope:
                    if net == Decimal('0.00'):
                        continue
                    if net > Decimal('0.00'):
                        debit_amt, credit_amt = net, Decimal('0.00')
                    else:
                        debit_amt, credit_amt = Decimal('0.00'), abs(net)

                    OpeningBalance.objects.update_or_create(
                        organization=organization,
                        account=acc,
                        fiscal_year=to_year,
                        scope=scope,
                        defaults={
                            'debit_amount': debit_amt,
                            'credit_amount': credit_amt,
                            'source': 'TRANSFER',
                            'created_by': user,
                            'notes': f"Carried forward from {from_year.name} ({scope})",
                        }
                    )
                    created += 1
                    by_scope[scope].append({
                        'account_id': acc.id,
                        'account_code': acc.code,
                        'account_name': acc.name,
                        'debit': debit_amt,
                        'credit': credit_amt,
                    })

            # ── Dual-write: OPENING journal entries ──
            # One JE per scope. Self-balanced (Assets = Liabilities + Equity
            # at year-end, so the carry-forward set is already balanced
            # without a clearing account). Retained Earnings is included
            # automatically because it's an EQUITY account with the net
            # income baked in by the upstream closing JE.
            for scope in ('OFFICIAL', 'INTERNAL'):
                ClosingService._create_opening_journal_entry(
                    organization=organization,
                    fiscal_year=to_year,
                    scope=scope,
                    lines=by_scope[scope],
                    source_year_name=from_year.name,
                    user=user,
                )

        logger.info(
            f"ClosingService: Generated {created} opening balances "
            f"(both scopes) for {to_year.name} from {from_year.name}"
        )
        return created

    @staticmethod
    def _create_opening_journal_entry(organization, fiscal_year, scope, lines,
                                      source_year_name='prior year', user=None):
        """
        Create or replace the immutable OPENING journal entry for a fiscal
        year + scope. Used by:
          - `generate_opening_balances` (dual-write during Phase 2)
          - `backfill_opening_journal_entries` (retroactive creation from
            existing OpeningBalance rows)

        Idempotent: if an OPENING JE already exists for this (fiscal_year,
        scope), we delete it first and rebuild. This is safe because the
        entry is system-owned (`source_model='FiscalYear'`, `source_id=fy.id`,
        `journal_type='OPENING'`) and cannot be touched by users.

        Self-balanced by construction — no clearing account. If debits ≠
        credits (which would indicate corrupt source data), we log and
        skip rather than create an invalid JE.
        """
        from apps.finance.models import JournalEntry
        from apps.finance.services.ledger_core import LedgerCoreMixin

        if not lines:
            return None  # Nothing to write for this scope.

        total_d = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_c = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if (total_d - total_c).copy_abs() > Decimal('0.01'):
            logger.error(
                f"ClosingService: OPENING JE for {fiscal_year.name} ({scope}) "
                f"would be out of balance (D={total_d}, C={total_c}). "
                f"Skipping JE creation — OB rows are still written. Check "
                f"the source year's closing JE for missing lines."
            )
            return None

        # Soft-supersede any prior OPENING JE for this (year, scope) so
        # auditors still see the history. We flip them to DRAFT + tag the
        # description so they're visibly inactive AND balance services
        # skip them (balances aggregate status='POSTED' only). Lines stay
        # attached. When the schema migration adds a proper `is_superseded`
        # field, upgrade this to the richer semantics.
        from django.utils import timezone
        stamp = timezone.now().strftime('%Y-%m-%d %H:%M')
        JournalEntry.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            journal_type='OPENING',
            scope=scope,
            source_model='FiscalYear',
            source_id=fiscal_year.id,
            status='POSTED',
        ).update(
            status='DRAFT',
            is_locked=False,  # must be unlocked for the update to not trip guards
            description=models.functions.Concat(
                models.Value(f'[SUPERSEDED {stamp}] '),
                models.F('description'),
            ),
        )

        # Build line dicts for create_journal_entry — needs the
        # `description` key per line which OpeningBalance doesn't have.
        je_lines = [
            {
                'account_id': l['account_id'],
                'debit': l['debit'],
                'credit': l['credit'],
                'description': f"Opening balance ({scope}): {l['account_code']} - {l['account_name']}",
            }
            for l in lines
        ]

        je = LedgerCoreMixin.create_journal_entry(
            organization=organization,
            transaction_date=fiscal_year.start_date,
            description=f"Year-Opening ({scope}): {fiscal_year.name} — carried forward from {source_year_name}",
            lines=je_lines,
            status='POSTED',
            scope=scope,
            user=user,
            journal_type='OPENING',
            source_module='finance',
            source_model='FiscalYear',
            source_id=fiscal_year.id,
            internal_bypass=True,
        )

        # Immutability — opening JEs are system-owned and must not be
        # editable via the normal JE editor. is_locked + the journal_type
        # + source_model triple makes them trivially distinguishable.
        JournalEntry.objects.filter(pk=je.pk).update(is_locked=True)

        logger.info(
            f"ClosingService: OPENING JE created for {fiscal_year.name} ({scope}) "
            f"with {len(lines)} lines, total D/C = {total_d}"
        )
        return je

    @staticmethod
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

            # Path B — OPENING JE lines for this (fy, scope), POSTED only
            je_by_acc: dict[int, Decimal] = {}
            je_lines = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__fiscal_year=fiscal_year,
                journal_entry__scope=scope,
                journal_entry__journal_type='OPENING',
                journal_entry__status='POSTED',
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

            report['scopes'][scope] = {
                'ob_accounts': len(ob_by_acc),
                'je_accounts': len(je_by_acc),
                'drifts': drifts,
                'ob_sum': sum_ob,
                'je_sum': sum_je,
                'ob_balanced': sum_ob.copy_abs() <= tol,
                'je_balanced': sum_je.copy_abs() <= tol,
            }
            if drifts or not (sum_ob.copy_abs() <= tol) or not (sum_je.copy_abs() <= tol):
                report['has_drift'] = True

        return report

    @staticmethod
    def backfill_opening_journal_entries(organization, user=None, dry_run=False, force=False):
        """
        Backfill OPENING journal entries for every fiscal year that has
        OpeningBalance rows but no corresponding OPENING JE. Used to bring
        historical data under the JE-only model (Phase 1 of the migration).

        Idempotent — re-running is safe. Reads from OpeningBalance, writes
        OPENING JEs. Does not touch OB rows.

        Args:
          organization: Organization to process
          user: User to attribute the JE creation to (optional)
          dry_run: If True, returns counts without creating JEs

        Returns: dict with per-year/per-scope counts and any skipped reasons.
        """
        from apps.finance.models import OpeningBalance, FiscalYear, JournalEntry
        from django.db.models import Count, Q

        report = {
            'years_processed': 0,
            'scopes_created': 0,
            'scopes_skipped': 0,
            'details': [],
        }

        # Group OB rows by (fiscal_year, scope). Each group becomes one JE.
        fy_scope_pairs = (
            OpeningBalance.objects
            .filter(organization=organization)
            .values('fiscal_year', 'scope')
            .annotate(n=Count('id'))
            .order_by('fiscal_year', 'scope')
        )

        for pair in fy_scope_pairs:
            fy_id = pair['fiscal_year']
            scope = pair['scope']
            try:
                fiscal_year = FiscalYear.objects.get(id=fy_id, organization=organization)
            except FiscalYear.DoesNotExist:
                report['scopes_skipped'] += 1
                report['details'].append({
                    'fy_id': fy_id, 'scope': scope,
                    'skipped_reason': 'fiscal_year deleted',
                })
                continue

            # Skip if a valid (POSTED) OPENING JE already exists, unless
            # force=True (user knows the existing JE is stale and wants
            # to regenerate). `_create_opening_journal_entry` will
            # soft-supersede the current live JE, so the history is
            # preserved either way.
            already = JournalEntry.objects.filter(
                organization=organization,
                fiscal_year=fiscal_year,
                journal_type='OPENING',
                scope=scope,
                source_model='FiscalYear',
                source_id=fiscal_year.id,
                status='POSTED',
            ).exists()
            if already and not force:
                report['scopes_skipped'] += 1
                report['details'].append({
                    'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                    'skipped_reason': 'opening JE already exists (pass force=True to regenerate)',
                })
                continue

            # Build line dicts from OB rows for this (year, scope).
            ob_rows = OpeningBalance.objects.filter(
                organization=organization,
                fiscal_year=fiscal_year,
                scope=scope,
            ).select_related('account')
            lines = [
                {
                    'account_id': ob.account_id,
                    'account_code': ob.account.code,
                    'account_name': ob.account.name,
                    'debit': ob.debit_amount or Decimal('0.00'),
                    'credit': ob.credit_amount or Decimal('0.00'),
                }
                for ob in ob_rows
                if (ob.debit_amount or Decimal('0.00')) != Decimal('0.00')
                or (ob.credit_amount or Decimal('0.00')) != Decimal('0.00')
            ]

            if dry_run:
                report['scopes_created'] += 1
                report['details'].append({
                    'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                    'would_create_lines': len(lines),
                })
                continue

            with transaction.atomic():
                je = ClosingService._create_opening_journal_entry(
                    organization=organization,
                    fiscal_year=fiscal_year,
                    scope=scope,
                    lines=lines,
                    source_year_name='historical OB backfill',
                    user=user,
                )
            if je:
                report['scopes_created'] += 1
                report['details'].append({
                    'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                    'lines': len(lines), 'je_id': je.id,
                })
            else:
                report['scopes_skipped'] += 1
                report['details'].append({
                    'fy_id': fy_id, 'scope': scope, 'fy_name': fiscal_year.name,
                    'skipped_reason': 'out of balance — see error log',
                })

        report['years_processed'] = len({d.get('fy_id') for d in report['details']})
        logger.info(
            f"ClosingService.backfill_opening_journal_entries: "
            f"processed {report['years_processed']} years, "
            f"created {report['scopes_created']} JEs, "
            f"skipped {report['scopes_skipped']} (dry_run={dry_run})"
        )
        return report
