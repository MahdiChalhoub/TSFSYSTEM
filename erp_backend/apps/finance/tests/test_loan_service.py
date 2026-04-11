"""
Unit tests for Loan Management Service
Tests amortization methods, early payoff, and loan calculations
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date
from dateutil.relativedelta import relativedelta

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import Loan, LoanInstallment, ChartOfAccount
from apps.finance.services.loan_service import LoanService


class LoanServiceTests(TestCase):
    """Test suite for loan amortization and calculations"""

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
            self.loan_payable_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="2500",
                name="Loan Payable",
                type="LIABILITY",
                normal_balance="CREDIT"
            )

            self.interest_expense_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="6500",
                name="Interest Expense",
                type="EXPENSE",
                normal_balance="DEBIT"
            )

    def test_reducing_balance_pmt_formula(self):
        """Test reducing balance amortization using PMT formula"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Test Loan",
                principal_amount=Decimal('120000.00'),
                interest_rate=Decimal('12.00'),  # 12% annual
                term_months=60,
                amortization_method='REDUCING_BALANCE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            # PMT formula for reducing balance
            # Monthly rate = 12% / 12 = 1% = 0.01
            # PMT = P × [r(1+r)^n] / [(1+r)^n - 1]
            # PMT = 120000 × [0.01(1.01)^60] / [(1.01)^60 - 1]

            self.assertEqual(len(schedule), 60)

            # All installment amounts should be equal (characteristic of reducing balance)
            first_payment = schedule[0]['installment_amount']

            # Verify all payments are approximately equal
            for entry in schedule:
                self.assertAlmostEqual(
                    entry['installment_amount'],
                    first_payment,
                    places=2
                )

            # Interest should decrease over time (more principal, less interest)
            first_interest = schedule[0]['interest_amount']
            last_interest = schedule[-1]['interest_amount']
            self.assertGreater(first_interest, last_interest)

            # Principal should increase over time
            first_principal = schedule[0]['principal_amount']
            last_principal = schedule[-1]['principal_amount']
            self.assertGreater(last_principal, first_principal)

    def test_flat_rate_amortization(self):
        """Test flat rate amortization (simple interest)"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Flat Rate Loan",
                principal_amount=Decimal('60000.00'),
                interest_rate=Decimal('10.00'),  # 10% annual
                term_months=12,
                amortization_method='FLAT_RATE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            # Flat rate: Total interest = Principal × Rate × Time
            # Total interest = 60,000 × 10% × 1 year = 6,000
            # Monthly interest = 6,000 / 12 = 500
            # Monthly principal = 60,000 / 12 = 5,000
            # Monthly installment = 5,500

            self.assertEqual(len(schedule), 12)

            # All installments should be equal
            expected_monthly_interest = Decimal('500.00')
            expected_monthly_principal = Decimal('5000.00')
            expected_monthly_payment = Decimal('5500.00')

            for entry in schedule:
                self.assertEqual(entry['interest_amount'], expected_monthly_interest)
                self.assertEqual(entry['principal_amount'], expected_monthly_principal)
                self.assertEqual(entry['installment_amount'], expected_monthly_payment)

    def test_balloon_payment_schedule(self):
        """Test balloon payment schedule (low payments + large final payment)"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Balloon Loan",
                principal_amount=Decimal('100000.00'),
                interest_rate=Decimal('8.00'),  # 8% annual
                term_months=60,
                amortization_method='BALLOON',
                balloon_payment_amount=Decimal('50000.00'),  # 50% balloon
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            self.assertEqual(len(schedule), 60)

            # Regular payments should be lower than normal reducing balance
            regular_payment = schedule[0]['installment_amount']

            # Final payment should include balloon
            final_payment = schedule[-1]['installment_amount']

            self.assertGreater(final_payment, regular_payment)
            self.assertGreaterEqual(final_payment, Decimal('50000.00'))

    def test_interest_only_schedule(self):
        """Test interest-only schedule (pay interest first, principal at end)"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Interest-Only Loan",
                principal_amount=Decimal('80000.00'),
                interest_rate=Decimal('6.00'),  # 6% annual
                term_months=24,
                amortization_method='INTEREST_ONLY',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            self.assertEqual(len(schedule), 24)

            # Monthly interest = 80,000 × 6% / 12 = 400
            expected_monthly_interest = Decimal('400.00')

            # First 23 payments should be interest-only (no principal)
            for i in range(23):
                entry = schedule[i]
                self.assertEqual(entry['interest_amount'], expected_monthly_interest)
                self.assertEqual(entry['principal_amount'], Decimal('0.00'))
                self.assertEqual(entry['installment_amount'], expected_monthly_interest)

            # Final payment should include full principal + interest
            final_entry = schedule[-1]
            self.assertEqual(final_entry['interest_amount'], expected_monthly_interest)
            self.assertEqual(final_entry['principal_amount'], Decimal('80000.00'))
            self.assertEqual(
                final_entry['installment_amount'],
                Decimal('80000.00') + expected_monthly_interest
            )

    def test_early_payoff_calculation(self):
        """Test early payoff calculation with interest savings"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Test Loan",
                principal_amount=Decimal('60000.00'),
                interest_rate=Decimal('12.00'),
                term_months=60,
                amortization_method='REDUCING_BALANCE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)

            # Generate full schedule first
            full_schedule = service.generate_enhanced_schedule()
            total_interest_full = sum(e['interest_amount'] for e in full_schedule)

            # Calculate early payoff after 24 payments (2 years)
            early_payoff = service.calculate_early_payoff(
                payoff_date=date(2028, 1, 1)  # After 24 months
            )

            self.assertTrue(early_payoff['success'])

            # Interest savings should be positive
            self.assertGreater(early_payoff['interest_savings'], 0)

            # Remaining balance should be less than original principal
            self.assertLess(
                early_payoff['remaining_principal'],
                loan.principal_amount
            )

            # Total paid + remaining should approximately equal principal + total interest
            # (with some rounding differences)

    def test_installment_balance_after(self):
        """Test balance-after tracking for each installment"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Test Loan",
                principal_amount=Decimal('36000.00'),
                interest_rate=Decimal('12.00'),
                term_months=36,
                amortization_method='REDUCING_BALANCE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            # First installment balance_after should be principal - first principal payment
            first_entry = schedule[0]
            self.assertEqual(
                first_entry['balance_after'],
                Decimal('36000.00') - first_entry['principal_amount']
            )

            # Each subsequent balance should decrease
            for i in range(len(schedule) - 1):
                self.assertGreater(
                    schedule[i]['balance_after'],
                    schedule[i + 1]['balance_after']
                )

            # Final balance should be zero (or very close to zero)
            final_entry = schedule[-1]
            self.assertLess(final_entry['balance_after'], Decimal('1.00'))

    def test_total_interest_calculation(self):
        """Test total interest paid over loan life"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Test Loan",
                principal_amount=Decimal('50000.00'),
                interest_rate=Decimal('10.00'),
                term_months=60,
                amortization_method='REDUCING_BALANCE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            schedule = service.generate_enhanced_schedule()

            # Calculate total interest
            total_interest = sum(entry['interest_amount'] for entry in schedule)
            total_principal = sum(entry['principal_amount'] for entry in schedule)
            total_paid = sum(entry['installment_amount'] for entry in schedule)

            # Total principal should equal loan amount
            self.assertAlmostEqual(total_principal, Decimal('50000.00'), places=2)

            # Total paid = Principal + Interest
            self.assertAlmostEqual(
                total_paid,
                Decimal('50000.00') + total_interest,
                places=2
            )

            # Interest should be positive
            self.assertGreater(total_interest, 0)

    def test_loan_summary_report(self):
        """Test comprehensive loan summary report"""
        with tenant_context(self.organization):
            loan = Loan.objects.create(
                organization=self.organization,
                name="Summary Test Loan",
                principal_amount=Decimal('100000.00'),
                interest_rate=Decimal('8.00'),
                term_months=120,
                amortization_method='REDUCING_BALANCE',
                loan_payable_account=self.loan_payable_account,
                interest_expense_account=self.interest_expense_account,
                start_date=date(2026, 1, 1),
                status='ACTIVE'
            )

            service = LoanService(loan)
            summary = service.get_loan_summary()

            # Verify summary structure
            self.assertIn('loan_id', summary)
            self.assertIn('principal_amount', summary)
            self.assertIn('interest_rate', summary)
            self.assertIn('term_months', summary)
            self.assertIn('monthly_payment', summary)
            self.assertIn('total_interest', summary)
            self.assertIn('total_amount', summary)
            self.assertIn('remaining_balance', summary)
            self.assertIn('payments_made', summary)

            # Verify calculations
            self.assertEqual(summary['principal_amount'], Decimal('100000.00'))
            self.assertEqual(summary['interest_rate'], Decimal('8.00'))
            self.assertEqual(summary['term_months'], 120)

            # Total amount = Principal + Interest
            self.assertEqual(
                summary['total_amount'],
                summary['principal_amount'] + summary['total_interest']
            )
