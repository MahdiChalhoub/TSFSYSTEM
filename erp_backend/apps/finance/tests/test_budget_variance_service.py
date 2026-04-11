"""
Unit tests for Budget Variance Analysis Service
Tests variance calculations, alert generation, and multi-dimensional reporting
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import (
    ChartOfAccount, Budget, BudgetLine, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine
)
from apps.finance.services.budget_variance_service import BudgetVarianceService


class BudgetVarianceServiceTests(TestCase):
    """Test suite for budget variance analysis"""

    def setUp(self):
        """Set up test data"""
        self.organization = Organization.objects.create(
            name="Test Org",
            slug="test-org"
        )

        with tenant_context(self.organization):
            self.user = User.objects.create(
                username="testuser",
                organization=self.organization
            )

            # Create Chart of Accounts
            self.expense_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="6000",
                name="Operating Expenses",
                type="EXPENSE",
                normal_balance="DEBIT"
            )

            self.revenue_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="4000",
                name="Sales Revenue",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            # Create Fiscal Year and Period
            self.fiscal_year = FiscalYear.objects.create(
                organization=self.organization,
                name="FY2026",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                is_closed=False
            )

            self.fiscal_period = FiscalPeriod.objects.create(
                organization=self.organization,
                fiscal_year=self.fiscal_year,
                name="Q1 2026",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31),
                status="OPEN"
            )

            # Create Budget
            self.budget = Budget.objects.create(
                organization=self.organization,
                name="2026 Operating Budget",
                fiscal_year=self.fiscal_year,
                status="APPROVED"
            )

    def test_variance_calculation_under_budget(self):
        """Test variance when actual is under budget (positive variance)"""
        with tenant_context(self.organization):
            # Budget: 10,000
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('8000.00')
            )

            # Variance = Budget - Actual = 10,000 - 8,000 = 2,000 (positive, good)
            budget_line.recompute_variance()

            self.assertEqual(budget_line.variance_amount, Decimal('2000.00'))
            self.assertEqual(budget_line.variance_percentage, Decimal('20.00'))
            self.assertTrue(budget_line.variance_amount > 0)  # Under budget

    def test_variance_calculation_over_budget(self):
        """Test variance when actual exceeds budget (negative variance)"""
        with tenant_context(self.organization):
            # Budget: 10,000, Actual: 12,000
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('12000.00')
            )

            budget_line.recompute_variance()

            # Variance = 10,000 - 12,000 = -2,000 (negative, over budget)
            self.assertEqual(budget_line.variance_amount, Decimal('-2000.00'))
            self.assertEqual(budget_line.variance_percentage, Decimal('-20.00'))
            self.assertTrue(budget_line.variance_amount < 0)  # Over budget

    def test_variance_percentage_calculation(self):
        """Test variance percentage formula"""
        with tenant_context(self.organization):
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('5000.00'),
                actual_amount=Decimal('4500.00')
            )

            budget_line.recompute_variance()

            # Variance = 5,000 - 4,500 = 500
            # Percentage = (500 / 5,000) × 100 = 10%
            self.assertEqual(budget_line.variance_amount, Decimal('500.00'))
            self.assertEqual(budget_line.variance_percentage, Decimal('10.00'))

    def test_alert_generation_critical(self):
        """Test CRITICAL alert for expenses ≥10% over budget"""
        with tenant_context(self.organization):
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('11500.00')  # 15% over
            )

            service = BudgetVarianceService(self.budget)
            alerts = service.generate_variance_alerts(threshold_pct=10)

            # Should have 1 CRITICAL alert
            critical_alerts = [a for a in alerts if a['severity'] == 'CRITICAL']
            self.assertEqual(len(critical_alerts), 1)

            alert = critical_alerts[0]
            self.assertEqual(alert['account_code'], '6000')
            self.assertGreaterEqual(alert['over_budget_pct'], 10)

    def test_alert_generation_warning(self):
        """Test WARNING alert for expenses 5-10% over budget"""
        with tenant_context(self.organization):
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('10700.00')  # 7% over
            )

            service = BudgetVarianceService(self.budget)
            alerts = service.generate_variance_alerts(threshold_pct=10)

            # Should have 1 WARNING alert
            warning_alerts = [a for a in alerts if a['severity'] == 'WARNING']
            self.assertEqual(len(warning_alerts), 1)

            alert = warning_alerts[0]
            self.assertEqual(alert['severity'], 'WARNING')
            self.assertGreaterEqual(alert['over_budget_pct'], 5)
            self.assertLess(alert['over_budget_pct'], 10)

    def test_alert_generation_info(self):
        """Test INFO alert for expenses <5% over budget"""
        with tenant_context(self.organization):
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('10300.00')  # 3% over
            )

            service = BudgetVarianceService(self.budget)
            alerts = service.generate_variance_alerts(threshold_pct=10)

            # Should have 1 INFO alert
            info_alerts = [a for a in alerts if a['severity'] == 'INFO']
            self.assertEqual(len(info_alerts), 1)

            alert = info_alerts[0]
            self.assertEqual(alert['severity'], 'INFO')
            self.assertLess(alert['over_budget_pct'], 5)

    def test_actual_amount_from_journal_entries(self):
        """Test calculating actual amount from journal entries (DEBIT account)"""
        with tenant_context(self.organization):
            # Create budget line
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.expense_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('10000.00'),
                actual_amount=Decimal('0.00')
            )

            # Create journal entries for expenses (DEBIT account)
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Expense 1",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.expense_account,
                debit=Decimal('3000.00'),
                credit=Decimal('0.00')
            )

            journal2 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 2, 15),
                description="Expense 2",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal2,
                account=self.expense_account,
                debit=Decimal('2500.00'),
                credit=Decimal('0.00')
            )

            # Refresh actuals from journal entries
            service = BudgetVarianceService(self.budget)
            result = service.refresh_all_actuals()

            # Should calculate actual = debit - credit = 3,000 + 2,500 = 5,500
            budget_line.refresh_from_db()
            self.assertEqual(budget_line.actual_amount, Decimal('5500.00'))
            self.assertTrue(result['success'])

    def test_actual_amount_credit_account(self):
        """Test calculating actual amount for CREDIT account (Revenue)"""
        with tenant_context(self.organization):
            # Create budget line for revenue
            budget_line = BudgetLine.objects.create(
                organization=self.organization,
                budget=self.budget,
                account=self.revenue_account,
                fiscal_period=self.fiscal_period,
                budgeted_amount=Decimal('50000.00'),
                actual_amount=Decimal('0.00')
            )

            # Create journal entries for revenue (CREDIT account)
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Sale 1",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.revenue_account,
                debit=Decimal('0.00'),
                credit=Decimal('30000.00')
            )

            journal2 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 2, 15),
                description="Sale 2",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal2,
                account=self.revenue_account,
                debit=Decimal('0.00'),
                credit=Decimal('15000.00')
            )

            # Refresh actuals
            service = BudgetVarianceService(self.budget)
            service.refresh_all_actuals()

            # For CREDIT account: actual = credit - debit = 30,000 + 15,000 = 45,000
            budget_line.refresh_from_db()
            self.assertEqual(budget_line.actual_amount, Decimal('45000.00'))

            # Variance for revenue: actual - budget (opposite of expenses)
            # If actual < budget, it's negative variance (bad for revenue)
            budget_line.recompute_variance()
            self.assertEqual(budget_line.variance_amount, Decimal('-5000.00'))
