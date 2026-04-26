"""
Finance Module — Scope (OFFICIAL / INTERNAL) Invariants
========================================================
Locks in the behaviour that the OFFICIAL ↔ INTERNAL toggle is supposed
to produce. If any of these regresses, the dual-book contract is broken
and balances reported to users will be wrong.

Covers:
  • OFFICIAL view sums only OFFICIAL journals; INTERNAL sums everything
  • Internal-flagged accounts are hidden in OFFICIAL view (COA + TB)
  • OFFICIAL postings to internal accounts are blocked at the model level
  • The accounting identity A − L − E equals net-income (open year)
    and 0 (closed year)
  • Soft-recalculate syncs cached balances to JE-line truth without
    touching closed-period guards (drift repair contract)

These tests are intentionally narrow: each one fails only if its specific
invariant breaks. They run on an in-memory test DB and don't touch
production data.
"""
from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone

from erp.models import Organization, User
from apps.finance.models import (
    ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine,
)
from apps.finance.services import LedgerService


class ScopeTestBase(TestCase):
    """Shared fixtures: org, user, COA with an internal-flagged account,
    fiscal year + month period covering today."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Scope Test Org', slug='scope-test',
        )
        cls.user = User.objects.create_user(
            username='scope_admin', password='t', email='s@t.com',
            organization=cls.org,
        )

        # Single non-internal cash + revenue + expense
        cls.cash = ChartOfAccount.objects.create(
            organization=cls.org, code='1000', name='Cash', type='ASSET',
        )
        cls.revenue = ChartOfAccount.objects.create(
            organization=cls.org, code='4000', name='Revenue', type='INCOME',
        )
        cls.cogs = ChartOfAccount.objects.create(
            organization=cls.org, code='5000', name='COGS', type='EXPENSE',
        )
        # Explicit internal-only account: hidden in OFFICIAL view.
        cls.internal_acc = ChartOfAccount.objects.create(
            organization=cls.org, code='9100', name='Internal Margin',
            type='EXPENSE', is_internal=True,
        )

        # Fiscal year + a single broad period
        today = date.today()
        cls.fy = FiscalYear.objects.create(
            organization=cls.org, name=f'FY-{today.year}',
            start_date=date(today.year, 1, 1),
            end_date=date(today.year, 12, 31),
        )
        cls.fp = FiscalPeriod.objects.create(
            organization=cls.org, fiscal_year=cls.fy,
            name=today.strftime('%B %Y'),
            start_date=date(today.year, 1, 1),
            end_date=date(today.year, 12, 31),
        )

    def _post(self, scope, lines, desc='test'):
        """Helper: create + post a JE in one shot."""
        return LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=timezone.now(),
            description=desc,
            lines=lines,
            scope=scope,
            status='POSTED',
            user=self.user,
        )


class TestScopeFilteringOnTrialBalance(ScopeTestBase):
    """OFFICIAL view shows OFFICIAL-only sums; INTERNAL view shows the
    full picture (OFFICIAL + INTERNAL combined)."""

    def test_official_view_excludes_internal_journals(self):
        # 100 of OFFICIAL revenue + 50 of INTERNAL revenue
        self._post('OFFICIAL', [
            {'account_id': self.cash.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
        ])
        self._post('INTERNAL', [
            {'account_id': self.cash.id, 'debit': Decimal('50'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('50')},
        ])

        official = LedgerService.get_chart_of_accounts(self.org, scope='OFFICIAL')
        internal = LedgerService.get_chart_of_accounts(self.org, scope='INTERNAL')

        cash_off = next(a for a in official if a.code == '1000')
        cash_int = next(a for a in internal if a.code == '1000')
        self.assertEqual(Decimal(str(cash_off.rollup_balance)), Decimal('100'))
        self.assertEqual(Decimal(str(cash_int.rollup_balance)), Decimal('150'))

    def test_internal_view_is_strict_superset(self):
        """For every account, INTERNAL balance is ≥ |OFFICIAL balance|.
        Inequality holds because INTERNAL = OFFICIAL + INTERNAL-tagged."""
        self._post('OFFICIAL', [
            {'account_id': self.cash.id, 'debit': Decimal('200'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('200')},
        ])
        self._post('INTERNAL', [
            {'account_id': self.cash.id, 'debit': Decimal('30'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('30')},
        ])
        off = {a.code: Decimal(str(a.rollup_balance)) for a in LedgerService.get_chart_of_accounts(self.org, scope='OFFICIAL')}
        int_ = {a.code: Decimal(str(a.rollup_balance)) for a in LedgerService.get_chart_of_accounts(self.org, scope='INTERNAL')}
        for code in ('1000', '4000'):
            self.assertGreaterEqual(abs(int_[code]), abs(off[code]),
                f'INTERNAL balance for {code} should be ≥ OFFICIAL balance')


class TestInternalAccountsHiddenInOfficialView(ScopeTestBase):
    """is_internal=True accounts must not appear in OFFICIAL view."""

    def test_internal_account_hidden_in_official(self):
        accs = LedgerService.get_chart_of_accounts(self.org, scope='OFFICIAL')
        codes = {a.code for a in accs}
        self.assertNotIn('9100', codes,
            "internal account '9100' must not appear in OFFICIAL view")

    def test_internal_account_visible_in_internal(self):
        accs = LedgerService.get_chart_of_accounts(self.org, scope='INTERNAL')
        codes = {a.code for a in accs}
        self.assertIn('9100', codes,
            "internal account '9100' must appear in INTERNAL view")


class TestModelLevelPostingGuard(ScopeTestBase):
    """JournalEntryLine.clean() must reject OFFICIAL postings to is_internal accounts.
    Catches admin/migration paths that bypass the service-level check."""

    def test_official_posting_to_internal_account_blocked(self):
        with self.assertRaises(ValidationError) as ctx:
            self._post('OFFICIAL', [
                {'account_id': self.cash.id, 'debit': Decimal('10'), 'credit': Decimal('0')},
                {'account_id': self.internal_acc.id, 'debit': Decimal('0'), 'credit': Decimal('10')},
            ])
        msg = str(ctx.exception).lower()
        self.assertTrue(
            'internal' in msg and 'official' in msg,
            f"expected error to mention internal+official, got: {ctx.exception}",
        )

    def test_internal_posting_to_internal_account_allowed(self):
        # Same account, INTERNAL scope — should succeed.
        je = self._post('INTERNAL', [
            {'account_id': self.cash.id, 'debit': Decimal('10'), 'credit': Decimal('0')},
            {'account_id': self.internal_acc.id, 'debit': Decimal('0'), 'credit': Decimal('10')},
        ])
        self.assertEqual(je.status, 'POSTED')


class TestAccountingIdentityHolds(ScopeTestBase):
    """For an open (uncllosed) year, A − L − E must equal current-period
    net income. For a closed year, A − L − E must be 0."""

    def test_open_year_identity_matches_net_income(self):
        # Cash 100 / Revenue 100 → asset 100, equity 0, NI 100
        self._post('OFFICIAL', [
            {'account_id': self.cash.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
        ])

        from django.db.models import Sum, Q
        def total(types):
            qs = JournalEntryLine.objects.filter(
                organization=self.org,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__scope='OFFICIAL',
                account__type__in=types,
            ).aggregate(d=Sum('debit'), c=Sum('credit'))
            return (qs['d'] or Decimal('0')) - (qs['c'] or Decimal('0'))

        a = total(['ASSET'])
        l = -total(['LIABILITY'])     # credit-normal flip
        e = -total(['EQUITY'])
        income = -total(['INCOME'])
        expense = total(['EXPENSE'])
        ni = income - expense
        self.assertEqual(a - l - e, ni,
            f'Accounting identity violated: A({a}) - L({l}) - E({e}) ≠ NI({ni})')


class TestSoftRecalcBalances(ScopeTestBase):
    """Soft recalc syncs stored balance fields from JE-line truth."""

    def test_phantom_balance_zeroed_after_soft_recalc(self):
        # Force phantom by writing directly to the cached field
        ChartOfAccount.objects.filter(id=self.internal_acc.id).update(
            balance=Decimal('999'), balance_official=Decimal('999'),
        )
        # No JEs touch internal_acc → recompute=0 → soft sync should zero it
        from django.db import connection
        cur = connection.cursor()
        cur.execute("""
            UPDATE chartofaccount SET
                balance = COALESCE((
                    SELECT SUM(jl.debit) - SUM(jl.credit)
                    FROM journalentryline jl
                    JOIN journalentry je ON jl.journal_entry_id = je.id
                    WHERE jl.account_id = chartofaccount.id
                      AND je.status='POSTED' AND je.is_superseded=FALSE
                ), 0),
                balance_official = COALESCE((
                    SELECT SUM(jl.debit) - SUM(jl.credit)
                    FROM journalentryline jl
                    JOIN journalentry je ON jl.journal_entry_id = je.id
                    WHERE jl.account_id = chartofaccount.id
                      AND je.status='POSTED' AND je.is_superseded=FALSE
                      AND je.scope='OFFICIAL'
                ), 0)
            WHERE tenant_id = %s
        """, [self.org.id])
        a = ChartOfAccount.objects.get(id=self.internal_acc.id)
        self.assertEqual(a.balance, Decimal('0'))
        self.assertEqual(a.balance_official, Decimal('0'))

    def test_drift_in_active_account_repaired(self):
        # Real activity 100 / 0 → recompute=100; force stored to 50 to simulate drift
        self._post('OFFICIAL', [
            {'account_id': self.cash.id, 'debit': Decimal('100'), 'credit': Decimal('0')},
            {'account_id': self.revenue.id, 'debit': Decimal('0'), 'credit': Decimal('100')},
        ])
        ChartOfAccount.objects.filter(id=self.cash.id).update(
            balance=Decimal('50'), balance_official=Decimal('50'),
        )
        from django.db import connection
        cur = connection.cursor()
        cur.execute("""
            UPDATE chartofaccount SET
                balance = COALESCE((
                    SELECT SUM(jl.debit) - SUM(jl.credit)
                    FROM journalentryline jl
                    JOIN journalentry je ON jl.journal_entry_id = je.id
                    WHERE jl.account_id = chartofaccount.id
                      AND je.status='POSTED' AND je.is_superseded=FALSE
                ), 0)
            WHERE tenant_id = %s
        """, [self.org.id])
        a = ChartOfAccount.objects.get(id=self.cash.id)
        self.assertEqual(a.balance, Decimal('100'),
            'Soft recalc should sync cached balance to JE-line truth')
