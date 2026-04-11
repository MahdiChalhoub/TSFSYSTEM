"""
Unit tests for Bank Reconciliation Service
Tests auto-matching algorithms, CSV import, and reconciliation logic
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date, timedelta
from io import StringIO

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import (
    ChartOfAccount, BankAccount, BankStatement, BankStatementLine,
    JournalEntry, JournalEntryLine, FiscalYear
)
from apps.finance.services.bank_reconciliation_service import BankReconciliationService
from apps.finance.services.bank_statement_import_service import BankStatementImportService


class BankReconciliationServiceTests(TestCase):
    """Test suite for bank reconciliation"""

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
            self.bank_account_gl = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1050",
                name="Bank Account - Main",
                type="ASSET",
                normal_balance="DEBIT"
            )

            self.revenue_account = ChartOfAccount.objects.create(
                organization=self.organization,
                code="4000",
                name="Revenue",
                type="REVENUE",
                normal_balance="CREDIT"
            )

            # Create Bank Account
            self.bank_account = BankAccount.objects.create(
                organization=self.organization,
                name="Main Bank Account",
                account_number="123456789",
                gl_account=self.bank_account_gl,
                currency="USD"
            )

            # Create Fiscal Year
            self.fiscal_year = FiscalYear.objects.create(
                organization=self.organization,
                name="FY2026",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                is_closed=False
            )

            # Create Bank Statement
            self.statement = BankStatement.objects.create(
                organization=self.organization,
                bank_account=self.bank_account,
                statement_date=date(2026, 3, 31),
                opening_balance=Decimal('10000.00'),
                closing_balance=Decimal('25000.00'),
                status='PENDING'
            )

    def test_exact_match_level1(self):
        """Test Level 1 matching: Exact amount and date"""
        with tenant_context(self.organization):
            # Create journal entry (book transaction)
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Customer payment",
                status="POSTED",
                reference="REF001"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.bank_account_gl,
                debit=Decimal('5000.00'),
                credit=Decimal('0.00')
            )

            # Create bank statement line (bank transaction)
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 15),  # Exact date match
                description="Customer payment",
                reference="REF001",
                amount=Decimal('5000.00'),  # Exact amount match
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)
            result = service.auto_match_transactions(level=1)

            # Should match with Level 1 (exact)
            self.assertTrue(result['success'])
            self.assertEqual(result['matched_count'], 1)

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'MATCHED')
            self.assertIsNotNone(statement_line.matched_journal_entry)

    def test_date_tolerance_level2(self):
        """Test Level 2 matching: Amount match with ±3 days date tolerance"""
        with tenant_context(self.organization):
            # Journal entry on March 15
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Payment",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.bank_account_gl,
                debit=Decimal('3000.00'),
                credit=Decimal('0.00')
            )

            # Bank transaction on March 17 (2 days later, within tolerance)
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 17),  # +2 days
                description="Payment",
                amount=Decimal('3000.00'),  # Same amount
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)

            # Level 1 should fail (date not exact)
            result_l1 = service.auto_match_transactions(level=1)
            self.assertEqual(result_l1['matched_count'], 0)

            # Level 2 should succeed (within ±3 days)
            result_l2 = service.auto_match_transactions(level=2)
            self.assertEqual(result_l2['matched_count'], 1)

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'MATCHED')

    def test_reference_match_level3(self):
        """Test Level 3 matching: Reference number match"""
        with tenant_context(self.organization):
            # Journal entry with reference
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 10),
                description="Invoice payment",
                status="POSTED",
                reference="INV-2026-001"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.bank_account_gl,
                debit=Decimal('7500.00'),
                credit=Decimal('0.00')
            )

            # Bank transaction with same reference but different date/amount
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 20),  # Different date
                description="Payment for INV-2026-001",
                reference="INV-2026-001",  # Same reference
                amount=Decimal('7500.00'),
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)
            result = service.auto_match_transactions(level=3)

            # Should match by reference
            self.assertEqual(result['matched_count'], 1)

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'MATCHED')

    def test_fuzzy_amount_match_level4(self):
        """Test Level 4 matching: Fuzzy amount match (±1%)"""
        with tenant_context(self.organization):
            # Journal entry: 10,000.00
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Transaction",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.bank_account_gl,
                debit=Decimal('10000.00'),
                credit=Decimal('0.00')
            )

            # Bank transaction: 10,050.00 (0.5% difference, within 1%)
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 15),
                description="Transaction",
                amount=Decimal('10050.00'),  # 50 difference (0.5%)
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)
            result = service.auto_match_transactions(level=4)

            # Should match with fuzzy amount tolerance
            self.assertEqual(result['matched_count'], 1)

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'MATCHED')

    def test_no_match_creates_exception(self):
        """Test that unmatched transactions are flagged as exceptions"""
        with tenant_context(self.organization):
            # Bank transaction with no corresponding journal entry
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 20),
                description="Unknown transaction",
                amount=Decimal('999.99'),
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)
            result = service.auto_match_transactions(level=4)

            # Should have 0 matches
            self.assertEqual(result['matched_count'], 0)

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'UNMATCHED')

            # Should appear in exceptions
            exceptions = service.get_unmatched_transactions()
            self.assertEqual(len(exceptions['statement_lines']), 1)

    def test_manual_match(self):
        """Test manual matching override"""
        with tenant_context(self.organization):
            # Journal entry
            journal = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 10),
                description="Manual entry",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal,
                account=self.bank_account_gl,
                debit=Decimal('4500.00'),
                credit=Decimal('0.00')
            )

            # Bank transaction (different amount, won't auto-match)
            statement_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 25),
                description="Manual transaction",
                amount=Decimal('4600.00'),  # Different amount
                type='DEPOSIT'
            )

            service = BankReconciliationService(self.statement)

            # Manual match
            result = service.manual_match(
                statement_line_id=statement_line.id,
                journal_entry_id=journal.id
            )

            self.assertTrue(result['success'])

            statement_line.refresh_from_db()
            self.assertEqual(statement_line.reconciliation_status, 'MATCHED')
            self.assertEqual(statement_line.matched_journal_entry, journal)

    def test_reconciliation_report(self):
        """Test reconciliation summary report"""
        with tenant_context(self.organization):
            # Create matched transaction
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Matched",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.bank_account_gl,
                debit=Decimal('5000.00'),
                credit=Decimal('0.00')
            )

            matched_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 15),
                amount=Decimal('5000.00'),
                type='DEPOSIT',
                reconciliation_status='MATCHED',
                matched_journal_entry=journal1
            )

            # Create unmatched transaction
            unmatched_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 20),
                amount=Decimal('2000.00'),
                type='WITHDRAWAL',
                reconciliation_status='UNMATCHED'
            )

            service = BankReconciliationService(self.statement)
            report = service.generate_reconciliation_report()

            # Verify report structure
            self.assertEqual(report['statement_id'], self.statement.id)
            self.assertEqual(report['matched_count'], 1)
            self.assertEqual(report['unmatched_count'], 1)
            self.assertEqual(report['matched_total'], Decimal('5000.00'))
            self.assertEqual(report['unmatched_total'], Decimal('2000.00'))

    def test_csv_import_validation(self):
        """Test CSV import with required fields validation"""
        with tenant_context(self.organization):
            # Valid CSV content
            csv_content = """Date,Description,Reference,Amount,Type
