"""
Unit tests for Financial Report Service
Tests Cash Flow, Trial Balance, P&L, and Balance Sheet generation
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import (
    ChartOfAccount, JournalEntry, JournalEntryLine,
    FiscalYear, FiscalPeriod
)
from apps.finance.services.financial_report_service import FinancialReportService


class FinancialReportServiceTests(TestCase):
    """Test suite for financial report generation"""

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

            # Create comprehensive Chart of Accounts
            # Assets
            self.cash = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1000",
                name="Cash",
                type="ASSET",
                normal_balance="DEBIT"
            )

            self.accounts_receivable = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1200",
                name="Accounts Receivable",
                type="ASSET",
                normal_balance="DEBIT"
            )

            self.fixed_assets = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1500",
                name="Fixed Assets",
                type="ASSET",
                normal_balance="DEBIT"
            )

            self.accum_depreciation = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1510",
                name="Accumulated Depreciation",
                type="ASSET",
                normal_balance="CREDIT"
            )

            # Liabilities
            self.accounts_payable = ChartOfAccount.objects.create(
                organization=self.organization,
                code="2000",
                name="Accounts Payable",
                type="LIABILITY",
                normal_balance="CREDIT"
            )

            self.loan_payable = ChartOfAccount.objects.create(
                organization=self.organization,
                code="2500",
                name="Loan Payable",
                type="LIABILITY",
                normal_balance="CREDIT"
            )

            # Equity
            self.capital = ChartOfAccount.objects.create(
                organization=self.organization,
                code="3000",
                name="Owner's Capital",
                type="EQUITY",
                normal_balance="CREDIT"
            )

            self.retained_earnings = ChartOfAccount.objects.create(
                organization=self.organization,
                code="3100",
                name="Retained Earnings",
                type="EQUITY",
                normal_balance="CREDIT"
            )

            # Revenue
            self.sales_revenue = ChartOfAccount.objects.create(
                organization=self.organization,
                code="4000",
                name="Sales Revenue",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            # Expenses
            self.operating_expense = ChartOfAccount.objects.create(
                organization=self.organization,
                code="6000",
                name="Operating Expenses",
                type="EXPENSE",
                normal_balance="DEBIT"
            )

            self.depreciation_expense = ChartOfAccount.objects.create(
                organization=self.organization,
                code="6100",
                name="Depreciation Expense",
                type="EXPENSE",
                normal_balance="DEBIT"
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

    def test_account_balance_debit_account(self):
        """Test balance calculation for DEBIT account (Asset/Expense)"""
        with tenant_context(self.organization):
            # Create journal entries affecting Cash (DEBIT account)
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Cash deposit",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.cash,
                debit=Decimal('10000.00'),
                credit=Decimal('0.00')
            )

            journal2 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 2, 15),
                description="Cash payment",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal2,
                account=self.cash,
                debit=Decimal('0.00'),
                credit=Decimal('3000.00')
            )

            # Balance for DEBIT account = Debit - Credit = 10,000 - 3,000 = 7,000
            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            balance = service._calculate_account_balance(
                self.cash,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            self.assertEqual(balance, Decimal('7000.00'))

    def test_account_balance_credit_account(self):
        """Test balance calculation for CREDIT account (Liability/Revenue/Equity)"""
        with tenant_context(self.organization):
            # Create journal entries affecting Revenue (CREDIT account)
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Sale 1",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('15000.00')
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
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('8000.00'))

            # Balance for CREDIT account = Credit - Debit = 15,000 + 8,000 = 23,000
            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            balance = service._calculate_account_balance(
                self.sales_revenue,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            self.assertEqual(balance, Decimal('23000.00'))

    def test_trial_balance_opening_balances(self):
        """Test trial balance with opening balances"""
        with tenant_context(self.organization):
            # Create opening balance entry (before period)
            opening_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2025, 12, 31),
                description="Opening Balance",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening_journal,
                account=self.cash,
                debit=Decimal('50000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening_journal,
                account=self.capital,
                debit=Decimal('0.00'),
                credit=Decimal('50000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_trial_balance(
                include_opening=True,
                include_closing=False
            )

            # Should have opening balances
            cash_account = next(a for a in report['accounts'] if a['code'] == '1000')
            self.assertEqual(cash_account['opening_balance'], Decimal('50000.00'))

    def test_trial_balance_closing_balances(self):
        """Test trial balance with closing balances"""
        with tenant_context(self.organization):
            # Opening balance
            opening = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2025, 12, 31),
                description="Opening",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.cash,
                debit=Decimal('10000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.capital,
                debit=Decimal('0.00'),
                credit=Decimal('10000.00')
            )

            # Period transaction
            period_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Cash receipt",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=period_journal,
                account=self.cash,
                debit=Decimal('5000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=period_journal,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('5000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_trial_balance(
                include_opening=True,
                include_closing=True
            )

            # Closing balance = Opening + Period
            # Cash: 10,000 + 5,000 = 15,000
            cash_account = next(a for a in report['accounts'] if a['code'] == '1000')
            self.assertEqual(cash_account['closing_balance'], Decimal('15000.00'))

    def test_trial_balance_debit_credit_equality(self):
        """Test that trial balance debits equal credits"""
        with tenant_context(self.organization):
            # Create balanced journal entry
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Test transaction",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.cash,
                debit=Decimal('10000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.loan_payable,
                debit=Decimal('0.00'),
                credit=Decimal('10000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_trial_balance()

            # Total debits should equal total credits
            self.assertEqual(report['total_debits'], report['total_credits'])
            self.assertTrue(report['is_balanced'])

    def test_cash_flow_operating_activities(self):
        """Test cash flow statement operating activities section"""
        with tenant_context(self.organization):
            # Revenue (increases operating cash)
            revenue_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Cash sale",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue_journal,
                account=self.cash,
                debit=Decimal('20000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue_journal,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('20000.00')
            )

            # Operating expense (decreases operating cash)
            expense_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 20),
                description="Operating expense",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=expense_journal,
                account=self.operating_expense,
                debit=Decimal('8000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=expense_journal,
                account=self.cash,
                debit=Decimal('0.00'),
                credit=Decimal('8000.00')
            )

            # Depreciation (non-cash expense, add back)
            depreciation_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 31),
                description="Monthly depreciation",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=depreciation_journal,
                account=self.depreciation_expense,
                debit=Decimal('2000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=depreciation_journal,
                account=self.accum_depreciation,
                debit=Decimal('0.00'),
                credit=Decimal('2000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_cash_flow_statement(method='INDIRECT')

            # Net income = Revenue - Expenses = 20,000 - 8,000 - 2,000 = 10,000
            # Add back depreciation (non-cash): 10,000 + 2,000 = 12,000
            operating = report['operating_activities']
            self.assertEqual(operating['net_income'], Decimal('10000.00'))
            self.assertEqual(operating['depreciation_addback'], Decimal('2000.00'))

    def test_cash_flow_investing_activities(self):
        """Test cash flow investing activities (asset purchases/sales)"""
        with tenant_context(self.organization):
            # Purchase fixed asset (cash outflow)
            asset_purchase = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Purchase equipment",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=asset_purchase,
                account=self.fixed_assets,
                debit=Decimal('50000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=asset_purchase,
                account=self.cash,
                debit=Decimal('0.00'),
                credit=Decimal('50000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_cash_flow_statement(method='INDIRECT')

            investing = report['investing_activities']
            self.assertEqual(investing['asset_purchases'], Decimal('-50000.00'))

    def test_cash_flow_financing_activities(self):
        """Test cash flow financing activities (loans, equity)"""
        with tenant_context(self.organization):
            # Loan received (cash inflow)
            loan_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Loan proceeds",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=loan_journal,
                account=self.cash,
                debit=Decimal('30000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=loan_journal,
                account=self.loan_payable,
                debit=Decimal('0.00'),
                credit=Decimal('30000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_cash_flow_statement(method='INDIRECT')

            financing = report['financing_activities']
            self.assertEqual(financing['loan_proceeds'], Decimal('30000.00'))

    def test_profit_loss_calculation(self):
        """Test profit & loss calculation (Revenue - Expenses)"""
        with tenant_context(self.organization):
            # Revenue
            revenue_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Sales",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue_journal,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('100000.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue_journal,
                account=self.cash,
                debit=Decimal('100000.00'),
                credit=Decimal('0.00')
            )

            # Expenses
            expense_journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 20),
                description="Expenses",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=expense_journal,
                account=self.operating_expense,
                debit=Decimal('60000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=expense_journal,
                account=self.cash,
                debit=Decimal('0.00'),
                credit=Decimal('60000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_profit_loss()

            # Net Income = Revenue - Expenses = 100,000 - 60,000 = 40,000
            self.assertEqual(report['total_revenue'], Decimal('100000.00'))
            self.assertEqual(report['total_expenses'], Decimal('60000.00'))
            self.assertEqual(report['net_income'], Decimal('40000.00'))

    def test_balance_sheet_equation(self):
        """Test balance sheet equation: Assets = Liabilities + Equity"""
        with tenant_context(self.organization):
            # Opening balance: Cash 100,000 = Capital 100,000
            opening = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 1),
                description="Opening",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.cash,
                debit=Decimal('100000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.capital,
                debit=Decimal('0.00'),
                credit=Decimal('100000.00')
            )

            # Loan: Cash 50,000 = Loan Payable 50,000
            loan = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Loan",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=loan,
                account=self.cash,
                debit=Decimal('50000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=loan,
                account=self.loan_payable,
                debit=Decimal('0.00'),
                credit=Decimal('50000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_balance_sheet(as_of_date=date(2026, 3, 31))

            # Assets = 150,000 (Cash)
            # Liabilities = 50,000 (Loan)
            # Equity = 100,000 (Capital)
            # 150,000 = 50,000 + 100,000 ✓
            self.assertEqual(report['total_assets'], Decimal('150000.00'))
            self.assertEqual(report['total_liabilities'], Decimal('50000.00'))
            self.assertEqual(report['total_equity'], Decimal('100000.00'))
            self.assertTrue(report['is_balanced'])

    def test_retained_earnings_calculation(self):
        """Test retained earnings calculation (accumulated net income)"""
        with tenant_context(self.organization):
            # Opening capital
            opening = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 1),
                description="Opening",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.cash,
                debit=Decimal('50000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=opening,
                account=self.capital,
                debit=Decimal('0.00'),
                credit=Decimal('50000.00')
            )

            # Generate net income (Revenue - Expenses)
            revenue = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Revenue",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue,
                account=self.cash,
                debit=Decimal('20000.00'),
                credit=Decimal('0.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=revenue,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('20000.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            # P&L to get net income
            pl_report = service.generate_profit_loss()
            net_income = pl_report['net_income']

            # Balance sheet should include net income in equity
            bs_report = service.generate_balance_sheet(as_of_date=date(2026, 3, 31))

            # Equity = Capital + Net Income = 50,000 + 20,000 = 70,000
            self.assertEqual(bs_report['total_equity'], Decimal('70000.00'))

    def test_comparative_period_analysis(self):
        """Test comparative period reporting (current vs prior)"""
        with tenant_context(self.organization):
            # Prior period revenue (Q4 2025)
            prior_revenue = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2025, 12, 15),
                description="Prior revenue",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=prior_revenue,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('80000.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=prior_revenue,
                account=self.cash,
                debit=Decimal('80000.00'),
                credit=Decimal('0.00')
            )

            # Current period revenue (Q1 2026)
            current_revenue = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 1, 15),
                description="Current revenue",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=current_revenue,
                account=self.sales_revenue,
                debit=Decimal('0.00'),
                credit=Decimal('100000.00')
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=current_revenue,
                account=self.cash,
                debit=Decimal('100000.00'),
                credit=Decimal('0.00')
            )

            service = FinancialReportService(
                organization=self.organization,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 3, 31)
            )

            report = service.generate_profit_loss(comparative_period=True)

            # Should show growth: (100,000 - 80,000) / 80,000 = 25% increase
            self.assertIn('comparative_data', report)
            self.assertEqual(report['total_revenue'], Decimal('100000.00'))
