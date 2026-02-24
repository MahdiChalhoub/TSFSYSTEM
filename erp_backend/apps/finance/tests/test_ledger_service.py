"""
Finance Module — LedgerService Tests
=====================================
Tests for the core double-entry bookkeeping engine.
Covers: journal creation, balance validation, posting, reversal,
        hash chain integrity, fiscal period enforcement, and immutability.

These tests are the most critical in the entire system.
If the ledger is wrong, everything downstream is wrong.
"""
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone

from erp.models import Organization, User, Site
from apps.finance.models import (
    ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine,
)
from apps.finance.services import LedgerService


class LedgerTestBase(TestCase):
    """Shared fixtures for all ledger tests."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org', slug='test-ledger-org'
        )
        cls.user = User.objects.create_user(
            username='ledger_admin', password='test123',
            email='ledger@test.com', organization=cls.org,
        )
        cls.site = Site.objects.create(
            name='HQ', code='HQ', organization=cls.org,
        )

        # ── Chart of Accounts ────────────────────────────────
        cls.cash_account = ChartOfAccount.objects.create(
            organization=cls.org, code='5110', name='Cash',
            type='ASSET', balance=Decimal('0.00'),
        )
        cls.revenue_account = ChartOfAccount.objects.create(
            organization=cls.org, code='7000', name='Revenue',
            type='REVENUE', balance=Decimal('0.00'),
        )
        cls.expense_account = ChartOfAccount.objects.create(
            organization=cls.org, code='6000', name='Expenses',
            type='EXPENSE', balance=Decimal('0.00'),
        )
        cls.inventory_account = ChartOfAccount.objects.create(
            organization=cls.org, code='3100', name='Inventory',
            type='ASSET', balance=Decimal('0.00'),
        )
        cls.system_account = ChartOfAccount.objects.create(
            organization=cls.org, code='9999', name='System Reserved',
            type='ASSET', is_system_only=True, balance=Decimal('0.00'),
        )

        # ── Fiscal Year & Period ─────────────────────────────
        today = date.today()
        cls.fiscal_year = FiscalYear.objects.create(
            organization=cls.org,
            name=f'FY-{today.year}',
            start_date=date(today.year, 1, 1),
            end_date=date(today.year, 12, 31),
        )
        cls.fiscal_period = FiscalPeriod.objects.create(
            organization=cls.org,
            fiscal_year=cls.fiscal_year,
            name=f'P{today.month:02d}-{today.year}',
            start_date=date(today.year, today.month, 1),
            end_date=date(today.year, today.month, 28),  # Simplified
        )


class TestJournalEntryCreation(LedgerTestBase):
    """Tests for LedgerService.create_journal_entry()"""

    def test_balanced_entry_creates_successfully(self):
        """A balanced journal entry (debit == credit) should be created as DRAFT."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Test balanced entry',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('1000.00'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('1000.00')},
            ],
            user=self.user,
        )
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'DRAFT')
        self.assertEqual(entry.organization_id, self.org.id)
        self.assertEqual(entry.lines.count(), 2)

    def test_unbalanced_entry_raises_validation_error(self):
        """An unbalanced journal entry should raise ValidationError."""
        with self.assertRaises(ValidationError) as ctx:
            LedgerService.create_journal_entry(
                organization=self.org,
                transaction_date=timezone.now(),
                description='Unbalanced entry',
                lines=[
                    {'account_id': self.cash_account.id, 'debit': Decimal('1000.00'), 'credit': Decimal('0')},
                    {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('500.00')},
                ],
                user=self.user,
            )
        self.assertIn('out of balance', str(ctx.exception).lower())

    def test_entry_in_closed_period_raises_error(self):
        """Cannot create entries in a closed fiscal period."""
        self.fiscal_period.is_closed = True
        self.fiscal_period.save()
        try:
            with self.assertRaises(ValidationError) as ctx:
                LedgerService.create_journal_entry(
                    organization=self.org,
                    transaction_date=timezone.now(),
                    description='Entry in closed period',
                    lines=[
                        {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                        {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
                    ],
                    user=self.user,
                )
            self.assertIn('closed', str(ctx.exception).lower())
        finally:
            self.fiscal_period.is_closed = False
            self.fiscal_period.save()

    def test_entry_in_hard_locked_year_raises_error(self):
        """Cannot create entries in a hard-locked fiscal year."""
        self.fiscal_year.is_hard_locked = True
        self.fiscal_year.save()
        try:
            with self.assertRaises(ValidationError) as ctx:
                LedgerService.create_journal_entry(
                    organization=self.org,
                    transaction_date=timezone.now(),
                    description='Entry in locked year',
                    lines=[
                        {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                        {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
                    ],
                    user=self.user,
                )
            self.assertIn('hard-locked', str(ctx.exception).lower())
        finally:
            self.fiscal_year.is_hard_locked = False
            self.fiscal_year.save()

    def test_system_account_blocked_without_bypass(self):
        """Manual posting to system-only accounts should be blocked."""
        with self.assertRaises(ValidationError) as ctx:
            LedgerService.create_journal_entry(
                organization=self.org,
                transaction_date=timezone.now(),
                description='System account test',
                lines=[
                    {'account_id': self.system_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                    {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
                ],
                user=self.user,
            )
        self.assertIn('system-only', str(ctx.exception).lower())

    def test_system_account_allowed_with_bypass(self):
        """Internal bypass flag should allow posting to system accounts."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Bypass test',
            lines=[
                {'account_id': self.system_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            user=self.user,
            internal_bypass=True,
        )
        self.assertIsNotNone(entry)

    def test_auto_reference_generation(self):
        """If no reference is provided, one should be auto-generated."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Auto ref test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            user=self.user,
        )
        self.assertIsNotNone(entry.reference)
        self.assertTrue(len(entry.reference) > 0)

    def test_direct_post_on_creation(self):
        """Passing status='POSTED' should auto-post the entry."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Direct post test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('500'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('500')},
            ],
            status='POSTED',
            user=self.user,
        )
        self.assertEqual(entry.status, 'POSTED')
        self.assertIsNotNone(entry.posted_at)

    def test_multi_line_entry(self):
        """Journal entries with 3+ lines should work if balanced."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Multi-line entry',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('500'), 'credit': Decimal('0')},
                {'account_id': self.inventory_account.id, 'debit': Decimal('300'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('800')},
            ],
            user=self.user,
        )
        self.assertEqual(entry.lines.count(), 3)
        total_debit = sum(l.debit for l in entry.lines.all())
        total_credit = sum(l.credit for l in entry.lines.all())
        self.assertEqual(total_debit, total_credit)


class TestJournalEntryPosting(LedgerTestBase):
    """Tests for LedgerService.post_journal_entry()"""

    def test_posting_updates_account_balances(self):
        """Posting a journal entry should update the COA balances."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Balance update test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('1000'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('1000')},
            ],
            user=self.user,
        )
        # Post it
        LedgerService.post_journal_entry(entry, user=self.user)
        entry.refresh_from_db()

        self.assertEqual(entry.status, 'POSTED')
        self.assertIsNotNone(entry.posted_at)

        # Check account balances
        self.cash_account.refresh_from_db()
        self.revenue_account.refresh_from_db()
        self.assertEqual(self.cash_account.balance, Decimal('1000.00'))
        self.assertEqual(self.revenue_account.balance, Decimal('-1000.00'))

    def test_posting_creates_hash_chain(self):
        """Posted entries should have a SHA-256 hash and link to previous."""
        entry1 = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Hash chain test 1',
            reference='HC-001',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED',
            user=self.user,
        )
        entry1.refresh_from_db()
        self.assertEqual(entry1.previous_hash, 'GENESIS')
        self.assertIsNotNone(entry1.entry_hash)
        self.assertEqual(len(entry1.entry_hash), 64)  # SHA-256 hex length

        entry2 = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Hash chain test 2',
            reference='HC-002',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('200'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('200')},
            ],
            status='POSTED',
            user=self.user,
        )
        entry2.refresh_from_db()
        self.assertEqual(entry2.previous_hash, entry1.entry_hash)
        self.assertNotEqual(entry2.entry_hash, entry1.entry_hash)

    def test_double_posting_is_idempotent(self):
        """Posting an already-posted entry should be a no-op."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Double post test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED',
            user=self.user,
        )
        original_balance = ChartOfAccount.objects.get(id=self.cash_account.id).balance

        # Post again
        LedgerService.post_journal_entry(entry, user=self.user)

        # Balance should NOT have doubled
        self.cash_account.refresh_from_db()
        self.assertEqual(self.cash_account.balance, original_balance)


class TestJournalEntryImmutability(LedgerTestBase):
    """Tests for immutability guards on posted entries."""

    def test_posted_entry_cannot_be_modified(self):
        """Modifying a POSTED entry should raise ValidationError."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Immutability test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED',
            user=self.user,
        )
        entry.description = 'TAMPERED'
        with self.assertRaises(ValidationError) as ctx:
            entry.save()
        self.assertIn('immutable', str(ctx.exception).lower())

    def test_posted_entry_cannot_be_deleted(self):
        """Deleting a POSTED entry should raise ValidationError."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Deletion guard test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED',
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            entry.delete()
        self.assertIn('immutable', str(ctx.exception).lower())

    def test_draft_entry_can_be_deleted(self):
        """DRAFT entries should be deletable."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Draft delete test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            user=self.user,
        )
        entry_id = entry.id
        entry.delete()
        self.assertFalse(JournalEntry.objects.filter(id=entry_id).exists())


class TestJournalEntryReversal(LedgerTestBase):
    """Tests for LedgerService.reverse_journal_entry()"""

    def test_reversal_creates_opposite_entry(self):
        """Reversing a posted entry should create a new entry with swapped debits/credits."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Reversal test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('500'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('500')},
            ],
            status='POSTED',
            user=self.user,
        )

        reversal = LedgerService.reverse_journal_entry(
            organization=self.org, entry_id=entry.id, user=self.user,
        )
        self.assertEqual(reversal.status, 'POSTED')
        self.assertIn('Reversal', reversal.description)

        # Check lines are swapped
        original_lines = list(entry.lines.order_by('id'))
        reversal_lines = list(reversal.lines.order_by('id'))
        for orig, rev in zip(original_lines, reversal_lines):
            self.assertEqual(orig.debit, rev.credit)
            self.assertEqual(orig.credit, rev.debit)

    def test_reversal_nets_balance_to_zero(self):
        """After reversal, the net effect on account balances should be zero."""
        initial_cash = ChartOfAccount.objects.get(id=self.cash_account.id).balance
        initial_rev = ChartOfAccount.objects.get(id=self.revenue_account.id).balance

        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Net zero test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('300'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('300')},
            ],
            status='POSTED',
            user=self.user,
        )
        LedgerService.reverse_journal_entry(
            organization=self.org, entry_id=entry.id, user=self.user,
        )

        self.cash_account.refresh_from_db()
        self.revenue_account.refresh_from_db()
        self.assertEqual(self.cash_account.balance, initial_cash)
        self.assertEqual(self.revenue_account.balance, initial_rev)

    def test_cannot_reverse_draft_entry(self):
        """Only POSTED entries can be reversed."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Draft reversal test',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            user=self.user,
        )
        with self.assertRaises(ValidationError) as ctx:
            LedgerService.reverse_journal_entry(
                organization=self.org, entry_id=entry.id, user=self.user,
            )
        self.assertIn('posted', str(ctx.exception).lower())

    def test_reversal_locks_original(self):
        """The original entry should be locked after reversal."""
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Lock after reversal',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED',
            user=self.user,
        )
        LedgerService.reverse_journal_entry(
            organization=self.org, entry_id=entry.id, user=self.user,
        )
        entry.refresh_from_db()
        self.assertTrue(entry.is_locked)


class TestTrialBalance(LedgerTestBase):
    """Tests for LedgerService.get_trial_balance()"""

    def test_trial_balance_debits_equal_credits(self):
        """Total debits must always equal total credits in the trial balance."""
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='TB test 1',
            reference='TB-001',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('1000'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('1000')},
            ],
            status='POSTED',
            user=self.user,
        )
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='TB test 2',
            reference='TB-002',
            lines=[
                {'account_id': self.expense_account.id, 'debit': Decimal('300'), 'credit': Decimal('0')},
                {'account_id': self.cash_account.id, 'debit': Decimal('0'), 'credit': Decimal('300')},
            ],
            status='POSTED',
            user=self.user,
        )

        accounts = LedgerService.get_trial_balance(self.org)
        total_debit = sum(
            max(acc.temp_balance, Decimal('0')) for acc in accounts
            if not acc.temp_children
        )
        total_credit = sum(
            abs(min(acc.temp_balance, Decimal('0'))) for acc in accounts
            if not acc.temp_children
        )
        # Debits should equal credits (the fundamental accounting equation)
        self.assertEqual(total_debit, total_credit)

    def test_trial_balance_reflects_posted_only(self):
        """Only POSTED entries should appear in the trial balance."""
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description='Draft (should not appear)',
            reference='TB-DRAFT',
            lines=[
                {'account_id': self.cash_account.id, 'debit': Decimal('9999'), 'credit': Decimal('0')},
                {'account_id': self.revenue_account.id, 'debit': Decimal('0'), 'credit': Decimal('9999')},
            ],
            user=self.user,
            # status defaults to DRAFT
        )
        accounts = LedgerService.get_trial_balance(self.org)
        cash_acc = next((a for a in accounts if a.id == self.cash_account.id), None)
        if cash_acc:
            # Should NOT include the 9999 from the draft entry
            self.assertNotEqual(cash_acc.temp_balance, Decimal('9999'))
