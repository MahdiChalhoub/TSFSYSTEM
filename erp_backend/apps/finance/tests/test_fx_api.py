"""
HTTP-layer tests for FX revaluation endpoints.

Coverage:
  * GET fx-settings → returns defaults when org.settings is empty
  * PATCH fx-settings → updates threshold, validates 0–100 range
  * POST preview → returns line breakdown without writing
  * POST run → posts when below threshold; parks PENDING_APPROVAL when above
  * POST approve as non-approver → 403
  * POST approve as superuser → flips PENDING_APPROVAL → POSTED
  * POST reject → flips → REJECTED with reason
  * GET exposure → returns per-currency snapshot with sensitivity bands
  * GET realized-fx-integrity → returns clean=True when nothing to flag
  * POST coa/bulk-classify with scope=smart → applies heuristic
  * POST coa/bulk-classify with explicit ids → updates listed accounts
"""
from decimal import Decimal
from datetime import date

from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from erp.models import User, Organization
from kernel.tenancy.context import tenant_context

from apps.finance.models import (
    Currency, ChartOfAccount, FiscalYear, FiscalPeriod,
    JournalEntry, JournalEntryLine, ExchangeRate,
)


class FxApiTests(APITestCase):
    def setUp(self):
        self.org, _ = Organization.objects.get_or_create(
            name='FX-API Org', defaults={'slug': 'fx-api-org'},
        )
        # Superuser bypasses every permission gate — used as the "approver"
        # baseline. Non-approver scenarios use a separate user below.
        self.user, _ = User.objects.get_or_create(
            username='fx-api-admin',
            defaults={'is_staff': True, 'is_superuser': True},
        )
        self.user.organization = self.org
        self.user.save()
        self.token, _ = Token.objects.get_or_create(user=self.user)

        with tenant_context(self.org):
            # Currencies — XAF base, USD foreign.
            self.xaf, _ = Currency.objects.get_or_create(
                organization=self.org, code='XAF',
                defaults={'name': 'CFA Franc', 'symbol': 'F',
                          'decimal_places': 0, 'is_base': True, 'is_active': True},
            )
            self.usd, _ = Currency.objects.get_or_create(
                organization=self.org, code='USD',
                defaults={'name': 'US Dollar', 'symbol': '$',
                          'decimal_places': 2, 'is_base': False, 'is_active': True},
            )
            # COA — AR USD account that will revalue.
            self.ar, _ = ChartOfAccount.objects.get_or_create(
                organization=self.org, code='1200',
                defaults={'name': 'AR USD', 'type': 'ASSET',
                          'currency': 'USD', 'revaluation_required': True,
                          'monetary_classification': 'MONETARY',
                          'normal_balance': 'DEBIT', 'allow_posting': True},
            )
            self.sales, _ = ChartOfAccount.objects.get_or_create(
                organization=self.org, code='4100',
                defaults={'name': 'Sales USD', 'type': 'INCOME',
                          'currency': 'USD',
                          'monetary_classification': 'INCOME_EXPENSE',
                          'normal_balance': 'CREDIT', 'allow_posting': True},
            )
            self.fx_gain, _ = ChartOfAccount.objects.get_or_create(
                organization=self.org, code='7700',
                defaults={'name': 'FX Gain', 'type': 'INCOME',
                          'system_role': 'FX_GAIN',
                          'normal_balance': 'CREDIT', 'allow_posting': True},
            )
            self.fx_loss, _ = ChartOfAccount.objects.get_or_create(
                organization=self.org, code='6700',
                defaults={'name': 'FX Loss', 'type': 'EXPENSE',
                          'system_role': 'FX_LOSS',
                          'normal_balance': 'DEBIT', 'allow_posting': True},
            )
            # Fiscal year + 2 monthly periods.
            self.fy, _ = FiscalYear.objects.get_or_create(
                organization=self.org, name='2026',
                defaults={'start_date': date(2026, 1, 1),
                          'end_date': date(2026, 12, 31)},
            )
            self.p1, _ = FiscalPeriod.objects.get_or_create(
                organization=self.org, fiscal_year=self.fy, name='2026-01',
                defaults={'start_date': date(2026, 1, 1),
                          'end_date': date(2026, 1, 31), 'status': 'OPEN'},
            )
            self.p2, _ = FiscalPeriod.objects.get_or_create(
                organization=self.org, fiscal_year=self.fy, name='2026-02',
                defaults={'start_date': date(2026, 2, 1),
                          'end_date': date(2026, 2, 28), 'status': 'OPEN'},
            )
            # Closing rate end of January.
            ExchangeRate.objects.get_or_create(
                organization=self.org, from_currency=self.usd,
                to_currency=self.xaf, rate_type='CLOSING',
                effective_date=date(2026, 1, 31),
                defaults={'rate': Decimal('620')},
            )
            # AR invoice on 2026-01-15: 1000 USD × 600 = 600,000 XAF.
            je = JournalEntry.objects.create(
                organization=self.org, transaction_date=date(2026, 1, 15),
                status='DRAFT', scope='OFFICIAL', journal_type='MANUAL',
                is_superseded=False,
            )
            JournalEntryLine.objects.create(
                organization=self.org, journal_entry=je, account=self.ar,
                debit=Decimal('600000'), credit=Decimal('0'),
                amount_currency=Decimal('1000'), exchange_rate=Decimal('600'),
            )
            JournalEntryLine.objects.create(
                organization=self.org, journal_entry=je, account=self.sales,
                debit=Decimal('0'), credit=Decimal('600000'),
                amount_currency=Decimal('-1000'), exchange_rate=Decimal('600'),
            )
            je.status = 'POSTED'
            je.save(update_fields=['status'])

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def _h(self):
        """Tenant + scope headers for an authenticated request."""
        return {
            'HTTP_X_TENANT_ID': str(self.org.id),
            'HTTP_X_TENANT_SLUG': self.org.slug,
            'HTTP_X_SCOPE': 'OFFICIAL',
        }

    # ── fx-settings ─────────────────────────────────────────────────────

    def test_fx_settings_get_returns_default(self):
        r = self.client.get('/api/currency-revaluations/fx-settings/', **self._h())
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn('materiality_threshold_pct', r.data)
        # Default is 0.5 — string-encoded for Decimal precision.
        self.assertEqual(Decimal(r.data['materiality_threshold_pct']), Decimal('0.5'))

    def test_fx_settings_post_updates_threshold(self):
        r = self.client.post(
            '/api/currency-revaluations/fx-settings/',
            {'materiality_threshold_pct': '2.5'}, format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Decimal(r.data['materiality_threshold_pct']), Decimal('2.5'))
        # Round-trip via GET.
        r2 = self.client.get('/api/currency-revaluations/fx-settings/', **self._h())
        self.assertEqual(Decimal(r2.data['materiality_threshold_pct']), Decimal('2.5'))

    def test_fx_settings_post_rejects_out_of_range(self):
        r = self.client.post(
            '/api/currency-revaluations/fx-settings/',
            {'materiality_threshold_pct': '150'}, format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 400, r.content)

    # ── preview / run / approve / reject ───────────────────────────────

    def test_preview_returns_lines_without_writing(self):
        before = self.org.revaluations.count() if hasattr(self.org, 'revaluations') else 0
        r = self.client.post(
            '/api/currency-revaluations/preview/',
            {'fiscal_period': self.p1.id, 'scope': 'OFFICIAL'},
            format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIn('lines', r.data)
        # Should detect the AR account with +20,000 XAF gain.
        ar_line = next((l for l in r.data['lines'] if l['account_code'] == '1200'), None)
        self.assertIsNotNone(ar_line, f'AR line missing in preview: {r.data}')
        self.assertEqual(Decimal(ar_line['difference']), Decimal('20000.00'))
        # No new revaluation record was written.
        from apps.finance.models import CurrencyRevaluation
        with tenant_context(self.org):
            self.assertEqual(CurrencyRevaluation.objects.count(), before)

    def test_run_above_threshold_parks_pending_approval(self):
        """Materiality 3.2% > default 0.5% → status=PENDING_APPROVAL, no JE."""
        r = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id}, format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data['status'], 'PENDING_APPROVAL')
        self.assertIsNone(r.data['journal_entry'])

    def test_run_force_post_skips_approval(self):
        r = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id, 'force_post': True},
            format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data['status'], 'POSTED')
        self.assertIsNotNone(r.data['journal_entry'])

    def test_approve_as_superuser_posts_je(self):
        # First park as PENDING_APPROVAL.
        run = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id}, format='json', **self._h(),
        )
        reval_id = run.data['id']
        # Approve.
        approve = self.client.post(
            f'/api/currency-revaluations/{reval_id}/approve/',
            format='json', **self._h(),
        )
        self.assertEqual(approve.status_code, 200, approve.content)
        self.assertEqual(approve.data['status'], 'POSTED')
        self.assertIsNotNone(approve.data['journal_entry'])
        self.assertIsNotNone(approve.data['approved_at'])

    def test_approve_as_non_approver_returns_403(self):
        # Park as PENDING_APPROVAL (with the superuser's run).
        run = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id}, format='json', **self._h(),
        )
        reval_id = run.data['id']
        # Switch to a non-superuser, non-approver client.
        regular = User.objects.create(
            username='regular-user', is_staff=False, is_superuser=False,
            organization=self.org,
        )
        regular_token, _ = Token.objects.get_or_create(user=regular)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + regular_token.key)
        approve = self.client.post(
            f'/api/currency-revaluations/{reval_id}/approve/',
            format='json', **self._h(),
        )
        self.assertEqual(approve.status_code, 403, approve.content)
        self.assertIn('finance.revaluation.approve', str(approve.content))

    def test_reject_marks_rejected_with_reason(self):
        run = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id}, format='json', **self._h(),
        )
        reval_id = run.data['id']
        rej = self.client.post(
            f'/api/currency-revaluations/{reval_id}/reject/',
            {'reason': 'Material but justified'}, format='json', **self._h(),
        )
        self.assertEqual(rej.status_code, 200, rej.content)
        self.assertEqual(rej.data['status'], 'REJECTED')
        self.assertEqual(rej.data['rejection_reason'], 'Material but justified')

    # ── exposure / integrity ────────────────────────────────────────────

    def test_exposure_returns_per_currency_with_sensitivity(self):
        r = self.client.get(
            '/api/currency-revaluations/exposure/?as_of=2026-01-31',
            **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['base_currency'], 'XAF')
        self.assertIn('sensitivity_bands', r.data)
        usd_row = next((c for c in r.data['currencies'] if c['currency'] == 'USD'), None)
        self.assertIsNotNone(usd_row, f'USD missing from exposure: {r.data}')
        # Sensitivity dict has keys for each band.
        for band in r.data['sensitivity_bands']:
            self.assertIn(band, usd_row['sensitivity'])

    def test_realized_fx_integrity_returns_clean_with_no_paid_invoices(self):
        r = self.client.get(
            '/api/currency-revaluations/realized-fx-integrity/',
            **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data['clean'])
        self.assertEqual(r.data['missing_realized_fx'], [])

    # ── bulk-classify ───────────────────────────────────────────────────

    def test_bulk_classify_smart_applies_heuristic(self):
        """Sales (INCOME) should flip from MONETARY → INCOME_EXPENSE."""
        with tenant_context(self.org):
            # Reset to MONETARY so the smart pass detects + corrects.
            self.sales.monetary_classification = 'MONETARY'
            self.sales.save(update_fields=['monetary_classification'])
        r = self.client.post(
            '/api/coa/bulk-classify/',
            {'scope': 'smart'}, format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertGreaterEqual(r.data['updated'], 1)
        with tenant_context(self.org):
            self.sales.refresh_from_db()
            self.assertEqual(self.sales.monetary_classification, 'INCOME_EXPENSE')

    def test_bulk_classify_explicit_ids_updates_listed(self):
        r = self.client.post(
            '/api/coa/bulk-classify/',
            {'ids': [self.ar.id], 'classification': 'NON_MONETARY',
             'revaluation_required': False},
            format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['updated'], 1)
        with tenant_context(self.org):
            self.ar.refresh_from_db()
            self.assertEqual(self.ar.monetary_classification, 'NON_MONETARY')
            self.assertFalse(self.ar.revaluation_required)

    # ── cross-tenant isolation ──────────────────────────────────────────

    def test_cross_tenant_cannot_approve_other_orgs_revaluation(self):
        """A user from a *different* tenant must not be able to approve a
        revaluation from another org. The viewset's ``get_queryset`` filters
        by tenant; ``get_object`` should 404, not 403, for cross-tenant ids."""
        # Park a PENDING_APPROVAL on our org.
        run = self.client.post(
            '/api/currency-revaluations/run/',
            {'fiscal_period': self.p1.id}, format='json', **self._h(),
        )
        reval_id = run.data['id']

        # Spin up a foreign tenant + user.
        other_org = Organization.objects.create(
            name='Other Org', slug='other-org-xtenant',
        )
        other_user = User.objects.create(
            username='other-admin', is_superuser=True, organization=other_org,
        )
        other_token, _ = Token.objects.get_or_create(user=other_user)

        # Switch credentials + tenant headers to the other org.
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + other_token.key)
        approve = self.client.post(
            f'/api/currency-revaluations/{reval_id}/approve/',
            format='json',
            HTTP_X_TENANT_ID=str(other_org.id),
            HTTP_X_TENANT_SLUG=other_org.slug,
            HTTP_X_SCOPE='OFFICIAL',
        )
        # 404 (queryset filter) is the correct outcome here — the ID doesn't
        # exist for the other tenant. Anything else (200, 403) would mean
        # tenant boundary leaked.
        self.assertEqual(approve.status_code, 404, approve.content)

    def test_bulk_classify_invalid_classification_400s(self):
        r = self.client.post(
            '/api/coa/bulk-classify/',
            {'ids': [self.ar.id], 'classification': 'BOGUS'},
            format='json', **self._h(),
        )
        self.assertEqual(r.status_code, 400, r.content)
