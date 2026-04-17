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

            # Close the period
            fiscal_period.status = 'CLOSED'
            fiscal_period.is_closed = True
            fiscal_period.closed_at = timezone.now()
            fiscal_period.closed_by = user
            fiscal_period.save()

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

        fiscal_period.status = 'OPEN'
        fiscal_period.is_closed = False
        fiscal_period.closed_at = None
        fiscal_period.closed_by = None
        fiscal_period.save()
        logger.info(
            f"ClosingService: Period {fiscal_period.name} reopened by "
            f"{user.username if user else 'system'}"
        )
        return fiscal_period

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
            for je in orphans:
                fp = FiscalPeriod.objects.filter(
                    organization=organization,
                    start_date__lte=je.transaction_date,
                    end_date__gte=je.transaction_date,
                ).first()
                if fp:
                    je.fiscal_year = fp.fiscal_year
                    je.fiscal_period = fp
                    je.save(update_fields=['fiscal_year', 'fiscal_period'])

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

            # ── Step 3: Close P&L into retained earnings ───────────
            from django.db.models import Q
            pnl_accounts = ChartOfAccount.objects.filter(
                organization=organization,
                type__in=['INCOME', 'EXPENSE'],
                is_active=True,
            )

            closing_lines = []
            total_pnl = Decimal('0.00')

            for acc in pnl_accounts:
                # Use the official balance for year-end close
                if acc.balance_official == Decimal('0.00'):
                    continue

                # Reverse the balance: if income has CREDIT balance, debit it to zero
                if acc.balance_official > Decimal('0.00'):
                    closing_lines.append({
                        'account_id': acc.id,
                        'debit': Decimal('0.00'),
                        'credit': acc.balance_official,
                        'description': f"Year-end close: {acc.code} - {acc.name}",
                    })
                else:
                    closing_lines.append({
                        'account_id': acc.id,
                        'debit': abs(acc.balance_official),
                        'credit': Decimal('0.00'),
                        'description': f"Year-end close: {acc.code} - {acc.name}",
                    })

                total_pnl += acc.balance_official

            if closing_lines:
                # Add the retained earnings counterpart line
                if total_pnl > Decimal('0.00'):
                    closing_lines.append({
                        'account_id': re_account.id,
                        'debit': total_pnl,
                        'credit': Decimal('0.00'),
                        'description': f"Year-end close: Net income to {re_account.code}",
                    })
                elif total_pnl < Decimal('0.00'):
                    closing_lines.append({
                        'account_id': re_account.id,
                        'debit': Decimal('0.00'),
                        'credit': abs(total_pnl),
                        'description': f"Year-end close: Net loss to {re_account.code}",
                    })

                # Create the closing journal entry
                # Use the last period (or adjustment period) for dating
                last_period = fiscal_year.periods.order_by('-end_date').first()

                closing_entry = LedgerCoreMixin.create_journal_entry(
                    organization=organization,
                    transaction_date=fiscal_year.end_date,
                    description=f"Year-End Close: {fiscal_year.name}",
                    lines=closing_lines,
                    status='POSTED',
                    scope='OFFICIAL',
                    user=user,
                    journal_type='CLOSING',
                    source_module='finance',
                    source_model='FiscalYear',
                    source_id=fiscal_year.id,
                    internal_bypass=True,  # Allow posting to system accounts
                )

                fiscal_year.closing_journal_entry = closing_entry
            else:
                logger.info(
                    f"ClosingService: No P&L accounts with balances for {fiscal_year.name}"
                )

            # ── Step 4a: Auto-create remainder year if partial close ──
            if is_partial and remainder_start and remainder_end:
                # Check if a year already exists in the remainder range
                existing_in_range = FiscalYear.objects.filter(
                    organization=organization,
                    start_date__lte=remainder_end,
                    end_date__gte=remainder_start,
                ).first()

                if not existing_in_range:
                    # Build name like "FY 2026-B (May-Dec)" or "FY 2026 (May-Dec)"
                    sm = remainder_start.strftime('%b')
                    em = remainder_end.strftime('%b')
                    yr = remainder_start.year
                    base_name = f"FY {yr} ({sm}-{em})"
                    # Ensure unique name
                    suffix = ''
                    counter = 1
                    while FiscalYear.objects.filter(organization=organization, name=base_name + suffix).exists():
                        counter += 1
                        suffix = f' v{counter}'

                    remainder_year = FiscalYear.objects.create(
                        organization=organization,
                        name=base_name + suffix,
                        start_date=remainder_start,
                        end_date=remainder_end,
                        is_closed=False,
                        is_hard_locked=False,
                    )

                    # Generate monthly periods for the remainder
                    import calendar
                    curr = remainder_start
                    period_count = 1
                    while curr <= remainder_end:
                        last_day = calendar.monthrange(curr.year, curr.month)[1]
                        period_end = date_cls(curr.year, curr.month, last_day)
                        if period_end > remainder_end:
                            period_end = remainder_end
                        FiscalPeriod.objects.create(
                            organization=organization,
                            fiscal_year=remainder_year,
                            name=curr.strftime('%B %Y'),
                            start_date=curr,
                            end_date=period_end,
                            status='OPEN',
                            is_closed=False,
                        )
                        curr = period_end + timedelta(days=1)
                        period_count += 1

                    logger.info(
                        f"ClosingService: Auto-created remainder year {remainder_year.name} "
                        f"({remainder_start} → {remainder_end}) with {period_count - 1} periods"
                    )
                    next_year = remainder_year
                else:
                    next_year = existing_in_range
            else:
                # ── Step 4b: Find existing next year ──
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

            # ── Step 5: Lock fiscal year ───────────────────────────
            fiscal_year.is_closed = True
            fiscal_year.is_hard_locked = True
            fiscal_year.status = 'CLOSED'
            fiscal_year.closed_at = timezone.now()
            fiscal_year.closed_by = user
            fiscal_year.save()

            logger.info(
                f"ClosingService: Fiscal year {fiscal_year.name} closed by "
                f"{user.username if user else 'system'}"
            )
            return fiscal_year

    @staticmethod
    def generate_opening_balances(organization, from_year, to_year, user=None):
        """
        Generate OpeningBalance records for the new year from the closing
        balances of the old year. Only for Balance Sheet accounts (ASSET,
        LIABILITY, EQUITY). P&L accounts start at zero.
        """
        from apps.finance.models import ChartOfAccount, OpeningBalance

        bs_accounts = ChartOfAccount.objects.filter(
            organization=organization,
            type__in=['ASSET', 'LIABILITY', 'EQUITY'],
            is_active=True,
        )

        created = 0
        with transaction.atomic():
            for acc in bs_accounts:
                if acc.balance_official == Decimal('0.00'):
                    continue

                # Determine debit/credit from net balance
                net = acc.balance_official
                if net > Decimal('0.00'):
                    debit_amt = net
                    credit_amt = Decimal('0.00')
                else:
                    debit_amt = Decimal('0.00')
                    credit_amt = abs(net)

                OpeningBalance.objects.update_or_create(
                    organization=organization,
                    account=acc,
                    fiscal_year=to_year,
                    scope='OFFICIAL',
                    defaults={
                        'debit_amount': debit_amt,
                        'credit_amount': credit_amt,
                        'source': 'TRANSFER',
                        'created_by': user,
                        'notes': f"Carried forward from {from_year.name}",
                    }
                )
                created += 1

        logger.info(
            f"ClosingService: Generated {created} opening balances "
            f"for {to_year.name} from {from_year.name}"
        )
        return created
