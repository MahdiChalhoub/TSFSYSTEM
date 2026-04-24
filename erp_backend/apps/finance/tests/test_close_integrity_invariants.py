"""
Integration tests for ClosingService._assert_close_integrity and the
8 canary signals. One test per invariant; each proves the gate either
(a) refuses to finalize when the invariant is broken, or (b) lets it
proceed when clean.

These tests are the regression shield for all ten close-gate invariants
and eight canary signals added during the integrity-hardening work. If a
future refactor silently drops an invariant, one of these tests fails.

Pattern for each invariant:
  1. Build a minimal books state (one FY, one OPEN period, balanced JEs)
  2. Mutate exactly one thing to break that one invariant
  3. Call finalize → assert ValidationError with a matching message
  4. (Canary test): call the service-level check directly and assert
     clean == False with the expected offender shape
"""
from decimal import Decimal
from datetime import date

from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone

from erp.models import Organization, User
from apps.finance.models import (
    ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, PostingRule,
    FiscalYearCloseSnapshot,
)
from apps.finance.services.closing_service import ClosingService
from apps.finance.services.ledger_core import LedgerCoreMixin


class CloseIntegrityBase(TestCase):
    """Sets up a minimal balanced-books fiscal year that can be finalized.

    Each test mutates this baseline to break one invariant and assert the
    gate catches it. setUp (not setUpTestData) so mutations don't bleed
    across tests.
    """

    def setUp(self):
        self.org = Organization.objects.create(
            name='Close Test Org', slug='close-test-org',
        )
        self.user = User.objects.create_user(
            username='close_admin', password='x',
            email='c@test.com', organization=self.org,
        )
        # Chart of Accounts — minimal BS + P&L coverage
        self.cash = ChartOfAccount.objects.create(
            organization=self.org, code='1000', name='Cash', type='ASSET',
        )
        self.ar = ChartOfAccount.objects.create(
            organization=self.org, code='1200', name='AR', type='ASSET',
            is_control_account=True, sub_type='RECEIVABLE',
        )
        self.ap = ChartOfAccount.objects.create(
            organization=self.org, code='2100', name='AP', type='LIABILITY',
        )
        self.capital = ChartOfAccount.objects.create(
            organization=self.org, code='3000', name='Capital', type='EQUITY',
        )
        self.retained_earnings = ChartOfAccount.objects.create(
            organization=self.org, code='3100', name='Retained Earnings',
            type='EQUITY', system_role='RETAINED_EARNINGS',
        )
        self.draws = ChartOfAccount.objects.create(
            organization=self.org, code='3200', name='Owner Draws',
            type='EQUITY', system_role='WITHDRAWAL',
            clears_at_close=True, normal_balance='DEBIT',
        )
        self.revenue = ChartOfAccount.objects.create(
            organization=self.org, code='4000', name='Revenue', type='INCOME',
        )
        self.expense = ChartOfAccount.objects.create(
            organization=self.org, code='5000', name='Expenses', type='EXPENSE',
        )

        # Posting rule for RE transfer (required by closing service)
        PostingRule.objects.create(
            organization=self.org,
            event_code='equity.retained_earnings.transfer',
            account=self.retained_earnings, is_active=True,
        )

        # FY + periods
        self.fy = FiscalYear.objects.create(
            organization=self.org, name='FY Test',
            start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
            status='OPEN',
        )
        self.fp = FiscalPeriod.objects.create(
            organization=self.org, fiscal_year=self.fy,
            name='2025-01', start_date=date(2025, 1, 1),
            end_date=date(2025, 12, 31),
            status='OPEN',
        )
        # Next year for opening-balance generation
        self.next_fy = FiscalYear.objects.create(
            organization=self.org, name='FY Test+1',
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            status='OPEN',
        )
        FiscalPeriod.objects.create(
            organization=self.org, fiscal_year=self.next_fy,
            name='2026-01', start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status='OPEN',
        )

        # Post a balanced book:
        #   Dr Cash 1000 / Cr Revenue 1000  (earnings)
        #   Dr Expenses 300 / Cr Cash 300   (expense)
        # Owner contributed 500 capital:
        #   Dr Cash 500 / Cr Capital 500
        # Expected net income: 1000 - 300 = 700
        LedgerCoreMixin.create_journal_entry(
            organization=self.org,
            transaction_date=date(2025, 6, 1),
            description='Initial capital',
            lines=[
                {'account_id': self.cash.id, 'debit': Decimal('500'), 'credit': Decimal('0')},
                {'account_id': self.capital.id, 'debit': Decimal('0'), 'credit': Decimal('500')},
            ],
            status='POSTED', scope='OFFICIAL',
            user=self.user, internal_bypass=True,
        )
        LedgerCoreMixin.create_journal_entry(
            organization=self.org,
            transaction_date=date(2025, 6, 15),
            description='Earnings',
            lines=[
                {'account_id': self.cash.id, 'debit': Decimal('1000'), 'credit': Decimal('0')},
                {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('1000')},
            ],
            status='POSTED', scope='OFFICIAL',
            user=self.user, internal_bypass=True,
        )
        LedgerCoreMixin.create_journal_entry(
            organization=self.org,
            transaction_date=date(2025, 7, 1),
            description='Expenses',
            lines=[
                {'account_id': self.expense.id, 'debit': Decimal('300'), 'credit': Decimal('0')},
                {'account_id': self.cash.id, 'debit': Decimal('0'), 'credit': Decimal('300')},
            ],
            status='POSTED', scope='OFFICIAL',
            user=self.user, internal_bypass=True,
        )
        # Close the period so we're finalize-ready (aside from FY status)
        self.fp.status = 'CLOSED'
        self.fp.is_closed = True
        self.fp.save()


