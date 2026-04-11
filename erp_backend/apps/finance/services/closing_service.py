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
    def close_fiscal_year(organization, fiscal_year, user=None, retained_earnings_account_id=None):
        """
        Full year-end close sequence.

        Steps:
          1. Verify all periods are closed
          2. Close P&L accounts into retained earnings
          3. Generate opening balances for next year
          4. Lock fiscal year
          5. Create audit trail
        """
        from apps.finance.models import (
            ChartOfAccount, FiscalYear, JournalEntry
        )
        from apps.finance.services.ledger_core import LedgerCoreMixin

        if fiscal_year.is_closed:
            raise ValidationError(f"Fiscal year {fiscal_year.name} is already closed.")

        with transaction.atomic():
            # ── Step 1: Verify all periods are closed ──────────────
            unclosed = fiscal_year.periods.filter(is_closed=False)
            if unclosed.exists():
                names = ", ".join([p.name for p in unclosed[:5]])
                raise ValidationError(
                    f"Cannot close year. {unclosed.count()} periods still open: {names}"
                )

            # ── Step 2: Resolve retained earnings account ──────────
            if retained_earnings_account_id:
                re_account = ChartOfAccount.objects.get(
                    id=retained_earnings_account_id, organization=organization
                )
            else:
                # Auto-find retained earnings (common codes across standards)
                re_account = ChartOfAccount.objects.filter(
                    organization=organization,
                    type='EQUITY',
                    is_active=True,
                ).filter(
                    models.Q(code__in=['3200', '3300', '3400', '3500']) |
                    models.Q(name__icontains='retained') |
                    models.Q(name__icontains='report')  # French: "Report à nouveau"
                ).first()

                if not re_account:
                    raise ValidationError(
                        "Cannot find retained earnings account. "
                        "Please specify retained_earnings_account_id."
                    )

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

            # ── Step 4: Generate opening balances for next year ────
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
