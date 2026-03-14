"""
Budget Variance Analysis Service
==================================
Handles budget vs actual analysis, variance calculation, and alert generation.

Features:
- Actual amount calculation from journal entries
- Variance calculation (amount and percentage)
- Over-budget alert generation
- Budget performance reports
- Period-over-period comparison

Usage:
    from apps.finance.services.budget_variance_service import BudgetVarianceService

    service = BudgetVarianceService(budget)
    service.refresh_all_actuals()
    service.generate_variance_alerts()
    report = service.get_variance_report()
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import List, Dict, Optional
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone


class BudgetVarianceService:
    """Service for budget variance analysis."""

    # Alert thresholds
    OVER_BUDGET_THRESHOLD = Decimal('0.00')  # Alert if variance < 0 (over budget)
    CRITICAL_THRESHOLD_PCT = Decimal('10.00')  # 10% over budget = critical

    def __init__(self, budget):
        """
        Initialize variance service.

        Args:
            budget: Budget instance
        """
        self.budget = budget
        self.organization = budget.organization

    def refresh_all_actuals(self) -> Dict:
        """
        Refresh actual amounts for all budget lines from posted journal entries.

        Returns:
            Dict with refresh statistics
        """
        from apps.finance.models import BudgetLine, JournalEntryLine

        lines = self.budget.lines.all()

        stats = {
            'total_lines': lines.count(),
            'updated': 0,
            'errors': 0,
        }

        with transaction.atomic():
            for line in lines:
                try:
                    # Calculate actual amount from journal entries
                    actual_amount = self._calculate_actual_amount(
                        line.account,
                        line.fiscal_period
                    )

                    # Update line
                    line.actual_amount = actual_amount
                    line.recompute_variance()

                    stats['updated'] += 1

                except Exception as e:
                    stats['errors'] += 1

        return stats

    def refresh_line_actual(self, line) -> Decimal:
        """
        Refresh actual amount for a single budget line.

        Args:
            line: BudgetLine instance

        Returns:
            Updated actual amount
        """
        actual_amount = self._calculate_actual_amount(
            line.account,
            line.fiscal_period
        )

        line.actual_amount = actual_amount
        line.recompute_variance()

        return actual_amount

    def get_variance_report(
        self,
        period_filter: str = 'ALL',
        account_filter: List[int] = None,
        cost_center_filter: str = None
    ) -> Dict:
        """
        Get comprehensive variance report.

        Args:
            period_filter: 'ALL', 'CURRENT', 'YTD', or specific period ID
            account_filter: List of account IDs to filter
            cost_center_filter: Cost center code to filter

        Returns:
            Dict with variance analysis
        """
        from apps.finance.models import BudgetLine

        # Build queryset
        lines = self.budget.lines.select_related('account', 'fiscal_period')

        # Apply filters
        if period_filter == 'CURRENT':
            current_period = self._get_current_period()
            if current_period:
                lines = lines.filter(fiscal_period=current_period)
        elif period_filter == 'YTD':
            ytd_periods = self._get_ytd_periods()
            lines = lines.filter(fiscal_period__in=ytd_periods)
        elif period_filter != 'ALL':
            lines = lines.filter(fiscal_period_id=period_filter)

        if account_filter:
            lines = lines.filter(account_id__in=account_filter)

        if cost_center_filter:
            lines = lines.filter(cost_center=cost_center_filter)

        # Calculate totals
        total_budget = sum(line.budgeted_amount for line in lines)
        total_actual = sum(line.actual_amount for line in lines)
        total_committed = sum(line.committed_amount for line in lines)
        total_variance = total_budget - total_actual
        total_available = total_budget - total_actual - total_committed

        # Calculate percentage
        variance_pct = (
            (total_variance / total_budget * 100)
            if total_budget > 0 else Decimal('0.00')
        )

        # Group by category
        by_account = self._group_by_account(lines)
        by_period = self._group_by_period(lines)
        by_cost_center = self._group_by_cost_center(lines)

        # Identify problem areas
        over_budget = [
            {
                'account_code': line.account.code,
                'account_name': line.account.name,
                'period': line.fiscal_period.name if line.fiscal_period else 'Annual',
                'budgeted': line.budgeted_amount,
                'actual': line.actual_amount,
                'variance': line.variance_amount,
                'variance_pct': line.variance_percentage,
            }
            for line in lines if line.variance_amount < 0
        ]

        return {
            'budget_id': self.budget.id,
            'budget_name': self.budget.name,
            'fiscal_year': self.budget.fiscal_year.name,
            'total_budget': total_budget,
            'total_actual': total_actual,
            'total_committed': total_committed,
            'total_variance': total_variance,
            'total_available': total_available,
            'variance_percentage': variance_pct,
            'utilization_percentage': (
                (total_actual / total_budget * 100)
                if total_budget > 0 else Decimal('0.00')
            ),
            'by_account': by_account,
            'by_period': by_period,
            'by_cost_center': by_cost_center,
            'over_budget_count': len(over_budget),
            'over_budget_items': over_budget,
        }

    def generate_variance_alerts(self, threshold_pct: Decimal = None) -> List[Dict]:
        """
        Generate alerts for over-budget items.

        Args:
            threshold_pct: Alert if variance exceeds this percentage (default: 10%)

        Returns:
            List of alert dictionaries
        """
        if threshold_pct is None:
            threshold_pct = self.CRITICAL_THRESHOLD_PCT

        alerts = []

        lines = self.budget.lines.select_related('account', 'fiscal_period')

        for line in lines:
            # Skip if under budget or on budget
            if line.variance_amount >= 0:
                continue

            # Calculate over-budget percentage
            over_budget_pct = abs(line.variance_percentage)

            # Determine severity
            if over_budget_pct >= threshold_pct:
                severity = 'CRITICAL'
            elif over_budget_pct >= threshold_pct / 2:
                severity = 'WARNING'
            else:
                severity = 'INFO'

            alerts.append({
                'severity': severity,
                'budget_line_id': line.id,
                'account_code': line.account.code,
                'account_name': line.account.name,
                'period': line.fiscal_period.name if line.fiscal_period else 'Annual',
                'cost_center': line.cost_center,
                'budgeted_amount': line.budgeted_amount,
                'actual_amount': line.actual_amount,
                'variance_amount': line.variance_amount,
                'variance_percentage': line.variance_percentage,
                'over_budget_amount': abs(line.variance_amount),
                'over_budget_percentage': over_budget_pct,
                'message': f"{line.account.name} is {over_budget_pct:.1f}% over budget",
            })

        # Sort by severity and percentage
        severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
        alerts.sort(key=lambda x: (severity_order[x['severity']], -x['over_budget_percentage']))

        return alerts

    def get_budget_performance_summary(self) -> Dict:
        """
        Get budget performance summary with key metrics.

        Returns:
            Dict with performance metrics
        """
        lines = self.budget.lines.all()

        total_budget = sum(line.budgeted_amount for line in lines)
        total_actual = sum(line.actual_amount for line in lines)
        total_variance = total_budget - total_actual

        over_budget_lines = [l for l in lines if l.variance_amount < 0]
        under_budget_lines = [l for l in lines if l.variance_amount > 0]
        on_budget_lines = [l for l in lines if l.variance_amount == 0]

        return {
            'total_budget': total_budget,
            'total_actual': total_actual,
            'total_variance': total_variance,
            'variance_percentage': (
                (total_variance / total_budget * 100)
                if total_budget > 0 else Decimal('0.00')
            ),
            'lines_count': lines.count(),
            'over_budget_count': len(over_budget_lines),
            'under_budget_count': len(under_budget_lines),
            'on_budget_count': len(on_budget_lines),
            'over_budget_amount': sum(abs(l.variance_amount) for l in over_budget_lines),
            'under_budget_amount': sum(l.variance_amount for l in under_budget_lines),
            'utilization_rate': (
                (total_actual / total_budget * 100)
                if total_budget > 0 else Decimal('0.00')
            ),
        }

    def compare_to_previous_period(self, previous_budget) -> Dict:
        """
        Compare current budget to previous period's budget.

        Args:
            previous_budget: Previous Budget instance

        Returns:
            Dict with period-over-period comparison
        """
        current_lines = self.budget.lines.select_related('account')
        previous_lines = previous_budget.lines.select_related('account')

        # Create lookup maps
        current_map = {
            (line.account_id, line.fiscal_period_id): line
            for line in current_lines
        }
        previous_map = {
            (line.account_id, line.fiscal_period_id): line
            for line in previous_lines
        }

        comparisons = []

        for key, current_line in current_map.items():
            previous_line = previous_map.get(key)

            if previous_line:
                budget_change = current_line.budgeted_amount - previous_line.budgeted_amount
                actual_change = current_line.actual_amount - previous_line.actual_amount

                comparisons.append({
                    'account_code': current_line.account.code,
                    'account_name': current_line.account.name,
                    'period': current_line.fiscal_period.name if current_line.fiscal_period else 'Annual',
                    'current_budget': current_line.budgeted_amount,
                    'previous_budget': previous_line.budgeted_amount,
                    'budget_change': budget_change,
                    'budget_change_pct': (
                        (budget_change / previous_line.budgeted_amount * 100)
                        if previous_line.budgeted_amount > 0 else Decimal('0.00')
                    ),
                    'current_actual': current_line.actual_amount,
                    'previous_actual': previous_line.actual_amount,
                    'actual_change': actual_change,
                })

        return {
            'current_budget_id': self.budget.id,
            'previous_budget_id': previous_budget.id,
            'comparisons': comparisons,
        }

    # Private helper methods

    def _calculate_actual_amount(self, account, fiscal_period) -> Decimal:
        """
        Calculate actual amount from posted journal entries.

        Args:
            account: ChartOfAccount instance
            fiscal_period: FiscalPeriod instance (or None for annual)

        Returns:
            Actual amount (net debit - credit for expense/asset, credit - debit for income/liability)
        """
        from apps.finance.models import JournalEntryLine

        # Build query
        query = Q(
            organization=self.organization,
            account=account,
            entry__status='POSTED'
        )

        # Add period filter
        if fiscal_period:
            query &= Q(
                entry__transaction_date__gte=fiscal_period.start_date,
                entry__transaction_date__lte=fiscal_period.end_date
            )
        else:
            # Annual: use fiscal year dates
            query &= Q(
                entry__transaction_date__gte=self.budget.fiscal_year.start_date,
                entry__transaction_date__lte=self.budget.fiscal_year.end_date
            )

        # Get totals
        totals = JournalEntryLine.objects.filter(query).aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit')
        )

        total_debit = totals['total_debit'] or Decimal('0.00')
        total_credit = totals['total_credit'] or Decimal('0.00')

        # Calculate net based on account type
        # For expense/asset accounts: debit - credit
        # For income/liability accounts: credit - debit
        if account.account_type in ['ASSET', 'EXPENSE']:
            net_amount = total_debit - total_credit
        else:
            net_amount = total_credit - total_debit

        return net_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _get_current_period(self):
        """Get current fiscal period."""
        from apps.finance.models import FiscalPeriod

        today = date.today()

        return FiscalPeriod.objects.filter(
            organization=self.organization,
            fiscal_year=self.budget.fiscal_year,
            start_date__lte=today,
            end_date__gte=today
        ).first()

    def _get_ytd_periods(self):
        """Get year-to-date fiscal periods."""
        from apps.finance.models import FiscalPeriod

        today = date.today()

        return FiscalPeriod.objects.filter(
            organization=self.organization,
            fiscal_year=self.budget.fiscal_year,
            end_date__lte=today
        )

    def _group_by_account(self, lines) -> List[Dict]:
        """Group lines by account."""
        from collections import defaultdict

        grouped = defaultdict(lambda: {
            'budgeted': Decimal('0.00'),
            'actual': Decimal('0.00'),
            'variance': Decimal('0.00'),
        })

        for line in lines:
            key = (line.account.code, line.account.name)
            grouped[key]['budgeted'] += line.budgeted_amount
            grouped[key]['actual'] += line.actual_amount
            grouped[key]['variance'] += line.variance_amount

        result = []
        for (code, name), amounts in grouped.items():
            result.append({
                'account_code': code,
                'account_name': name,
                'budgeted': amounts['budgeted'],
                'actual': amounts['actual'],
                'variance': amounts['variance'],
                'variance_pct': (
                    (amounts['variance'] / amounts['budgeted'] * 100)
                    if amounts['budgeted'] > 0 else Decimal('0.00')
                ),
            })

        return sorted(result, key=lambda x: x['account_code'])

    def _group_by_period(self, lines) -> List[Dict]:
        """Group lines by fiscal period."""
        from collections import defaultdict

        grouped = defaultdict(lambda: {
            'budgeted': Decimal('0.00'),
            'actual': Decimal('0.00'),
            'variance': Decimal('0.00'),
        })

        for line in lines:
            period_name = line.fiscal_period.name if line.fiscal_period else 'Annual'
            grouped[period_name]['budgeted'] += line.budgeted_amount
            grouped[period_name]['actual'] += line.actual_amount
            grouped[period_name]['variance'] += line.variance_amount

        result = []
        for period_name, amounts in grouped.items():
            result.append({
                'period': period_name,
                'budgeted': amounts['budgeted'],
                'actual': amounts['actual'],
                'variance': amounts['variance'],
                'variance_pct': (
                    (amounts['variance'] / amounts['budgeted'] * 100)
                    if amounts['budgeted'] > 0 else Decimal('0.00')
                ),
            })

        return result

    def _group_by_cost_center(self, lines) -> List[Dict]:
        """Group lines by cost center."""
        from collections import defaultdict

        grouped = defaultdict(lambda: {
            'budgeted': Decimal('0.00'),
            'actual': Decimal('0.00'),
            'variance': Decimal('0.00'),
        })

        for line in lines:
            cost_center = line.cost_center or 'Unassigned'
            grouped[cost_center]['budgeted'] += line.budgeted_amount
            grouped[cost_center]['actual'] += line.actual_amount
            grouped[cost_center]['variance'] += line.variance_amount

        result = []
        for cost_center, amounts in grouped.items():
            result.append({
                'cost_center': cost_center,
                'budgeted': amounts['budgeted'],
                'actual': amounts['actual'],
                'variance': amounts['variance'],
                'variance_pct': (
                    (amounts['variance'] / amounts['budgeted'] * 100)
                    if amounts['budgeted'] > 0 else Decimal('0.00')
                ),
            })

        return sorted(result, key=lambda x: x['cost_center'])
