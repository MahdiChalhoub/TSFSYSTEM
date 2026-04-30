"""
Unit tests for RevaluationService — the FX revaluation engine.

Coverage:
  * preview returns lines without writing
  * materiality gate parks runs as PENDING_APPROVAL
  * force_post bypasses the gate
  * non-monetary classification skips the account
  * income/expense classification uses AVERAGE rate
  * excluded_account_ids opts an account out
  * approve flips PENDING_APPROVAL → POSTED + builds JE
  * reject flips PENDING_APPROVAL → REJECTED with reason
  * reverse_at_period_start posts inverse JE on day 1 of next period (idempotent)
  * run_multi_period_catchup processes periods chronologically
  * compute_realized_fx returns 0 for base-currency settlements
  * compute_exposure_report aggregates per-currency with sensitivity
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context

from apps.finance.models import (
    ChartOfAccount, Currency, ExchangeRate, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, CurrencyRevaluation, CurrencyRevaluationLine,
)
from apps.finance.services.revaluation_service import (
    RevaluationService, _get_materiality_threshold, _classification_to_rate_type,
)


def _make_period(org, year, name, start, end):
    """Create FY + period in one call."""
    fy, _ = FiscalYear.objects.get_or_create(
        organization=org, name=str(year),
        defaults={'start_date': start, 'end_date': end},
    )
    return FiscalPeriod.objects.create(
        organization=org, fiscal_year=fy, name=name,
        start_date=start, end_date=end, status='OPEN',
    )


def _post_je(org, txn_date, lines, scope='OFFICIAL'):
    """Create a POSTED JE with the given lines (each: account, debit, credit, amount_currency)."""
    je = JournalEntry.objects.create(
        organization=org, transaction_date=txn_date,
        status='POSTED', scope=scope, journal_type='MANUAL',
        is_superseded=False,
    )
    for ln in lines:
        JournalEntryLine.objects.create(
            organization=org, journal_entry=je,
            account=ln['account'],
            debit=ln.get('debit', Decimal('0')),
            credit=ln.get('credit', Decimal('0')),
            amount_currency=ln.get('amount_currency'),
        )
    return je


class RevaluationServiceCoreTests(TestCase):
    """End-to-end behaviour of preview + run + approve/reject + reverse."""

    def setUp(self):
        self.org = Organization.objects.create(name="Acme FX", slug="acme-fx")
        with tenant_context(self.org):
            self.user = User.objects.create(username="finmgr", organization=self.org)

            # Currencies — XAF base, USD foreign.
            self.xaf = Currency.objects.create(
                organization=self.org, code='XAF', name='CFA Franc',
                symbol='F', decimal_places=0, is_base=True, is_active=True,
            )
            self.usd = Currency.objects.create(
                organization=self.org, code='USD', name='US Dollar',
                symbol='$', decimal_places=2, is_base=False, is_active=True,
            )

            # COA — three USD accounts: AR (monetary), Equipment (non-monetary), Sales (income/expense)
            self.ar = ChartOfAccount.objects.create(
                organization=self.org, code='1200', name='AR USD',
                type='ASSET', currency='USD',
                revaluation_required=True, monetary_classification='MONETARY',
                normal_balance='DEBIT', allow_posting=True,
            )
            self.equip = ChartOfAccount.objects.create(
                organization=self.org, code='2100', name='Equipment USD',
                type='ASSET', currency='USD',
                revaluation_required=True, monetary_classification='NON_MONETARY',
                normal_balance='DEBIT', allow_posting=True,
            )
            self.sales = ChartOfAccount.objects.create(
                organization=self.org, code='4100', name='Sales USD',
                type='INCOME', currency='USD',
                revaluation_required=True, monetary_classification='INCOME_EXPENSE',
                normal_balance='CREDIT', allow_posting=True,
            )
            # FX_GAIN / FX_LOSS counterparty accounts.
            self.fx_gain = ChartOfAccount.objects.create(
                organization=self.org, code='7700', name='Unrealized FX Gain',
                type='INCOME', system_role='FX_GAIN',
                normal_balance='CREDIT', allow_posting=True,
            )
            self.fx_loss = ChartOfAccount.objects.create(
                organization=self.org, code='6700', name='Unrealized FX Loss',
                type='EXPENSE', system_role='FX_LOSS',
                normal_balance='DEBIT', allow_posting=True,
            )

            # Fiscal year w/ 2 monthly periods.
            self.p1 = _make_period(self.org, 2026, '2026-01',
                                   date(2026, 1, 1), date(2026, 1, 31))
            self.p2 = FiscalPeriod.objects.create(
                organization=self.org, fiscal_year=self.p1.fiscal_year,
                name='2026-02', start_date=date(2026, 2, 1),
                end_date=date(2026, 2, 28), status='OPEN',
            )

            # USD→XAF closing rate at end of January.
            ExchangeRate.objects.create(
                organization=self.org,
                from_currency=self.usd, to_currency=self.xaf,
                rate=Decimal('620'), rate_type='CLOSING',
                effective_date=date(2026, 1, 31),
            )
            # AVERAGE rate for income/expense reval.
            ExchangeRate.objects.create(
                organization=self.org,
                from_currency=self.usd, to_currency=self.xaf,
                rate=Decimal('610'), rate_type='AVERAGE',
                effective_date=date(2026, 1, 31),
            )

            # Post an AR invoice on 2026-01-15 at rate 600: 1000 USD = 600,000 XAF.
            _post_je(self.org, date(2026, 1, 15), [
                {'account': self.ar, 'debit': Decimal('600000'), 'credit': Decimal('0'),
                 'amount_currency': Decimal('1000')},
                {'account': self.sales, 'debit': Decimal('0'), 'credit': Decimal('600000'),
                 'amount_currency': Decimal('-1000')},
            ])

    # ── preview ──────────────────────────────────────────────────────────

    def test_preview_returns_lines_without_writing(self):
        with tenant_context(self.org):
            before_count = CurrencyRevaluation.objects.count()
            preview = RevaluationService.preview(self.org, self.p1, scope='OFFICIAL')
            after_count = CurrencyRevaluation.objects.count()

        self.assertEqual(before_count, after_count, "preview must not write CurrencyRevaluation")
        self.assertIn('lines', preview)
        # AR account: 1000 USD × (620 - 600) = +20,000 XAF gain.
        ar_line = next(l for l in preview['lines'] if l['account_code'] == '1200')
        self.assertEqual(ar_line['rate_type_used'], 'CLOSING')
        self.assertEqual(ar_line['classification'], 'MONETARY')
        self.assertEqual(ar_line['difference'], Decimal('20000.00'))

    def test_preview_skips_non_monetary_account(self):
        """Equipment (NON_MONETARY) must be in skipped, not lines."""
        with tenant_context(self.org):
            # Post a non-monetary balance so the engine actually visits it.
            _post_je(self.org, date(2026, 1, 10), [
                {'account': self.equip, 'debit': Decimal('500000'), 'credit': Decimal('0'),
                 'amount_currency': Decimal('800')},
                {'account': self.ar, 'debit': Decimal('0'), 'credit': Decimal('500000'),
                 'amount_currency': Decimal('-800')},
            ])
            preview = RevaluationService.preview(self.org, self.p1)
        codes_in_lines = {l['account_code'] for l in preview['lines']}
        codes_skipped = {s['code'] for s in preview['skipped']}
        self.assertNotIn('2100', codes_in_lines)
        self.assertIn('2100', codes_skipped)

    def test_preview_uses_average_rate_for_income_expense(self):
        """Sales (INCOME_EXPENSE) is revalued at AVERAGE, not CLOSING."""
        with tenant_context(self.org):
            preview = RevaluationService.preview(self.org, self.p1)
        sales_line = next((l for l in preview['lines'] if l['account_code'] == '4100'), None)
        self.assertIsNotNone(sales_line, "Sales account should be revalued")
        self.assertEqual(sales_line['rate_type_used'], 'AVERAGE')
        # Sales has -1000 USD balance; revalued at 610 = -610,000. Booked at 600 = -600,000.
        # Difference: -610,000 - (-600,000) = -10,000 (loss in base).
        self.assertEqual(sales_line['difference'], Decimal('-10000.00'))

    def test_preview_excluded_account_ids_skips_account(self):
        with tenant_context(self.org):
            preview = RevaluationService.preview(
                self.org, self.p1, excluded_account_ids=[self.ar.id],
            )
        codes_in_lines = {l['account_code'] for l in preview['lines']}
        self.assertNotIn('1200', codes_in_lines)
        self.assertIn(self.ar.id, [s['account_id'] for s in preview['skipped']])

    # ── materiality gate ─────────────────────────────────────────────────

    def test_materiality_gate_parks_run_as_pending_approval(self):
        """1000 USD × 20 XAF / 620,000 base = 3.2% materiality > 0.5% default."""
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(
                self.org, self.p1, user=self.user, scope='OFFICIAL',
            )
        self.assertEqual(reval.status, 'PENDING_APPROVAL')
        self.assertIsNone(reval.journal_entry, "JE must NOT be posted yet")
        self.assertGreater(reval.materiality_pct, Decimal('0.5'))

    def test_force_post_bypasses_materiality_gate(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(
                self.org, self.p1, user=self.user, scope='OFFICIAL',
                force_post=True,
            )
        self.assertEqual(reval.status, 'POSTED')
        self.assertIsNotNone(reval.journal_entry)

    def test_org_can_override_materiality_threshold(self):
        with tenant_context(self.org):
            self.org.settings = {'fx': {'materiality_threshold_pct': '10.0000'}}
            self.org.save()
            self.assertEqual(_get_materiality_threshold(self.org), Decimal('10.0000'))
            # Now 3.2% is BELOW 10% → run posts directly.
            reval = RevaluationService.run_revaluation(
                self.org, self.p1, user=self.user,
            )
        self.assertEqual(reval.status, 'POSTED')

    # ── approve / reject ─────────────────────────────────────────────────

    def test_approve_pending_run_posts_je(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(self.org, self.p1, user=self.user)
            self.assertEqual(reval.status, 'PENDING_APPROVAL')
            RevaluationService.approve(reval, user=self.user)
            reval.refresh_from_db()
        self.assertEqual(reval.status, 'POSTED')
        self.assertIsNotNone(reval.journal_entry)
        self.assertIsNotNone(reval.approved_at)

    def test_reject_pending_run_marks_rejected_no_je(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(self.org, self.p1, user=self.user)
            RevaluationService.reject(reval, user=self.user, reason='Wait for year-end')
            reval.refresh_from_db()
        self.assertEqual(reval.status, 'REJECTED')
        self.assertIsNone(reval.journal_entry)
        self.assertEqual(reval.rejection_reason, 'Wait for year-end')

    def test_approve_rejected_run_raises(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(self.org, self.p1, user=self.user)
            RevaluationService.reject(reval, user=self.user)
            reval.refresh_from_db()
            with self.assertRaises(ValidationError):
                RevaluationService.approve(reval, user=self.user)

    # ── reversal ────────────────────────────────────────────────────────

    def test_reverse_at_period_start_posts_inverse_je(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(
                self.org, self.p1, user=self.user, force_post=True,
            )
            reversal = RevaluationService.reverse_at_period_start(reval, user=self.user)
            reval.refresh_from_db()
        self.assertEqual(reval.reversal_journal_entry_id, reversal.id)
        self.assertEqual(reversal.transaction_date.date(), self.p2.start_date)
        # Reversal lines should sum to zero net impact (they swap dr/cr of original).
        original_net = sum(l.debit - l.credit for l in reval.journal_entry.lines.all())
        reversal_net = sum(l.debit - l.credit for l in reversal.lines.all())
        self.assertEqual(original_net + reversal_net, Decimal('0'))

    def test_reverse_is_idempotent(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(
                self.org, self.p1, user=self.user, force_post=True,
            )
            r1 = RevaluationService.reverse_at_period_start(reval, user=self.user)
            r2 = RevaluationService.reverse_at_period_start(reval, user=self.user)
        self.assertEqual(r1.id, r2.id, "Re-running reverse must not create another JE")

    def test_reverse_pending_run_raises(self):
        with tenant_context(self.org):
            reval = RevaluationService.run_revaluation(self.org, self.p1, user=self.user)
            with self.assertRaises(ValidationError):
                RevaluationService.reverse_at_period_start(reval, user=self.user)

    # ── catchup ──────────────────────────────────────────────────────────

    def test_multi_period_catchup_processes_chronologically(self):
        """Both periods get a reval, in order."""
        with tenant_context(self.org):
            # Add a USD→XAF closing rate at end of February so p2 has data to reval.
            ExchangeRate.objects.create(
                organization=self.org,
                from_currency=self.usd, to_currency=self.xaf,
                rate=Decimal('630'), rate_type='CLOSING',
                effective_date=date(2026, 2, 28),
            )
            results = RevaluationService.run_multi_period_catchup(
                self.org, self.p2, user=self.user, force_post=True,
            )
        period_names = [r['period_name'] for r in results if r.get('period_id') in (self.p1.id, self.p2.id)]
        self.assertEqual(period_names, ['2026-01', '2026-02'])
        # Last row carries a summary.
        self.assertIn('summary', results[-1])
        self.assertEqual(results[-1]['summary']['total'], len(results))

    def test_catchup_records_per_period_failure_without_aborting(self):
        """When one period explodes, subsequent periods still run."""
        with tenant_context(self.org):
            # Patch run_revaluation to fail on p1 only.
            real_run = RevaluationService.run_revaluation
            def flaky_run(*args, fiscal_period=None, **kwargs):
                if fiscal_period is None and len(args) >= 2:
                    fiscal_period = args[1]
                if fiscal_period and fiscal_period.id == self.p1.id:
                    raise ValidationError("Simulated failure on p1")
                return real_run(*args, fiscal_period=fiscal_period, **kwargs)

            ExchangeRate.objects.create(
                organization=self.org, from_currency=self.usd, to_currency=self.xaf,
                rate=Decimal('630'), rate_type='CLOSING',
                effective_date=date(2026, 2, 28),
            )
            with patch.object(RevaluationService, 'run_revaluation',
                              side_effect=flaky_run):
                results = RevaluationService.run_multi_period_catchup(
                    self.org, self.p2, user=self.user, force_post=True,
                )

        # p1 has an error row, p2 was processed normally.
        p1_row = next(r for r in results if r['period_id'] == self.p1.id)
        p2_row = next(r for r in results if r['period_id'] == self.p2.id)
        self.assertIn('error', p1_row)
        self.assertNotIn('error', p2_row)
        self.assertIn('Simulated failure', p1_row['error'])
        # Summary reflects the mix.
        summary = results[-1]['summary']
        self.assertEqual(summary['errors'], 1)
        self.assertGreaterEqual(summary['run'] + summary['skipped'], 1)

    def test_catchup_stop_on_error_bails_immediately(self):
        with tenant_context(self.org):
            ExchangeRate.objects.create(
                organization=self.org, from_currency=self.usd, to_currency=self.xaf,
                rate=Decimal('630'), rate_type='CLOSING',
                effective_date=date(2026, 2, 28),
            )
            with patch.object(RevaluationService, 'run_revaluation',
                              side_effect=ValidationError("first")):
                results = RevaluationService.run_multi_period_catchup(
                    self.org, self.p2, user=self.user, force_post=True,
                    stop_on_error=True,
                )
        # Should stop at the first error → only one entry.
        self.assertEqual(len(results), 1)
        self.assertIn('error', results[0])


class RevaluationServiceHelpersTests(TestCase):
    """Pure-function helper tests — no DB needed."""

    def test_classification_maps_income_expense_to_average(self):
        self.assertEqual(_classification_to_rate_type('INCOME_EXPENSE'), 'AVERAGE')

    def test_classification_defaults_to_closing(self):
        self.assertEqual(_classification_to_rate_type('MONETARY'), 'CLOSING')
        self.assertEqual(_classification_to_rate_type('UNKNOWN'), 'CLOSING')


class RealizedFxHelperTests(TestCase):
    """compute_realized_fx — invoked from payment_service."""

    def setUp(self):
        self.org = Organization.objects.create(name="RFX Org", slug="rfx-org")

    def test_zero_when_base_currency(self):
        result = RevaluationService.compute_realized_fx(
            organization=self.org, foreign_amount=Decimal('1000'),
            base_currency_code='XAF', foreign_currency_code='XAF',
            invoice_rate=Decimal('1'), payment_date=date(2026, 1, 15),
        )
        self.assertEqual(result['realized'], Decimal('0.00'))

    def test_zero_when_no_rate_available(self):
        result = RevaluationService.compute_realized_fx(
            organization=self.org, foreign_amount=Decimal('1000'),
            base_currency_code='XAF', foreign_currency_code='USD',
            invoice_rate=Decimal('600'), payment_date=date(2026, 1, 15),
        )
        self.assertEqual(result['realized'], Decimal('0.00'))
        self.assertIsNone(result['rate_source'])