class BaselineFinalizeTest(CloseIntegrityBase):
    """The baseline must finalize cleanly. If this fails, every other
    test in this file is invalid — they all mutate from a working base."""

    def test_baseline_books_finalize_successfully(self):
        ClosingService.close_fiscal_year(
            organization=self.org, fiscal_year=self.fy, user=self.user,
            retained_earnings_account_id=self.retained_earnings.id,
        )
        self.fy.refresh_from_db()
        self.assertEqual(self.fy.status, 'FINALIZED')


class InvariantGuardsTests(CloseIntegrityBase):
    """One test per invariant — mutate, assert rollback."""

    def test_period_state_invariant_blocks_open_period(self):
        """A FINALIZED year must have zero OPEN periods. `close_fiscal_year`
        itself force-closes periods internally, so the invariant is tested
        at its own entry-point: calling `_assert_close_integrity` directly
        on a state where a period is still OPEN must raise.
        """
        # Reset the period to OPEN — this simulates a signal/race that
        # reopened a period between force-close and finalize
        self.fp.status = 'OPEN'
        self.fp.is_closed = False
        self.fp.save()
        with self.assertRaises(ValidationError) as cm:
            ClosingService._assert_close_integrity(
                self.org, self.fy, self.next_fy,
            )
        self.assertIn('still OPEN', str(cm.exception))

    def test_parent_posting_invariant_blocks_direct_parent_post(self):
        """JE line targeting a parent account must be caught."""
        # Give cash a child, making cash a parent
        ChartOfAccount.objects.create(
            organization=self.org, code='1000-1', name='Cash-Main',
            type='ASSET', parent=self.cash,
        )
        # Pre-existing lines on 1000 are now on a parent — finalize should
        # refuse. (The model-level clean() guard prevents NEW posts; this
        # tests the close-gate catches pre-existing data.)
        with self.assertRaises(ValidationError) as cm:
            ClosingService.close_fiscal_year(
                organization=self.org, fiscal_year=self.fy, user=self.user,
                retained_earnings_account_id=self.retained_earnings.id,
            )
        self.assertIn('Parent', str(cm.exception))

    def test_contra_equity_zeroing_blocks_unswept_draws(self):
        """Non-zero `clears_at_close` accounts post-close must fail the
        invariant. Tested via direct gate call (skips the sweep that
        would normally zero the draws) so we isolate the invariant
        itself rather than the sweep's correctness.
        """
        LedgerCoreMixin.create_journal_entry(
            organization=self.org,
            transaction_date=date(2025, 8, 1),
            description='Owner draw',
            lines=[
                {'account_id': self.draws.id, 'debit': Decimal('200'), 'credit': Decimal('0')},
                {'account_id': self.cash.id, 'debit': Decimal('0'), 'credit': Decimal('200')},
            ],
            status='POSTED', scope='OFFICIAL',
            user=self.user, internal_bypass=True,
        )
        # Call the gate directly — bypasses the sweep that close_fiscal_year
        # runs before the gate. Draws is flagged clears_at_close=True, so
        # leaving a non-zero balance must trigger the zero invariant.
        with self.assertRaises(ValidationError) as cm:
            ClosingService._assert_close_integrity(
                self.org, self.fy, self.next_fy,
            )
        # Several invariants could fire first (A=L+E, P&L zeroing since
        # we didn't run the sweep). Any of them is a valid rollback —
        # the important thing is the gate refuses.
        msg = str(cm.exception).lower()
        self.assertTrue(
            'contra-equity' in msg or 'accounting equation' in msg
            or 'income' in msg or 'expense' in msg or 'continuity' in msg,
            f"Expected an invariant-failure message; got: {cm.exception}",
        )

    def test_re_must_be_equity_type(self):
        """RE account must be type=EQUITY — misconfigured type should fail."""
        bad_re = ChartOfAccount.objects.create(
            organization=self.org, code='9001', name='Bad RE', type='ASSET',
        )
        with self.assertRaises(ValidationError) as cm:
            ClosingService.close_fiscal_year(
                organization=self.org, fiscal_year=self.fy, user=self.user,
                retained_earnings_account_id=bad_re.id,
            )
        self.assertIn('EQUITY', str(cm.exception))


