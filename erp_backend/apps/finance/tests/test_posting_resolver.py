"""
PostingResolver Integration Tests
---------------------------------
Validates that PostingResolver correctly resolves GL account IDs
through all 3 resolution layers:
  1. OrgTaxPolicy (tax events)
  2. PostingRule model (DB-managed)
  3. Fallback JSON rules (ConfigurationService)

Run: python manage.py test apps.finance.tests.test_posting_resolver -v2
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from decimal import Decimal

from erp.models import Organization
from apps.finance.models import ChartOfAccount, FiscalYear, FiscalPeriod, PostingRule
from apps.finance.services.posting_resolver import PostingResolver, PostingEvents
from erp.services import ConfigurationService

import datetime


class PostingResolverIntegrationTests(TestCase):
    """End-to-end tests for the PostingResolver resolution chain."""

    def setUp(self):
        self.org = Organization.objects.create(
            name="Resolver Test Org", slug="resolver-test"
        )
        self.fy = FiscalYear.objects.create(
            organization=self.org,
            name="FY-2026",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 12, 31),
        )
        FiscalPeriod.objects.create(
            organization=self.org,
            fiscal_year=self.fy,
            name="P01-2026",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 1, 31),
        )

        # Create test accounts
        self.cash = ChartOfAccount.objects.create(
            organization=self.org, code="1000", name="Cash", type="ASSET"
        )
        self.receivable = ChartOfAccount.objects.create(
            organization=self.org, code="1100", name="Accounts Receivable", type="ASSET"
        )
        self.payable = ChartOfAccount.objects.create(
            organization=self.org, code="2100", name="Accounts Payable", type="LIABILITY"
        )
        self.revenue = ChartOfAccount.objects.create(
            organization=self.org, code="4000", name="Revenue", type="REVENUE"
        )
        self.inventory = ChartOfAccount.objects.create(
            organization=self.org, code="1200", name="Inventory", type="ASSET"
        )
        self.cogs = ChartOfAccount.objects.create(
            organization=self.org, code="5000", name="COGS", type="EXPENSE"
        )
        self.vat_collected = ChartOfAccount.objects.create(
            organization=self.org, code="4430", name="VAT Collected", type="LIABILITY"
        )
        self.vat_recoverable = ChartOfAccount.objects.create(
            organization=self.org, code="4450", name="VAT Recoverable", type="ASSET"
        )

        # Clear resolver caches between tests
        PostingResolver.clear_cache()

    def tearDown(self):
        PostingResolver.clear_cache()

    # ── Layer 2: JSON posting rules (via ConfigurationService) ──────

    def test_resolve_from_json_rules(self):
        """PostingResolver resolves from JSON rules when PostingRule DB has nothing."""
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['sales'] = rules.get('sales', {})
        rules['sales']['receivable'] = self.receivable.id
        rules['sales']['revenue'] = self.revenue.id
        rules['purchases'] = rules.get('purchases', {})
        rules['purchases']['payable'] = self.payable.id
        rules['purchases']['inventory'] = self.inventory.id
        ConfigurationService.save_posting_rules(self.org, rules)

        PostingResolver.clear_cache()

        # Resolve using dot-notation keys
        result = PostingResolver.resolve(self.org, 'sales.receivable', required=False)
        self.assertEqual(result, self.receivable.id)

        result = PostingResolver.resolve(self.org, 'purchases.payable', required=False)
        self.assertEqual(result, self.payable.id)

        result = PostingResolver.resolve(self.org, 'purchases.inventory', required=False)
        self.assertEqual(result, self.inventory.id)

    def test_resolve_required_raises_on_missing(self):
        """PostingResolver raises ValidationError when required=True and key missing."""
        PostingResolver.clear_cache()

        with self.assertRaises(ValidationError) as cm:
            PostingResolver.resolve(self.org, 'nonexistent.account.key', required=True)
        self.assertIn("Posting account not configured", str(cm.exception))

    def test_resolve_optional_returns_none_on_missing(self):
        """PostingResolver returns None when required=False and key missing."""
        PostingResolver.clear_cache()

        result = PostingResolver.resolve(self.org, 'nonexistent.account.key', required=False)
        self.assertIsNone(result)

    # ── Layer 1: PostingRule model takes precedence ─────────────────

    def test_posting_rule_model_overrides_json(self):
        """PostingRule DB record overrides JSON rules."""
        # Set JSON rules pointing receivable to one account
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['sales'] = rules.get('sales', {})
        rules['sales']['receivable'] = self.receivable.id
        ConfigurationService.save_posting_rules(self.org, rules)

        # Create a PostingRule model pointing to a DIFFERENT account
        PostingRule.objects.create(
            organization=self.org,
            event_code='sales.receivable',
            account=self.cash,  # Different from JSON
            is_active=True,
        )
        PostingResolver.clear_cache()

        result = PostingResolver.resolve(self.org, 'sales.receivable', required=False)
        # Model-managed rule should win over JSON
        self.assertEqual(result, self.cash.id)

    # ── Layer 0: Tax policy resolution ──────────────────────────────

    def test_tax_event_resolves_from_tax_policy(self):
        """Tax-related events resolve from OrgTaxPolicy when configured."""
        from apps.finance.models import OrgTaxPolicy

        OrgTaxPolicy.objects.update_or_create(
            organization=self.org,
            defaults={
                'vat_collected_account': self.vat_collected,
                'vat_recoverable_account': self.vat_recoverable,
            }
        )
        PostingResolver.clear_cache()

        vat_col = PostingResolver.resolve(
            self.org, PostingEvents.SALES_VAT_COLLECTED, required=False
        )
        self.assertEqual(vat_col, self.vat_collected.id)

        vat_rec = PostingResolver.resolve(
            self.org, PostingEvents.PURCHASES_VAT_RECOVERABLE, required=False
        )
        self.assertEqual(vat_rec, self.vat_recoverable.id)

    # ── Batch resolution ────────────────────────────────────────────

    def test_resolve_many(self):
        """resolve_many returns a dict of event_code → account_id."""
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['sales'] = rules.get('sales', {})
        rules['sales']['receivable'] = self.receivable.id
        rules['sales']['revenue'] = self.revenue.id
        rules['sales']['cogs'] = self.cogs.id
        ConfigurationService.save_posting_rules(self.org, rules)
        PostingResolver.clear_cache()

        results = PostingResolver.resolve_many(self.org, [
            'sales.receivable',
            'sales.revenue',
            'sales.cogs',
            'nonexistent.key',
        ])
        self.assertEqual(results['sales.receivable'], self.receivable.id)
        self.assertEqual(results['sales.revenue'], self.revenue.id)
        self.assertEqual(results['sales.cogs'], self.cogs.id)
        self.assertIsNone(results['nonexistent.key'])

    # ── Cache correctness ───────────────────────────────────────────

    def test_cache_invalidation(self):
        """Clearing cache causes fresh lookups."""
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['sales'] = rules.get('sales', {})
        rules['sales']['receivable'] = self.receivable.id
        ConfigurationService.save_posting_rules(self.org, rules)
        PostingResolver.clear_cache()

        # First resolve
        r1 = PostingResolver.resolve(self.org, 'sales.receivable', required=False)
        self.assertEqual(r1, self.receivable.id)

        # Change the rule
        rules['sales']['receivable'] = self.cash.id
        ConfigurationService.save_posting_rules(self.org, rules)
        PostingResolver.clear_cache()

        # Second resolve — should see the new value
        r2 = PostingResolver.resolve(self.org, 'sales.receivable', required=False)
        self.assertEqual(r2, self.cash.id)

    # ── Legacy event code compatibility ─────────────────────────────

    def test_legacy_event_code_compatibility(self):
        """Legacy flat event codes still resolve correctly."""
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['purchases'] = rules.get('purchases', {})
        rules['purchases']['payable'] = self.payable.id
        ConfigurationService.save_posting_rules(self.org, rules)
        PostingResolver.clear_cache()

        # Legacy-style key should resolve
        result = PostingResolver.resolve(self.org, 'purchases.payable', required=False)
        self.assertEqual(result, self.payable.id)

    # ── End-to-end: full POS-style resolution ───────────────────────

    def test_full_pos_resolution_chain(self):
        """
        Simulates the exact resolution chain used by POS services:
        1. get_posting_rules() → rules dict
        2. PostingResolver.resolve() for each event
        This validates the architectural contract between POS and Finance.
        """
        # Setup rules exactly as the enterprise seeder would
        rules = ConfigurationService.get_posting_rules(self.org)
        rules.update({
            'sales': {
                'receivable': self.receivable.id,
                'revenue': self.revenue.id,
                'cogs': self.cogs.id,
                'inventory': self.inventory.id,
            },
            'purchases': {
                'payable': self.payable.id,
                'inventory': self.inventory.id,
            },
        })
        ConfigurationService.save_posting_rules(self.org, rules)
        PostingResolver.clear_cache()

        # Resolve all POS-critical accounts
        accounts = PostingResolver.resolve_many(self.org, [
            'sales.receivable',
            'sales.revenue',
            'sales.cogs',
            'sales.inventory',
            'purchases.payable',
            'purchases.inventory',
        ])

        # All must resolve (non-None)
        for key, value in accounts.items():
            self.assertIsNotNone(value, f"PostingResolver failed to resolve '{key}'")

        # Validate correct mapping
        self.assertEqual(accounts['sales.receivable'], self.receivable.id)
        self.assertEqual(accounts['sales.revenue'], self.revenue.id)
        self.assertEqual(accounts['purchases.payable'], self.payable.id)
        self.assertEqual(accounts['purchases.inventory'], self.inventory.id)
