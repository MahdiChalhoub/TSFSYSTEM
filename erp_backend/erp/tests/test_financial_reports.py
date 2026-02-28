from rest_framework.test import APITestCase
from django.utils import timezone
from erp.models import Organization
from apps.finance.models import ChartOfAccount, JournalEntry, FiscalYear
from erp.services import ProvisioningService
from apps.finance.services import LedgerService
from decimal import Decimal

class FinancialReportTests(APITestCase):

    def setUp(self):
        self.org = ProvisioningService.provision_organization(name="Report Corp", slug="report-corp")
        self.client.defaults['HTTP_X_TENANT_ID'] = str(self.org.id)

        # Directly trigger finance setup (no SystemModule records in test DB)
        from apps.finance.events import handle_event
        from apps.inventory.models import Warehouse
        branch = Warehouse.objects.filter(organization=self.org, location_type='BRANCH').first()
        handle_event('org:provisioned', {
            'org_id': str(self.org.id),
            'org_name': self.org.name,
            'org_slug': self.org.slug,
            'site_id': str(branch.id) if branch else '',
        }, organization_id=self.org.id)
        
        # Post some transactions to have data
        cash = ChartOfAccount.objects.get(organization=self.org, code='1310')
        capital = ChartOfAccount.objects.get(organization=self.org, code='3000')
        revenue = ChartOfAccount.objects.get(organization=self.org, code='4100')
        expense = ChartOfAccount.objects.get(organization=self.org, code='5200')
        
        # 1. Capital Injection (Dr Cash 1000, Cr Equity 1000)
        LedgerService.create_journal_entry(
            self.org, timezone.now().date(), "Capital",
            [
                {"account_id": cash.id, "debit": 1000, "credit": 0},
                {"account_id": capital.id, "debit": 0, "credit": 1000}
            ],
            status='POSTED'
        )
        
        # 2. Revenue Sale (Dr Cash 200, Cr Revenue 200)
        LedgerService.create_journal_entry(
            self.org, timezone.now().date(), "Sale",
            [
                {"account_id": cash.id, "debit": 200, "credit": 0},
                {"account_id": revenue.id, "debit": 0, "credit": 200}
            ],
            status='POSTED'
        )
        
        # 3. Expense Payment (Dr Expense 50, Cr Cash 50)
        LedgerService.create_journal_entry(
            self.org, timezone.now().date(), "Expense",
            [
                {"account_id": expense.id, "debit": 50, "credit": 0},
                {"account_id": cash.id, "debit": 0, "credit": 50}
            ],
            status='POSTED'
        )
        
        # Expected Balances:
        # Cash: 1000 + 200 - 50 = 1150 (Asset -> Positive Balance in checks?) 
        # Note: In our model, Balance = Debit - Credit. Assets are Dr normal. So +1150.
        # Equity: 1000 (Credit) -> -1000 (if Dr-Cr) or just 1000 Cr.
        # Logic in Service: balance = balance + (debit - credit). So Credit accounts will be negative.
        # Equity: 0 + (0 - 1000) = -1000.
        # Revenue: 0 + (0 - 200) = -200.
        # Expense: 0 + (50 - 0) = 50.

    def test_trial_balance(self):
        print("\n>>> Testing Trial Balance...")
        tb = LedgerService.get_trial_balance(self.org, scope='OFFICIAL')
        
        cash = next(a for a in tb if a.code == '1310')
        self.assertEqual(cash.rollup_balance, Decimal('1150.00'))
        
        revenue = next(a for a in tb if a.code == '4100')
        self.assertEqual(revenue.rollup_balance, Decimal('-200.00'))
        
        # Verify Total Debits = Total Credits (Sum of balances should be 0)
        total = sum(a.rollup_balance for a in tb if a.parent is None)
        self.assertTrue(abs(total) < Decimal('0.01'), f"Trial Balance not zero: {total}")
        print(f"[OK] Trial Balance Verified. Net: {total}")

    def test_profit_and_loss(self):
        print("\n>>> Testing P&L...")
        pnl = LedgerService.get_profit_loss(self.org, scope='OFFICIAL')
        
        # Revenue is Cr 200 => Income is +200 in P&L report usually (abs value)
        # Service: total_income = abs(sum(income_accs))
        self.assertEqual(pnl['revenue'], Decimal('200.00'))
        
        # Expenses is Dr 50 => +50
        self.assertEqual(pnl['expenses'], Decimal('50.00'))
        
        # Net Income = 200 - 50 = 150
        self.assertEqual(pnl['net_income'], Decimal('150.00'))
        print(f"[OK] P&L Verified. Net Income: {pnl['net_income']}")

    def test_balance_sheet(self):
        print("\n>>> Testing Balance Sheet...")
        bs = LedgerService.get_balance_sheet(self.org, scope='OFFICIAL')
        
        # Assets: Cash 1150
        self.assertEqual(bs['assets'], Decimal('1150.00'))
        
        # Equity: Capital 1000
        self.assertEqual(bs['equity'], Decimal('1000.00'))
        
        # Liabilities: 0
        self.assertEqual(bs['liabilities'], Decimal('0.00'))
        
        # Current Earnings (from P&L): 150
        self.assertEqual(bs['current_earnings'], Decimal('150.00'))
        
        # Check Balance Equation: Assets = Liabilities + Equity + Earnings
        # 1150 = 0 + 1000 + 150
        self.assertTrue(bs['is_balanced'])
        print(f"[OK] Balance Sheet Balanced.")
