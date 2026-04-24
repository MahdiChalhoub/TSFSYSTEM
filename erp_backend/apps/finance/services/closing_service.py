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
        """Reopen a closed/locked period. Requires superuser.

        Hard block: cannot reopen a period whose fiscal year is FINALIZED
        (or hard-locked). Finalization is an irreversible accounting act
        — reopening a period under it would leave the year technically
        closed while allowing new postings, which silently invalidates
        the CLOSING JE's P&L sweep. If the year really needs to be
        amended, the flow is: reverse the CLOSING JE → un-finalize →
        then reopen periods.
        """
        if user and not user.is_superuser:
            raise ValidationError("Only superusers can reopen fiscal periods.")

        fy = fiscal_period.fiscal_year
        if fy and (fy.status == 'FINALIZED' or fy.is_hard_locked):
            raise ValidationError(
                f"Cannot reopen period {fiscal_period.name}: fiscal year "
                f"{fy.name} is FINALIZED. Reverse the closing JE and "
                f"un-finalize the year first."
            )

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

            # Compute per-account, per-scope P&L from authoritative JE lines.
            # Sweep set = INCOME + EXPENSE (the P&L) + any contra-equity
            # account flagged clears_at_close=True (Owner Draws, Dividends
            # Declared, Treasury Stock). The flag is the ONLY safe signal —
            # using type=EQUITY alone would wrongly include Capital and
            # Retained Earnings themselves, zeroing real equity every year.
            pnl_lines = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            ).filter(
                Q(account__type__in=['INCOME', 'EXPENSE'])
                | Q(account__clears_at_close=True)
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
                    journal_role='SYSTEM_CLOSING',
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
                organization, fiscal_year, next_year
            )

            # ── Step 4.5: Capture close snapshot ─────────────────────
            # Immutable trial-balance snapshot per scope. Runs AFTER the
            # integrity gate so we never persist a snapshot of a broken
            # close; the gate raises on failure and the atomic block
            # rolls back everything, including the snapshot row.
            ClosingService._capture_close_snapshot(
                organization, fiscal_year, user=user
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
    def _assert_close_integrity(organization, fiscal_year, next_year):
        """Reconciliation gate run just before marking the year FINALIZED.

        Invariants — any failure raises ValidationError, which triggers
        rollback of the enclosing transaction.atomic():

          0. Period-state invariant: zero OPEN periods under a year about
             to be marked FINALIZED (UX correctness).

          1. Double-entry invariant: ΣDebit = ΣCredit across every POSTED
             line in this year × scope. Catches single-sided JEs.

          2. Accounting equation: ΣASSET = ΣLIABILITY + ΣEQUITY per scope.
             Ensures the closing JE actually balanced the books.

          3. P&L zeroing: ΣINCOME = 0 AND ΣEXPENSE = 0 per scope.
             Non-zero means an account was missed by the close sweep.

          4. Contra-equity zeroing: every `clears_at_close=True` account
             sums to 0 post-close per scope (Owner Draws, Dividends
             Declared, Treasury Stock).

          5. Full closing-chain continuity: for every BS account
             (ASSET / LIABILITY / EQUITY), the old-year closing net
             equals the new-year opening net per scope. Strongest
             invariant — catches missing accounts, wrong amounts,
             account-set mismatches, and scope bleed. Covers RE as
             a special case since RE is type=EQUITY.
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
            from django.db.models import Count as _Count2
            from apps.finance.models import ChartOfAccount as _COA_parent
            parent_ids = list(
                _COA_parent.objects
                .annotate(n=_Count2('children'))
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

        # ── Full closing-chain continuity (every BS account) ──
        # Every balance-sheet account's closing net in FY N must equal its
        # opening net in FY N+1 per scope. This is the strongest possible
        # integrity invariant short of posting every JE — it catches:
        #   • missing accounts in the carry-forward
        #   • wrong amounts (even if RE happens to balance by coincidence)
        #   • account-set mismatches (zero-sum traps)
        #   • scope bleed (OFFICIAL↔INTERNAL misrouting)
        # Previously we only checked RE; a sibling account could drift
        # silently as long as RE itself was right.
        if next_year is None:
            return  # Nothing to reconcile; warning already logged upstream.

        from apps.finance.models import ChartOfAccount as _COA
        from django.conf import settings as _s
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

    @staticmethod
    def _capture_close_snapshot(organization, fiscal_year, user=None):
        """Write one FiscalYearCloseSnapshot row per scope.

        Idempotent via the (fiscal_year, scope) UNIQUE constraint + an
        update_or_create pattern — re-running close_fiscal_year (e.g.
        after a reverse + re-finalize) overwrites the prior snapshot
        with fresh post-integrity-gate state.

        Called AFTER `_assert_close_integrity` so we can trust the
        numbers. Failure here rolls back everything (atomic block), so
        no half-finalized state can leak out.
        """
        from apps.finance.models import (
            JournalEntryLine, FiscalYearCloseSnapshot
        )
        from django.db.models import Sum, Q

        for scope in ('OFFICIAL', 'INTERNAL'):
            # Per-account trial balance for this scope, full BS + P&L.
            # P&L should be zero post-close, but we record it anyway —
            # a non-zero P&L line in the snapshot would be a smoking gun
            # of sweep failure that somehow slipped past the gate.
            rows = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
            ).filter(
                Q(journal_entry__fiscal_year=fiscal_year) |
                Q(journal_entry__fiscal_year__isnull=True,
                  journal_entry__transaction_date__date__gte=fiscal_year.start_date,
                  journal_entry__transaction_date__date__lte=fiscal_year.end_date)
            ).values(
                'account_id', 'account__code', 'account__name',
                'account__type', 'account__system_role',
            ).annotate(d=Sum('debit'), c=Sum('credit'))

            trial = []
            totals = {'ASSET': Decimal('0.00'), 'LIABILITY': Decimal('0.00'),
                      'EQUITY': Decimal('0.00'), 'INCOME': Decimal('0.00'),
                      'EXPENSE': Decimal('0.00')}
            re_value = Decimal('0.00')

            for r in rows:
                d = r['d'] or Decimal('0.00')
                c = r['c'] or Decimal('0.00')
                if d == 0 and c == 0:
                    continue
                net = d - c
                atype = r['account__type']
                totals[atype] = totals.get(atype, Decimal('0.00')) + net
                if r['account__system_role'] == 'RETAINED_EARNINGS':
                    re_value += net
                trial.append({
                    'account_id': r['account_id'],
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': atype,
                    'system_role': r['account__system_role'],
                    'debit': str(d),
                    'credit': str(c),
                    'net': str(net),
                })

            trial.sort(key=lambda x: (x['code'] or '', x['account_id']))

            # P&L should be zero post-close; net_income here is the
            # *pre-close* figure we can reconstruct: -(INCOME + EXPENSE)
            # would all be zero at this point, so pull it from the closing
            # JE itself — it's the line targeting re_account whose amount
            # equals the year's net income.
            closing_je = (
                fiscal_year.closing_journal_entry if scope == 'OFFICIAL'
                else fiscal_year.internal_closing_journal_entry
            )
            net_income = Decimal('0.00')
            if closing_je:
                # Net income is what the closing JE posted to the RE
                # account; signed so positive = profit. RE line is the
                # balancing side, so we read it directly.
                re_lines = closing_je.lines.filter(
                    account__system_role='RETAINED_EARNINGS'
                ).aggregate(d=Sum('debit'), c=Sum('credit'))
                # Closing entry: Dr RE means a loss (RE goes up as a DR,
                # reducing credit balance). Cr RE means profit.
                net_income = (re_lines['c'] or Decimal('0.00')) - (re_lines['d'] or Decimal('0.00'))

            opening_je = None
            if fiscal_year.closed_at:  # proxy for "there was a next year"
                from apps.finance.models import JournalEntry, FiscalYear
                nxt = FiscalYear.objects.filter(
                    organization=organization,
                    start_date__gt=fiscal_year.end_date,
                ).order_by('start_date').first()
                if nxt:
                    opening_je = JournalEntry.objects.filter(
                        organization=organization,
                        fiscal_year=nxt,
                        journal_type='OPENING',
                        journal_role='SYSTEM_OPENING',
                        scope=scope,
                        status='POSTED',
                        is_superseded=False,
                    ).first()

            # Sign totals per normal balance for human-readable reporting:
            # Assets positive when debit-positive, Liab/Equity positive
            # when credit-positive. trial_balance stores raw nets.
            total_assets = totals.get('ASSET', Decimal('0.00'))
            total_liab = -totals.get('LIABILITY', Decimal('0.00'))
            total_equity = -totals.get('EQUITY', Decimal('0.00'))

            FiscalYearCloseSnapshot.objects.update_or_create(
                organization=organization,
                fiscal_year=fiscal_year,
                scope=scope,
                defaults={
                    'closing_journal_entry': closing_je,
                    'opening_journal_entry': opening_je,
                    'total_assets': total_assets,
                    'total_liabilities': total_liab,
                    'total_equity': total_equity,
                    'net_income': net_income,
                    'retained_earnings': -re_value,  # sign as credit-positive
                    'trial_balance': trial,
                    'captured_by': user,
                },
            )

        logger.info(
            f"ClosingService: Close snapshots captured for {fiscal_year.name} "
            f"(OFFICIAL + INTERNAL)"
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
        from apps.finance.models import ChartOfAccount, OpeningBalance, JournalEntryLine
        from django.db.models import Sum, Q

        # Opening balances carry forward only LEAF accounts. Parent /
        # header accounts are pure aggregations of their descendants and
        # must never hold their own opening balance — including them
        # would either double-count (if a child also carries the same
        # amount) or invent balance out of thin air. The `allow_posting`
        # flag is the canonical signal (auto-flipped to False when an
        # account gains children); we also annotate and filter on the
        # live tree shape to survive any stale-flag edge case.
        from django.db.models import Count as _Count
        bs_accounts = ChartOfAccount.objects.annotate(
            _n_children=_Count('children'),
        ).filter(
            organization=organization,
            type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True,
            allow_posting=True,
            _n_children=0,
        )

        # Per-scope amounts we'll both write to OB rows AND use to build
        # the opening JE. Collecting once avoids a second pass.
        by_scope: dict[str, list[dict]] = {'OFFICIAL': [], 'INTERNAL': []}

        # Compute post-close balance per (account, scope) by aggregating
        # POSTED, non-superseded JE lines up to and including
        # from_year.end_date. The denormalized `balance` / `balance_official`
        # fields on ChartOfAccount can drift (observed 1.86M drift on
        # live data) — we've already learned the hard way they aren't
        # safe to trust here. This mirrors the closing-JE computation
        # which likewise reads JE lines directly.
        def _authoritative(acc, scope):
            agg = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope=scope,
                account=acc,
                journal_entry__transaction_date__date__lte=from_year.end_date,
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            return (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))

        created = 0
        with transaction.atomic():
            # Full rebuild semantics — wipe existing OB rows for this
            # target year first, then write fresh from authoritative JE
            # lines. Otherwise `update_or_create` leaves stale rows
            # behind for accounts whose new net is 0 (observed on live
            # data: accounts 2100 and 3000 retained pre-close values of
            # 680k and 780k respectively, blocking every downstream gate).
            OpeningBalance.objects.filter(
                organization=organization, fiscal_year=to_year,
            ).delete()

            for acc in bs_accounts:
                # OFFICIAL and INTERNAL are disjoint scopes — each JE
                # belongs to exactly one. Each scope's OB is the direct
                # sum of that scope's POSTED JE lines on this account
                # up to year-end. No cumulative subtraction.
                amounts_by_scope = (
                    ('OFFICIAL', _authoritative(acc, 'OFFICIAL')),
                    ('INTERNAL', _authoritative(acc, 'INTERNAL')),
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
        from apps.finance.models import JournalEntry, FiscalYear
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

        # Race guard — serialize concurrent writers for this (fiscal_year,
        # scope) pair. Without the row lock, two workers racing on the
        # same year can both read "no active OPENING JE", both soft-
        # supersede nothing, and both create fresh POSTED rows → duplicate
        # active openings. select_for_update() on the FiscalYear row
        # forces them into sequence. Cheap (single row), effective, and
        # the transaction context from the caller is reused (atomic
        # propagation).
        FiscalYear.objects.select_for_update().get(pk=fiscal_year.pk)

        # Soft-supersede any prior active SYSTEM_OPENING JE for this
        # (year, scope) — we keep the row POSTED, keep the is_locked
        # audit flag, and just flip is_superseded=True. Balance services
        # filter is_superseded=False so superseded rows stop contributing
        # immediately. The superseded_by FK is stamped below after the
        # new JE is created so the chain is traceable both directions.
        from django.utils import timezone
        now = timezone.now()
        JournalEntry.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            journal_type='OPENING',
            scope=scope,
            journal_role='SYSTEM_OPENING',
            status='POSTED',
            is_superseded=False,
        ).update(
            is_superseded=True,
            superseded_at=now,
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
            journal_role='SYSTEM_OPENING',
            source_module='finance',
            source_model='FiscalYear',
            source_id=fiscal_year.id,
            internal_bypass=True,
        )

        # Immutability — opening JEs are system-owned and must not be
        # editable via the normal JE editor. is_locked + journal_role=
        # 'SYSTEM_OPENING' makes them trivially distinguishable.
        JournalEntry.objects.filter(pk=je.pk).update(is_locked=True)

        # Link superseded rows to the new JE for bidirectional traceability.
        # This has to happen AFTER the new JE exists.
        JournalEntry.objects.filter(
            organization=organization,
            fiscal_year=fiscal_year,
            journal_type='OPENING',
            scope=scope,
            journal_role='SYSTEM_OPENING',
            is_superseded=True,
            superseded_by__isnull=True,
        ).exclude(pk=je.pk).update(superseded_by=je)

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

    @staticmethod
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

    @staticmethod
    def is_safe_to_flip_flag(organization):
        """Cutover readiness gate — returns (safe: bool, report: dict).

        Walks every fiscal year for `organization`, runs the OB↔JE
        validator, and returns safe=True only if every year shows
        zero drift AND every year has a POSTED OPENING JE for each
        scope that has a corresponding OpeningBalance row.

        Call this from a management command, admin action, or a future
        UI that manages the USE_JE_OPENING flag per deployment. Never
        flip the flag on a tenant where this returns safe=False — the
        legacy and new paths will disagree and the year-summary UI
        plus the RE continuity check will start showing different
        numbers than the rest of the ledger.

        Report shape:
          {
            'organization_id': int, 'organization_slug': str,
            'safe': bool,
            'years_total': int, 'years_drift': int, 'years_missing_je': int,
            'years': [ {fy_id, fy_name, has_drift, je_coverage: {...}}, ... ],
          }
        """
        from apps.finance.models import FiscalYear, JournalEntry, OpeningBalance

        report = {
            'organization_id': organization.id,
            'organization_slug': getattr(organization, 'slug', None),
            'safe': True,
            'years_total': 0,
            'years_drift': 0,
            'years_missing_je': 0,
            'years': [],
        }

        for fy in FiscalYear.objects.filter(organization=organization).order_by('start_date'):
            report['years_total'] += 1
            drift_rpt = ClosingService.validate_opening_ob_vs_je(organization, fy)

            # JE coverage — for every (scope) with OB rows, there must be
            # at least one POSTED OPENING JE. Missing coverage means the
            # JE path will silently show nothing for that year.
            coverage = {}
            coverage_mismatch = False
            for scope in ('OFFICIAL', 'INTERNAL'):
                has_ob = OpeningBalance.objects.filter(
                    organization=organization, fiscal_year=fy, scope=scope,
                ).exists()
                has_je = JournalEntry.objects.filter(
                    organization=organization, fiscal_year=fy, scope=scope,
                    journal_type='OPENING', status='POSTED',
                    is_superseded=False,
                ).exists()
                # Account-set equality — fine-grained safety net beyond
                # the "both exist" check. set(OB_accounts) must equal
                # set(OPENING_JE_accounts) per scope, or we risk a
                # zero-sum trap where balances match but data is
                # incomplete.
                scope_rpt = drift_rpt['scopes'].get(scope) or {}
                only_ob = scope_rpt.get('only_in_ob') or []
                only_je = scope_rpt.get('only_in_je') or []
                coverage[scope] = {
                    'has_ob': has_ob, 'has_je': has_je,
                    'only_in_ob': only_ob, 'only_in_je': only_je,
                    'coverage_match': not only_ob and not only_je,
                }
                if has_ob and not has_je:
                    report['years_missing_je'] += 1
                    report['safe'] = False
                if only_ob or only_je:
                    coverage_mismatch = True

            if drift_rpt['has_drift'] or coverage_mismatch:
                report['years_drift'] += 1
                report['safe'] = False

            report['years'].append({
                'fy_id': fy.id,
                'fy_name': fy.name,
                'has_drift': drift_rpt['has_drift'] or coverage_mismatch,
                'coverage': coverage,
            })

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
                is_superseded=False,
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
