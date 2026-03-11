"""
Budget Service — Budget vs. Actual analysis engine.

Responsibilities:
  - Refresh actuals from posted JEs
  - Compute variance (amount + %)
  - Budget availability check (for commitment control)
  - Summary rollup by class/cost center
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class BudgetService:
    """Manages budget actuals refresh and variance analysis."""

    @staticmethod
    def refresh_actuals(organization, budget):
        """
        Refresh actual amounts on all budget lines from posted JEs.
        """
        from apps.finance.models import JournalEntryLine

        refreshed = 0
        with transaction.atomic():
            for bl in budget.lines.all():
                # Build the filter
                qs = JournalEntryLine.objects.filter(
                    organization=organization,
                    account=bl.account,
                    journal_entry__status='POSTED',
                    journal_entry__fiscal_year=budget.fiscal_year,
                )
                if bl.fiscal_period:
                    qs = qs.filter(journal_entry__fiscal_period=bl.fiscal_period)
                if bl.cost_center:
                    qs = qs.filter(cost_center=bl.cost_center)
                if budget.scope == 'OFFICIAL':
                    qs = qs.filter(journal_entry__scope='OFFICIAL')

                totals = qs.aggregate(
                    total_debit=Sum('debit'),
                    total_credit=Sum('credit'),
                )
                debit = totals['total_debit'] or Decimal('0.00')
                credit = totals['total_credit'] or Decimal('0.00')

                # For expense/asset accounts, actual = debit - credit
                # For income/liability accounts, actual = credit - debit
                acc_type = bl.account.type
                if acc_type in ('EXPENSE', 'ASSET'):
                    bl.actual_amount = debit - credit
                else:
                    bl.actual_amount = credit - debit

                bl.recompute_variance()
                refreshed += 1

            # Update budget total
            budget.total_budget = budget.lines.aggregate(
                total=Sum('budgeted_amount')
            )['total'] or Decimal('0.00')
            budget.save()

        logger.info(f"BudgetService: Refreshed {refreshed} lines for budget {budget.name}")
        return refreshed

    @staticmethod
    def check_availability(organization, budget, account_id, amount, cost_center=None, fiscal_period=None):
        """
        Check if a budget line has sufficient available amount.
        Used for commitment control before approving POs/expenses.

        Returns:
          { 'available': True/False, 'budgeted': Decimal, 'actual': Decimal,
            'committed': Decimal, 'remaining': Decimal }
        """
        from apps.finance.models import BudgetLine

        qs = BudgetLine.objects.filter(
            budget=budget,
            account_id=account_id,
        )
        if cost_center:
            qs = qs.filter(cost_center=cost_center)
        if fiscal_period:
            qs = qs.filter(fiscal_period=fiscal_period)

        # Sum across matching lines
        totals = qs.aggregate(
            budgeted=Sum('budgeted_amount'),
            actual=Sum('actual_amount'),
            committed=Sum('committed_amount'),
        )
        budgeted = totals['budgeted'] or Decimal('0.00')
        actual = totals['actual'] or Decimal('0.00')
        committed = totals['committed'] or Decimal('0.00')
        remaining = budgeted - actual - committed

        return {
            'available': remaining >= amount,
            'budgeted': budgeted,
            'actual': actual,
            'committed': committed,
            'remaining': remaining,
            'requested': amount,
            'shortfall': max(Decimal('0'), amount - remaining),
        }

    @staticmethod
    def get_variance_summary(organization, budget):
        """
        Return a summary of budget variance by account class.
        """
        from apps.finance.models import BudgetLine
        from django.db.models import F

        lines = budget.lines.select_related('account').all()

        summary = {}
        for bl in lines:
            class_code = bl.account.class_code or '0'
            class_name = bl.account.class_name or 'Unknown'
            key = f"{class_code}_{class_name}"

            if key not in summary:
                summary[key] = {
                    'class_code': class_code,
                    'class_name': class_name,
                    'budgeted': Decimal('0.00'),
                    'actual': Decimal('0.00'),
                    'variance': Decimal('0.00'),
                    'utilization_pct': Decimal('0.00'),
                    'accounts': 0,
                }

            summary[key]['budgeted'] += bl.budgeted_amount
            summary[key]['actual'] += bl.actual_amount
            summary[key]['variance'] += bl.variance_amount
            summary[key]['accounts'] += 1

        # Compute utilization %
        for v in summary.values():
            if v['budgeted'] > Decimal('0'):
                v['utilization_pct'] = (v['actual'] / v['budgeted']) * Decimal('100')

        return sorted(summary.values(), key=lambda x: x['class_code'])
