"""
Unit tests for Asset Depreciation Service
Tests all depreciation methods, posting logic, and disposal calculations
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date
from dateutil.relativedelta import relativedelta

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import (
    ChartOfAccount, Asset, DepreciationScheduleEntry,
    JournalEntry, JournalEntryLine, FiscalYear, FiscalPeriod
)
from apps.finance.services.depreciation_service import DepreciationService


class DepreciationServiceTests(TestCase):
    """Test suite for depreciation calculations and posting"""

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
            self.asset_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1500",
                name="Fixed Assets",
                type="ASSET",
                normal_balance="DEBIT"
            )

            self.accum_depreciation_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1510",
                name="Accumulated Depreciation",
                type="ASSET",
                normal_balance="CREDIT"
            )

            self.depreciation_expense_account = ChartOfAccount.objects.create(
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
                name="March 2026",
                start_date=date(2026, 3, 1),
                end_date=date(2026, 3, 31),
                status="OPEN"
            )

    def test_straight_line_depreciation(self):
        """Test straight-line depreciation calculation"""
        with tenant_context(self.organization):
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Equipment",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('120000.00'),
                salvage_value=Decimal('20000.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            schedule = service.generate_depreciation_schedule()

            # Depreciable amount = 120,000 - 20,000 = 100,000
            # Monthly depreciation = 100,000 / 60 = 1,666.67
            expected_monthly = Decimal('1666.67')

            self.assertEqual(len(schedule), 60)
            self.assertEqual(schedule[0]['amount'], expected_monthly)

            # All monthly amounts should be equal for straight-line
            amounts = [entry['amount'] for entry in schedule]
            self.assertTrue(all(amt == expected_monthly for amt in amounts))

    def test_declining_balance_depreciation(self):
        """Test declining balance (accelerated) depreciation"""
        with tenant_context(self.organization):
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Vehicle",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('60000.00'),
                salvage_value=Decimal('10000.00'),
                useful_life_months=60,
                depreciation_method='DECLINING',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            schedule = service.generate_depreciation_schedule()

            # Declining balance: 200% / 60 months = 3.33% per month of book value
            # First month: 60,000 × 0.0333 = 2,000
            first_month = schedule[0]['amount']

            # Second month should be less (declining)
            second_month = schedule[1]['amount']

            self.assertEqual(len(schedule), 60)
            self.assertGreater(first_month, second_month)

            # Amounts should decline each month
            for i in range(len(schedule) - 1):
                self.assertGreaterEqual(schedule[i]['amount'], schedule[i + 1]['amount'])

    def test_units_of_production_depreciation(self):
        """Test units of production depreciation"""
        with tenant_context(self.organization):
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Machine",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('100000.00'),
                salvage_value=Decimal('10000.00'),
                total_units=10000,
                depreciation_method='UNITS',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)

            # Depreciable amount = 100,000 - 10,000 = 90,000
            # Per unit = 90,000 / 10,000 = 9.00
            # For 500 units: 500 × 9.00 = 4,500
            depreciation = service._calculate_units_depreciation(500)

            self.assertEqual(depreciation, Decimal('4500.00'))

    def test_depreciation_schedule_generation(self):
        """Test full depreciation schedule generation"""
        with tenant_context(self.organization):
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('60000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=12,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            schedule = service.generate_depreciation_schedule()

            # Should create database entries
            db_entries = DepreciationScheduleEntry.objects.filter(asset=asset)

            self.assertEqual(len(schedule), 12)
            self.assertEqual(db_entries.count(), 12)

            # Verify structure
            first_entry = schedule[0]
            self.assertIn('period_date', first_entry)
            self.assertIn('amount', first_entry)
            self.assertIn('accumulated_depreciation', first_entry)
            self.assertIn('book_value', first_entry)

            # Verify cumulative
            total_depreciation = sum(entry['amount'] for entry in schedule)
            self.assertEqual(total_depreciation, Decimal('60000.00'))

    def test_monthly_posting_creates_journal_entry(self):
        """Test that posting monthly depreciation creates correct journal entry"""
        with tenant_context(self.organization):
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('120000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            service.generate_depreciation_schedule()

            # Post depreciation for March 2026
            result = service.post_monthly_depreciation(month=3, year=2026)

            self.assertTrue(result['success'])
            self.assertIsNotNone(result['journal_entry'])

            # Verify journal entry
            entry = result['journal_entry']
            lines = JournalEntryLine.objects.filter(journal_entry=entry)

            self.assertEqual(lines.count(), 2)

            # Should have: DR Depreciation Expense, CR Accumulated Depreciation
            debit_line = lines.filter(debit__gt=0).first()
            credit_line = lines.filter(credit__gt=0).first()

            self.assertEqual(debit_line.account, self.depreciation_expense_account)
            self.assertEqual(credit_line.account, self.accum_depreciation_account)
            self.assertEqual(debit_line.debit, Decimal('2000.00'))  # 120,000 / 60
            self.assertEqual(credit_line.credit, Decimal('2000.00'))

    def test_asset_disposal_with_gain(self):
        """Test asset disposal when sale price > book value (gain)"""
        with tenant_context(self.organization):
            # Create disposal accounts
            cash_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1000",
                name="Cash",
                type="ASSET",
                normal_balance="DEBIT"
            )

            gain_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="7100",
                name="Gain on Disposal",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('100000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            service.generate_depreciation_schedule()

            # Post 12 months of depreciation
            # Monthly = 100,000 / 60 = 1,666.67
            # 12 months = 20,000
            # Book value = 100,000 - 20,000 = 80,000
            for month in range(1, 13):
                service.post_monthly_depreciation(month=month, year=2026)

            # Dispose for 90,000 (gain of 10,000)
            result = service.dispose_asset(
                disposal_date=date(2026, 12, 31),
                disposal_amount=Decimal('90000.00'),
                disposal_account=cash_account,
                gain_loss_account=gain_account
            )

            self.assertTrue(result['success'])
            self.assertEqual(result['gain_loss'], Decimal('10000.00'))
            self.assertEqual(result['gain_loss_type'], 'GAIN')

            # Verify asset status
            asset.refresh_from_db()
            self.assertEqual(asset.status, 'DISPOSED')

    def test_asset_disposal_with_loss(self):
        """Test asset disposal when sale price < book value (loss)"""
        with tenant_context(self.organization):
            cash_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1000",
                name="Cash",
                type="ASSET",
                normal_balance="DEBIT"
            )

            loss_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="8100",
                name="Loss on Disposal",
                type="EXPENSE",
                normal_balance="DEBIT"
            )

            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('100000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            service.generate_depreciation_schedule()

            # Post 12 months (book value = 80,000)
            for month in range(1, 13):
                service.post_monthly_depreciation(month=month, year=2026)

            # Dispose for 70,000 (loss of 10,000)
            result = service.dispose_asset(
                disposal_date=date(2026, 12, 31),
                disposal_amount=Decimal('70000.00'),
                disposal_account=cash_account,
                gain_loss_account=loss_account
            )

            self.assertTrue(result['success'])
            self.assertEqual(result['gain_loss'], Decimal('-10000.00'))
            self.assertEqual(result['gain_loss_type'], 'LOSS')

    def test_disposal_updates_asset_status(self):
        """Test that disposal updates asset status to DISPOSED"""
        with tenant_context(self.organization):
            cash_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1000",
                name="Cash",
                type="ASSET",
                normal_balance="DEBIT"
            )

            gain_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="7100",
                name="Gain on Disposal",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('50000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)

            # Dispose asset
            service.dispose_asset(
                disposal_date=date(2026, 3, 31),
                disposal_amount=Decimal('45000.00'),
                disposal_account=cash_account,
                gain_loss_account=gain_account
            )

            # Verify status change
            asset.refresh_from_db()
            self.assertEqual(asset.status, 'DISPOSED')
            self.assertEqual(asset.disposal_date, date(2026, 3, 31))

    def test_zero_book_value_disposal(self):
        """Test disposal of fully depreciated asset (zero book value)"""
        with tenant_context(self.organization):
            cash_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1000",
                name="Cash",
                type="ASSET",
                normal_balance="DEBIT"
            )

            gain_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="7100",
                name="Gain on Disposal",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('60000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2021, 1, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            service.generate_depreciation_schedule()

            # Post all 60 months (fully depreciated)
            for month in range(1, 61):
                year = 2021 + (month - 1) // 12
                month_num = ((month - 1) % 12) + 1
                service.post_monthly_depreciation(month=month_num, year=year)

            # Book value should be 0
            asset.refresh_from_db()
            self.assertEqual(asset.book_value, Decimal('0.00'))

            # Dispose for any amount (all gain)
            result = service.dispose_asset(
                disposal_date=date(2026, 1, 1),
                disposal_amount=Decimal('5000.00'),
                disposal_account=cash_account,
                gain_loss_account=gain_account
            )

            self.assertTrue(result['success'])
            self.assertEqual(result['gain_loss'], Decimal('5000.00'))
            self.assertEqual(result['gain_loss_type'], 'GAIN')

    def test_partial_year_depreciation(self):
        """Test pro-rata depreciation for partial year"""
        with tenant_context(self.organization):
            # Asset acquired mid-year (July 1)
            asset = Asset.objects.create(
                organization=self.organization,
                name="Test Asset",
                asset_account=self.asset_account,
                accumulated_depreciation_account=self.accum_depreciation_account,
                depreciation_expense_account=self.depreciation_expense_account,
                acquisition_cost=Decimal('120000.00'),
                salvage_value=Decimal('0.00'),
                useful_life_months=60,
                depreciation_method='LINEAR',
                acquisition_date=date(2026, 7, 1),
                status='ACTIVE'
            )

            service = DepreciationService(asset)
            schedule = service.generate_depreciation_schedule()

            # Should have 60 monthly entries starting from July
            self.assertEqual(len(schedule), 60)

            # First entry should be for July 2026
            first_entry = schedule[0]
            self.assertEqual(first_entry['period_date'].month, 7)
            self.assertEqual(first_entry['period_date'].year, 2026)

            # Monthly amount = 120,000 / 60 = 2,000
            self.assertEqual(first_entry['amount'], Decimal('2000.00'))