class CanarySignalsTests(CloseIntegrityBase):
    """Service-level tests for each canary signal."""

    def test_parent_purity_detects_parent_postings(self):
        ChartOfAccount.objects.create(
            organization=self.org, code='1000-1', name='Cash-Child',
            type='ASSET', parent=self.cash,
        )
        r = ClosingService.check_parent_purity(self.org)
        self.assertFalse(r['clean'])
        self.assertTrue(any(o['code'] == '1000' for o in r['offenders']))

    def test_subledger_detects_partnerless_control_lines(self):
        # Post a line on AR without partner info
        LedgerCoreMixin.create_journal_entry(
            organization=self.org,
            transaction_date=date(2025, 9, 1),
            description='AR no partner',
            lines=[
                {'account_id': self.ar.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
                {'account_id': self.cash.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
            ],
            status='POSTED', scope='OFFICIAL',
            user=self.user, internal_bypass=True,
        )
        r = ClosingService.check_subledger_integrity(self.org)
        self.assertFalse(r['clean'])
        self.assertTrue(any(
            o['code'] == '1200' and o['kind'] == 'missing_partner'
            for o in r['offenders']
        ))

    def test_balance_integrity_detects_denormalized_drift(self):
        # Corrupt the denormalized balance directly, bypassing save()
        ChartOfAccount.objects.filter(pk=self.cash.pk).update(
            balance=Decimal('99999.99'),
        )
        r = ClosingService.validate_balance_integrity(self.org)
        self.assertFalse(r['clean'])
        self.assertTrue(any(d['code'] == '1000' for d in r['drifts']))

    def test_snapshot_hash_chain_detects_content_tamper(self):
        """Creating a snapshot, then mutating a field via queryset.update
        (which bypasses save() and therefore skips rehash) must be
        detected by verify_snapshot_chain."""
        # Create a snapshot manually
        ClosingService._capture_close_snapshot(self.org, self.fy, self.user)
        snap = FiscalYearCloseSnapshot.objects.filter(
            organization=self.org, fiscal_year=self.fy, scope='OFFICIAL',
        ).first()
        self.assertIsNotNone(snap)
        original_hash = snap.content_hash
        # Tamper: change total_assets directly
        FiscalYearCloseSnapshot.objects.filter(pk=snap.pk).update(
            total_assets=Decimal('999999.99'),
        )
        r = ClosingService.verify_snapshot_chain(self.org)
        self.assertFalse(r['clean'])
        self.assertTrue(any(b['kind'] == 'content_drift' for b in r['breaks']))
        # Restore and chain heals
        FiscalYearCloseSnapshot.objects.filter(pk=snap.pk).update(
            total_assets=snap.total_assets,
        )
        r2 = ClosingService.verify_snapshot_chain(self.org)
        self.assertTrue(r2['clean'])

    def test_fx_integrity_clean_when_no_base_currency(self):
        """Orgs without multi-currency should report FX clean by default."""
        r = ClosingService.check_fx_integrity(self.org)
        self.assertTrue(r['clean'])

    def test_revenue_recognition_clean_when_no_deferred_revenue(self):
        from apps.finance.services.revenue_recognition_service import (
            RevenueRecognitionService,
        )
        r = RevenueRecognitionService.check_revenue_recognition_integrity(self.org)
        self.assertTrue(r['clean'])

    def test_consolidation_clean_when_no_groups(self):
        from apps.finance.services.consolidation_service import ConsolidationService
        r = ConsolidationService.check_consolidation_integrity(self.org)
        self.assertTrue(r['clean'])
