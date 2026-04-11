"""
Test Compound Tax Engine
========================
Tests for tax-on-tax (compound) scenarios added in Phase 1 of the
Tax Engine Enhancement.

These tests validate:
  1. Default HT base mode (backward compat)
  2. TTC base mode (running gross)
  3. PREVIOUS_TAX base mode (tax-on-specific-tax)
  4. Deterministic ordering via calculation_order
  5. Mixed: core VAT + compound custom + AIRSI
"""
from decimal import Decimal
from unittest import TestCase
from apps.finance.tax_calculator import TaxCalculator, TaxEngineContext


class MockCustomTaxRule:
    """Lightweight stand-in for CustomTaxRule model instances."""
    def __init__(self, name='Test Tax', rate=Decimal('0.05'),
                 transaction_type='BOTH', math_behavior='ADDED_TO_TTC',
                 purchase_cost_treatment='EXPENSE',
                 tax_base_mode='HT', base_tax_type=None,
                 calculation_order=100, compound_group=None):
        self.id = id(self)
        self.name = name
        self.rate = rate
        self.transaction_type = transaction_type
        self.math_behavior = math_behavior
        self.purchase_cost_treatment = purchase_cost_treatment
        self.tax_base_mode = tax_base_mode
        self.base_tax_type = base_tax_type
        self.calculation_order = calculation_order
        self.compound_group = compound_group
        self.is_active = True