2026-03-15,Customer Payment,REF001,5000.00,DEPOSIT
2026-03-20,Supplier Payment,REF002,-3000.00,WITHDRAWAL
"""

            csv_file = StringIO(csv_content)
            csv_file.name = "statement.csv"

            import_service = BankStatementImportService(
                organization=self.organization,
                bank_account=self.bank_account
            )

            result = import_service.import_csv(
                file=csv_file,
                statement_date=date(2026, 3, 31)
            )

            self.assertTrue(result['success'])
            self.assertEqual(result['imported_count'], 2)

            # Verify lines were created
            lines = BankStatementLine.objects.filter(
                statement__bank_account=self.bank_account
            )
            self.assertEqual(lines.count(), 2)

    def test_duplicate_detection(self):
        """Test duplicate transaction detection"""
        with tenant_context(self.organization):
            # Create original transaction
            original_line = BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 15),
                description="Payment",
                reference="DUP001",
                amount=Decimal('5000.00'),
                type='DEPOSIT'
            )

            # Try to create duplicate
            csv_content = """Date,Description,Reference,Amount,Type
2026-03-15,Payment,DUP001,5000.00,DEPOSIT
"""

            csv_file = StringIO(csv_content)
            csv_file.name = "statement.csv"

            import_service = BankStatementImportService(
                organization=self.organization,
                bank_account=self.bank_account
            )

            result = import_service.import_csv(
                file=csv_file,
                statement_date=date(2026, 3, 31),
                skip_duplicates=True
            )

            # Should detect duplicate and skip
            self.assertTrue(result['success'])
            self.assertEqual(result['skipped_count'], 1)
            self.assertEqual(result['imported_count'], 0)

    def test_multi_account_reconciliation(self):
        """Test reconciling multiple bank accounts"""
        with tenant_context(self.organization):
            # Create second bank account
            second_bank_gl = ChartOfAccount.objects.create(
                organization=self.organization,
                code="1051",
                name="Bank Account - Secondary",
                type="ASSET",
                normal_balance="DEBIT"
            )

            second_bank = BankAccount.objects.create(
                organization=self.organization,
                name="Secondary Bank Account",
                account_number="987654321",
                gl_account=second_bank_gl,
                currency="USD"
            )

            second_statement = BankStatement.objects.create(
                organization=self.organization,
                bank_account=second_bank,
                statement_date=date(2026, 3, 31),
                opening_balance=Decimal('5000.00'),
                closing_balance=Decimal('8000.00'),
                status='PENDING'
            )

            # Create transactions for each bank
            journal1 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Bank 1 transaction",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal1,
                account=self.bank_account_gl,
                debit=Decimal('1000.00'),
                credit=Decimal('0.00')
            )

            journal2 = JournalEntry.objects.create(
                organization=self.organization,
                entry_date=date(2026, 3, 15),
                description="Bank 2 transaction",
                status="POSTED"
            )
            JournalEntryLine.objects.create(
                organization=self.organization,
                journal_entry=journal2,
                account=second_bank_gl,
                debit=Decimal('3000.00'),
                credit=Decimal('0.00')
            )

            # Bank statement lines
            BankStatementLine.objects.create(
                organization=self.organization,
                statement=self.statement,
                transaction_date=date(2026, 3, 15),
                amount=Decimal('1000.00'),
                type='DEPOSIT'
            )

            BankStatementLine.objects.create(
                organization=self.organization,
                statement=second_statement,
                transaction_date=date(2026, 3, 15),
                amount=Decimal('3000.00'),
                type='DEPOSIT'
            )

            # Reconcile both accounts
            service1 = BankReconciliationService(self.statement)
            result1 = service1.auto_match_transactions(level=1)

            service2 = BankReconciliationService(second_statement)
            result2 = service2.auto_match_transactions(level=1)

            # Both should match independently
            self.assertEqual(result1['matched_count'], 1)
            self.assertEqual(result2['matched_count'], 1)
