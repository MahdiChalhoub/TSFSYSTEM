"""
Balance Service — Manages account balance snapshots for fast reporting.

Responsibilities:
  - Refresh snapshots for a period (or all stale snapshots)
  - Generate trial balance from snapshots
  - Carry forward closing balances as next period's opening
"""
import logging
from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum, Count
from django.utils import timezone

logger = logging.getLogger(__name__)


class BalanceService:
    """Manages AccountBalanceSnapshot lifecycle."""

    @staticmethod
    def refresh_snapshots(organization, fiscal_period=None, scope='OFFICIAL'):
        """
        Recompute balance snapshots for a period.
        If no period specified, refreshes all stale snapshots.
        """
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine, AccountBalanceSnapshot, FiscalPeriod
        )

        if fiscal_period:
            periods = [fiscal_period]
        else:
            # Find all periods with stale snapshots
            stale_period_ids = AccountBalanceSnapshot.objects.filter(
                organization=organization, is_stale=True
            ).values_list('fiscal_period_id', flat=True).distinct()
            periods = FiscalPeriod.objects.filter(id__in=stale_period_ids)

        refreshed = 0
        for period in periods:
            refreshed += BalanceService._refresh_period(organization, period, scope)

        logger.info(f"BalanceService: Refreshed {refreshed} snapshots for {organization}")
        return refreshed

    @staticmethod
    def _refresh_period(organization, fiscal_period, scope='OFFICIAL'):
        """Refresh all snapshots for a single period."""
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine, AccountBalanceSnapshot
        )

        # Get all accounts that have posted lines in this period
        lines_qs = JournalEntryLine.objects.filter(
            organization=organization,
            journal_entry__status='POSTED',
            journal_entry__fiscal_period=fiscal_period,
        )
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')

        # Aggregate by account
        account_totals = lines_qs.values('account_id').annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
            count=Count('id'),
        )

        refreshed = 0
        with transaction.atomic():
            for row in account_totals:
                snapshot, created = AccountBalanceSnapshot.objects.get_or_create(
                    organization=organization,
                    account_id=row['account_id'],
                    fiscal_period=fiscal_period,
                    scope=scope,
                    defaults={
                        'opening_debit': Decimal('0.00'),
                        'opening_credit': Decimal('0.00'),
                    }
                )
                snapshot.movement_debit = row['total_debit'] or Decimal('0.00')
                snapshot.movement_credit = row['total_credit'] or Decimal('0.00')
                snapshot.closing_debit = snapshot.opening_debit + snapshot.movement_debit
                snapshot.closing_credit = snapshot.opening_credit + snapshot.movement_credit
                snapshot.transaction_count = row['count'] or 0
                snapshot.is_stale = False
                snapshot.save()
                refreshed += 1

        return refreshed

    @staticmethod
    def generate_snapshots_for_period(organization, fiscal_period, scope='OFFICIAL'):
        """
        Full snapshot generation: compute opening from prior period + movements.
        """
        from apps.finance.models import AccountBalanceSnapshot, FiscalPeriod

        # Find the previous period
        prior_period = FiscalPeriod.objects.filter(
            organization=organization,
            fiscal_year=fiscal_period.fiscal_year,
            end_date__lt=fiscal_period.start_date,
        ).order_by('-end_date').first()

        # If no prior in same year, check for year-opening balances
        prior_snapshots = {}
        if prior_period:
            for snap in AccountBalanceSnapshot.objects.filter(
                organization=organization,
                fiscal_period=prior_period,
                scope=scope,
            ):
                prior_snapshots[snap.account_id] = snap

        # Now compute current period movements
        refreshed = BalanceService._refresh_period(organization, fiscal_period, scope)

        # Update opening balances from prior period closing
        if prior_snapshots:
            with transaction.atomic():
                for snap in AccountBalanceSnapshot.objects.filter(
                    organization=organization,
                    fiscal_period=fiscal_period,
                    scope=scope,
                ):
                    prior = prior_snapshots.get(snap.account_id)
                    if prior:
                        snap.opening_debit = prior.closing_debit
                        snap.opening_credit = prior.closing_credit
                        snap.closing_debit = snap.opening_debit + snap.movement_debit
                        snap.closing_credit = snap.opening_credit + snap.movement_credit
                        snap.save()

        logger.info(
            f"BalanceService: Generated {refreshed} snapshots for "
            f"{fiscal_period.name} ({scope})"
        )
        return refreshed

    @staticmethod
    def get_trial_balance(organization, fiscal_period, scope='OFFICIAL'):
        """
        Returns trial balance data from snapshots (fast) with fallback to live (slow).
        """
        from apps.finance.models import AccountBalanceSnapshot, ChartOfAccount

        # Try snapshots first
        snapshots = AccountBalanceSnapshot.objects.filter(
            organization=organization,
            fiscal_period=fiscal_period,
            scope=scope,
            is_stale=False,
        ).select_related('account')

        if snapshots.exists():
            result = []
            for snap in snapshots:
                result.append({
                    'account_id': snap.account_id,
                    'account_code': snap.account.code,
                    'account_name': snap.account.name,
                    'account_type': snap.account.type,
                    'class_code': snap.account.class_code,
                    'opening_debit': snap.opening_debit,
                    'opening_credit': snap.opening_credit,
                    'movement_debit': snap.movement_debit,
                    'movement_credit': snap.movement_credit,
                    'closing_debit': snap.closing_debit,
                    'closing_credit': snap.closing_credit,
                    'source': 'snapshot',
                })
            return result

        # Fallback: live aggregation (slower but always accurate)
        logger.warning(
            f"BalanceService: No snapshots for {fiscal_period.name}. "
            f"Using live aggregation. Run refresh_snapshots() to improve performance."
        )
        return BalanceService._live_trial_balance(organization, fiscal_period, scope)

    @staticmethod
    def _live_trial_balance(organization, fiscal_period, scope='OFFICIAL'):
        """Fallback: compute trial balance from JournalEntryLine directly."""
        from apps.finance.models import JournalEntryLine

        lines_qs = JournalEntryLine.objects.filter(
            organization=organization,
            journal_entry__status='POSTED',
            journal_entry__fiscal_period=fiscal_period,
        )
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')

        totals = lines_qs.values(
            'account_id',
            'account__code',
            'account__name',
            'account__type',
            'account__class_code',
        ).annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        )

        return [{
            'account_id': row['account_id'],
            'account_code': row['account__code'],
            'account_name': row['account__name'],
            'account_type': row['account__type'],
            'class_code': row['account__class_code'],
            'opening_debit': Decimal('0.00'),
            'opening_credit': Decimal('0.00'),
            'movement_debit': row['total_debit'] or Decimal('0.00'),
            'movement_credit': row['total_credit'] or Decimal('0.00'),
            'closing_debit': row['total_debit'] or Decimal('0.00'),
            'closing_credit': row['total_credit'] or Decimal('0.00'),
            'source': 'live',
        } for row in totals]