class CompoundTaxBaseTests(TestCase):
    """Test different tax_base_mode values."""

    def _make_ctx(self, custom_rules=None, vat_recoverability='1.000'):
        return TaxEngineContext(
            scope='OFFICIAL',
            vat_output_enabled=True,
            vat_input_recoverability=Decimal(vat_recoverability),
            custom_rules=custom_rules or [],
        )

    # ── Test 1: Default HT base (backward compat) ────────────────────

    def test_custom_rule_ht_base_default(self):
        """
        CustomTaxRule with tax_base_mode=HT (default) → tax on base_ht.
        HT=1000, VAT=18%, Custom=5% on HT → custom=50.
        """
        rule = MockCustomTaxRule(name='Eco Tax', rate=Decimal('0.05'),
                                 tax_base_mode='HT')
        ctx = self._make_ctx(custom_rules=[rule])
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            ctx=ctx,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 1)
        self.assertAlmostEqual(custom_lines[0]['amount'], 50.0)
        self.assertAlmostEqual(custom_lines[0]['base_amount'], 1000.0)

    # ── Test 2: TTC base mode (running gross) ─────────────────────────

    def test_custom_rule_ttc_base(self):
        """
        CustomTaxRule with tax_base_mode=TTC → tax on running gross.
        HT=1000, VAT=10%, Custom=5% on TTC.
        Running gross = 1000 + 100 (VAT) = 1100.
        Custom tax = 5% × 1100 = 55.
        """
        rule = MockCustomTaxRule(name='Env Tax', rate=Decimal('0.05'),
                                 tax_base_mode='TTC')
        ctx = self._make_ctx(custom_rules=[rule])
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.10'),
            ctx=ctx,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 1)
        # Running gross = 1000 (HT) + 100 (VAT) = 1100
        self.assertAlmostEqual(custom_lines[0]['base_amount'], 1100.0)
        self.assertAlmostEqual(custom_lines[0]['amount'], 55.0)

    # ── Test 3: PREVIOUS_TAX base mode ────────────────────────────────

    def test_custom_rule_previous_tax_base(self):
        """
        CustomTaxRule with tax_base_mode=PREVIOUS_TAX, base_tax_type=VAT.
        HT=1000, VAT=18%=180, Custom=5% on VAT amount → 5%×180=9.
        """
        rule = MockCustomTaxRule(name='VAT Surcharge', rate=Decimal('0.05'),
                                 tax_base_mode='PREVIOUS_TAX',
                                 base_tax_type='VAT')
        ctx = self._make_ctx(custom_rules=[rule])
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            ctx=ctx,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 1)
        self.assertAlmostEqual(custom_lines[0]['base_amount'], 180.0)
        self.assertAlmostEqual(custom_lines[0]['amount'], 9.0)

    # ── Test 4: Deterministic ordering ────────────────────────────────

    def test_calculation_order_deterministic(self):
        """
        Two compound rules: rule_a (order=50, TTC base) then rule_b (order=150, TTC base).
        rule_a should execute first and its amount included in rule_b's running gross.

        HT=1000, VAT=10%=100.
        rule_a: 5% on TTC(1100) = 55
        rule_b: 10% on TTC(1100+55) = 115.50
        """
        rule_a = MockCustomTaxRule(name='Tax A', rate=Decimal('0.05'),
                                    tax_base_mode='TTC', calculation_order=50)
        rule_b = MockCustomTaxRule(name='Tax B', rate=Decimal('0.10'),
                                    tax_base_mode='TTC', calculation_order=150)
        ctx = self._make_ctx(custom_rules=[rule_b, rule_a])  # Intentionally reversed

        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.10'),
            ctx=ctx,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 2)

        # Should be sorted by execution order despite reversed input
        # rule_a (order=50): 5% on 1100 = 55
        self.assertAlmostEqual(custom_lines[0]['amount'], 55.0)

        # rule_b (order=150): 10% on (1000 + 100 + 55) = 10% on 1155 = 115.50
        self.assertAlmostEqual(custom_lines[1]['amount'], 115.50)

    # ── Test 5: Mixed core + compound + AIRSI ─────────────────────────

    def test_mixed_core_vat_with_compound_and_airsi(self):
        """
        Full scenario: VAT + AIRSI + compound custom tax.
        HT=1000, VAT=18%=180 (fully recoverable), AIRSI=5%=50 (capitalize).
        Custom: 3% on TTC.
        
        Running gross for custom = 1000 + 180 + 50 = 1230 (but wait:
        AIRSI tax_line is included in tax_lines list, so running gross = 
        base_ht + sum(all tax amounts) = 1000 + 180 + 50 = 1230).
        Custom tax = 3% × 1230 = 36.90.
        """
        rule = MockCustomTaxRule(name='Municipal Levy', rate=Decimal('0.03'),
                                 tax_base_mode='TTC')
        ctx = self._make_ctx(custom_rules=[rule])
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            airsi_rate=Decimal('0.05'),
            ctx=ctx,
            supplier_airsi_subject=True,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 1)
        # Running gross = 1000 + 180 (VAT) + 50 (AIRSI) = 1230
        self.assertAlmostEqual(custom_lines[0]['base_amount'], 1230.0)
        self.assertAlmostEqual(custom_lines[0]['amount'], 36.90)

        # Verify all tax lines have base_amount set
        for tl in result['tax_lines']:
            self.assertIn('base_amount', tl, f"Tax line {tl['type']} missing base_amount")

    # ── Test 6: No compound rules = backward compatible ───────────────

    def test_no_custom_rules_unchanged(self):
        """
        Without custom rules, resolve_purchase_costs produces same result as before.
        HT=1000, VAT=18%, full recovery → cost_official=1000.
        """
        ctx = self._make_ctx()
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            ctx=ctx,
        )

        self.assertEqual(result['cost_official'], Decimal('1000.00'))
        self.assertEqual(result['vat_recoverable'], Decimal('180.00'))
        self.assertEqual(result['base_ht'], Decimal('1000'))

    # ── Test 7: PREVIOUS_TAX with no matching prior tax → 0 base ──────

    def test_previous_tax_no_match_produces_zero(self):
        """
        If base_tax_type references a tax type not in the prior lines,
        the base is 0 and no tax amount is produced.
        """
        rule = MockCustomTaxRule(name='Ghost Surcharge', rate=Decimal('0.10'),
                                 tax_base_mode='PREVIOUS_TAX',
                                 base_tax_type='EXCISE')  # No EXCISE in core
        ctx = self._make_ctx(custom_rules=[rule])
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            ctx=ctx,
        )

        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        # c_base = 0 (no EXCISE), c_amount = 0 → skipped
        self.assertEqual(len(custom_lines), 0)

    # ── Test 8: INTERNAL scope guard still works with compound taxes ──

    def test_internal_scope_no_vat_with_compound(self):
        """
        INTERNAL scope: no VAT lines. Custom tax on TTC base should
        only see HT (since no VAT in tax_lines).
        """
        rule = MockCustomTaxRule(name='Admin Levy', rate=Decimal('0.05'),
                                 tax_base_mode='TTC')
        ctx = TaxEngineContext(
            scope='INTERNAL',
            vat_output_enabled=True,
            vat_input_recoverability=Decimal('1.000'),
            internal_cost_mode='TTC_ALWAYS',
            custom_rules=[rule],
        )
        result = TaxCalculator.resolve_purchase_costs(
            base_ht=Decimal('1000'),
            vat_rate=Decimal('0.18'),
            ctx=ctx,
        )

        # No VAT lines due to scope guard
        vat_lines = [t for t in result['tax_lines'] if t['type'] in ('VAT', 'VAT_REVERSE_CHARGE')]
        self.assertEqual(len(vat_lines), 0)

        # Custom TTC base = HT only (1000) since no prior taxes
        custom_lines = [t for t in result['tax_lines'] if t['type'] == 'CUSTOM']
        self.assertEqual(len(custom_lines), 1)
        self.assertAlmostEqual(custom_lines[0]['base_amount'], 1000.0)
        self.assertAlmostEqual(custom_lines[0]['amount'], 50.0)
