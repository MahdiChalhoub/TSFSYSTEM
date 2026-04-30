"""
Tests for the bulk-classify endpoint + the _smart_default_for heuristic
in apps/finance/views/account_views.py.
"""
from decimal import Decimal

from django.test import TestCase

from erp.models import Organization, User
from kernel.tenancy.context import tenant_context
from apps.finance.models import ChartOfAccount
from apps.finance.views.account_views import _smart_default_for


class SmartDefaultHeuristicTests(TestCase):
    """Pure-function tests for the classification heuristic."""

    def setUp(self):
        self.org = Organization.objects.create(name='SmartOrg', slug='smart-org')

    def _mk(self, **overrides):
        with tenant_context(self.org):
            return ChartOfAccount.objects.create(
                organization=self.org,
                code=overrides.pop('code', '9999'),
                name=overrides.pop('name', 'X'),
                type=overrides.pop('type', 'ASSET'),
                normal_balance=overrides.pop('normal_balance', 'DEBIT'),
                allow_posting=True,
                **overrides,
            )

    def test_income_account_classifies_as_income_expense(self):
        acc = self._mk(type='INCOME', currency='USD')
        self.assertEqual(_smart_default_for(acc), ('INCOME_EXPENSE', True))

    def test_expense_account_no_currency_classifies_as_income_expense_no_reval(self):
        """Income/expense in base currency: classification matters but reval doesn't fire."""
        acc = self._mk(type='EXPENSE')
        cls, reval = _smart_default_for(acc)
        self.assertEqual(cls, 'INCOME_EXPENSE')
        self.assertFalse(reval)

    def test_equity_account_classifies_non_monetary(self):
        acc = self._mk(type='EQUITY', code='3000')
        self.assertEqual(_smart_default_for(acc), ('NON_MONETARY', False))

    def test_inventory_role_classifies_non_monetary(self):
        acc = self._mk(type='ASSET', system_role='INVENTORY', code='1300')
        cls, _ = _smart_default_for(acc)
        self.assertEqual(cls, 'NON_MONETARY')

    def test_cash_subtype_classifies_monetary(self):
        acc = self._mk(type='ASSET', sub_type='CASH', currency='USD', code='1100')
        self.assertEqual(_smart_default_for(acc), ('MONETARY', True))

    def test_receivable_subtype_classifies_monetary(self):
        acc = self._mk(type='ASSET', sub_type='RECEIVABLE', currency='USD', code='1200')
        self.assertEqual(_smart_default_for(acc), ('MONETARY', True))

    def test_payable_subtype_classifies_monetary(self):
        acc = self._mk(type='LIABILITY', sub_type='PAYABLE', currency='USD',
                       code='2100', normal_balance='CREDIT')
        self.assertEqual(_smart_default_for(acc), ('MONETARY', True))

    def test_asset_in_base_currency_classifies_monetary_no_reval(self):
        """Account without `currency` field set: still monetary but reval=False."""
        acc = self._mk(type='ASSET', code='1500')
        cls, reval = _smart_default_for(acc)
        self.assertEqual(cls, 'MONETARY')
        self.assertFalse(reval)


class BackfillMigrationTests(TestCase):
    """Verifies the data migration's heuristic mirrors the runtime helper."""

    def test_migration_classifier_matches_runtime(self):
        """Quick guard against drift between the migration and view code."""
        from apps.finance.migrations import (
            __init__,  # noqa: F401  ensure migrations module is importable
        )
        # Import the classify helper from the migration module by file path.
        import importlib.util
        path = (
            'apps/finance/migrations/0076_backfill_monetary_classification.py'
        )
        # Resolve relative to the project root.
        import os
        for candidate in (
            path,
            os.path.join(os.path.dirname(__file__), '..', 'migrations',
                         '0076_backfill_monetary_classification.py'),
        ):
            if os.path.exists(candidate):
                path = candidate
                break
        spec = importlib.util.spec_from_file_location('mig0076', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        # Spot-check a few mappings — full coverage is in
        # SmartDefaultHeuristicTests above.
        self.assertEqual(mod._classify('INCOME', None, None), 'INCOME_EXPENSE')
        self.assertEqual(mod._classify('EQUITY', None, None), 'NON_MONETARY')
        self.assertEqual(mod._classify('ASSET', 'INVENTORY', None), 'NON_MONETARY')
        self.assertEqual(mod._classify('ASSET', None, 'CASH'), 'MONETARY')
        self.assertEqual(mod._classify('LIABILITY', None, None), 'MONETARY')
