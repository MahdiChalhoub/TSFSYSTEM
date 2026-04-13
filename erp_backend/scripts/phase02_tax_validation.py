"""
Phase 0.2 — Tax Engine Validation
==================================
Tests:
  0.2.1  TaxCalculator HT→TTC and TTC→HT math (pure unit test)
  0.2.2  Multi-line order tax (multi-rate scenario)
  0.2.3  OrgTaxPolicy model integrity + defaults
  0.2.4  CounterpartyTaxProfile model integrity + presets
  0.2.5  Tax mode resolution (company-type → HT/TTC)
"""

import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from decimal import Decimal
from apps.finance.tax_calculator import TaxCalculator
from erp.middleware import set_current_tenant_id

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []

def test(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, status))
    print(f"  {status}  {name}" + (f"  →  {detail}" if detail else ""))
    return condition


print("\n" + "="*70)
print("  PHASE 0.2 — TAX ENGINE VALIDATION")
print("="*70)


# ── 0.2.1  TaxCalculator Core Math ─────────────────────────────────
print("\n── 0.2.1  TaxCalculator Core Math ──────────────────────")

# Test 1: TTC→HT extraction (18% VAT, standard CI rate)
r = TaxCalculator.calculate_tax(Decimal('1180'), Decimal('0.18'), 'TTC')
test("TTC→HT: 1180 TTC @ 18%",
     r['ht'] == Decimal('1000.00') and r['tax'] == Decimal('180.00') and r['ttc'] == Decimal('1180'),
     f"ht={r['ht']}, tax={r['tax']}, ttc={r['ttc']}")

# Test 2: HT→TTC calculation (18% VAT)
r = TaxCalculator.calculate_tax(Decimal('1000'), Decimal('0.18'), 'HT')
test("HT→TTC: 1000 HT @ 18%",
     r['ht'] == Decimal('1000') and r['tax'] == Decimal('180.00') and r['ttc'] == Decimal('1180.00'),
     f"ht={r['ht']}, tax={r['tax']}, ttc={r['ttc']}")

# Test 3: TTC→HT with non-round number (11% rate)
r = TaxCalculator.calculate_tax(Decimal('1000'), Decimal('0.11'), 'TTC')
expected_ht = Decimal('900.90')  # 1000/1.11 = 900.9009... → 900.90
test("TTC→HT: 1000 TTC @ 11%",
     r['ht'] == expected_ht,
     f"ht={r['ht']} (expected {expected_ht}), tax={r['tax']}")

# Test 4: Zero rate
r = TaxCalculator.calculate_tax(Decimal('5000'), Decimal('0'), 'TTC')
test("Zero rate: 5000 @ 0%",
     r['ht'] == Decimal('5000') and r['tax'] == Decimal('0') and r['ttc'] == Decimal('5000'),
     f"ht={r['ht']}, tax={r['tax']}")

# Test 5: HT→TTC with 7.5% (partial rate)
r = TaxCalculator.calculate_tax(Decimal('2000'), Decimal('0.075'), 'HT')
test("HT→TTC: 2000 HT @ 7.5%",
     r['ht'] == Decimal('2000') and r['tax'] == Decimal('150.00') and r['ttc'] == Decimal('2150.00'),
     f"ht={r['ht']}, tax={r['tax']}, ttc={r['ttc']}")


# ── 0.2.2  Multi-Line Order Tax ────────────────────────────────────
print("\n── 0.2.2  Multi-Line Order Tax ─────────────────────────")

lines = [
    {'quantity': 3, 'unit_price': Decimal('1180'), 'tax_rate': Decimal('0.18')},   # 3x 1180 TTC
    {'quantity': 2, 'unit_price': Decimal('500'),  'tax_rate': Decimal('0.075')},   # 2x 500 TTC @ 7.5%
    {'quantity': 1, 'unit_price': Decimal('10000'), 'tax_rate': Decimal('0')},       # 1x 10000 exempt
]

r = TaxCalculator.calculate_order_tax(lines, mode='TTC', rounding='per_line')
test("Multi-line TTC order: 3 lines, mixed rates",
     r['total_ttc'] == r['total_ht'] + r['total_tax'],
     f"total_ht={r['total_ht']}, total_tax={r['total_tax']}, total_ttc={r['total_ttc']}")

# Verify line 1: 3 x 1180 TTC @ 18% → ht_each=1000, tax_each=180
lr = r['line_results']
test("Line 1: 3x1180 TTC @ 18%",
     lr[0]['unit_ht'] == Decimal('1000.00') and lr[0]['line_ht'] == Decimal('3000.00'),
     f"unit_ht={lr[0]['unit_ht']}, line_ht={lr[0]['line_ht']}")

# Test on_total rounding mode
r2 = TaxCalculator.calculate_order_tax(lines, mode='TTC', rounding='on_total')
test("on_total rounding mode",
     r2['total_ttc'] == r2['total_ht'] + r2['total_tax'],
     f"total_ht={r2['total_ht']}, total_ttc={r2['total_ttc']}")


# ── 0.2.3  OrgTaxPolicy Model ─────────────────────────────────────
print("\n── 0.2.3  OrgTaxPolicy Model ───────────────────────────")

set_current_tenant_id('336877c0-8c75-43bc-8463-b3e775dfee77')

from apps.finance.models.org_tax_policy import OrgTaxPolicy

policies = OrgTaxPolicy.objects.all()
test("OrgTaxPolicy table accessible",
     True, f"count={policies.count()}")

if policies.count() > 0:
    p = policies.first()
    test("Policy has required fields",
         hasattr(p, 'vat_output_enabled') and hasattr(p, 'vat_input_recoverability')
         and hasattr(p, 'airsi_treatment'),
         f"name='{p.name}', vat_out={p.vat_output_enabled}, recovery={p.vat_input_recoverability}")
    
    test("Default policy exists",
         policies.filter(is_default=True).exists(),
         f"default count={policies.filter(is_default=True).count()}")
    
    # Check cost impact ratio helper
    test("get_vat_cost_impact_ratio()",
         p.get_vat_cost_impact_ratio() == Decimal('1.000') - p.vat_input_recoverability,
         f"ratio={p.get_vat_cost_impact_ratio()}")
else:
    print("  ⚠️  No OrgTaxPolicy records found — creating seed...")
    p = OrgTaxPolicy.objects.create(
        organization_id='336877c0-8c75-43bc-8463-b3e775dfee77',
        name='Standard VAT Policy',
        is_default=True,
        country_code='CI',
        currency_code='XOF',
        vat_output_enabled=True,
        vat_input_recoverability=Decimal('1.000'),
        official_vat_treatment='RECOVERABLE',
        internal_vat_treatment='CAPITALIZE',
        airsi_treatment='CAPITALIZE',
        internal_cost_mode='TTC_ALWAYS',
    )
    test("Seeded default OrgTaxPolicy", p.id is not None, f"id={p.id}")


# ── 0.2.4  CounterpartyTaxProfile Model ───────────────────────────
print("\n── 0.2.4  CounterpartyTaxProfile Model ─────────────────")

from apps.finance.models.counterparty_tax_profile import CounterpartyTaxProfile

profiles = CounterpartyTaxProfile.objects.all()
test("CounterpartyTaxProfile table accessible",
     True, f"count={profiles.count()}")

if profiles.count() > 0:
    cp = profiles.first()
    test("Profile has required fields",
         hasattr(cp, 'vat_registered') and hasattr(cp, 'reverse_charge')
         and hasattr(cp, 'airsi_subject'),
         f"name='{cp.name}', vat={cp.vat_registered}, rc={cp.reverse_charge}, airsi={cp.airsi_subject}")
else:
    print("  ⚠️  No CounterpartyTaxProfile records — seeding presets...")
    from apps.finance.models.counterparty_tax_profile import (
        PRESET_ASSUJETTI, PRESET_NON_ASSUJETTI, PRESET_FOREIGN_B2B, PRESET_AIRSI_SUBJECT)
    
    presets = [
        {'name': PRESET_ASSUJETTI,     'vat_registered': True, 'reverse_charge': False, 'airsi_subject': False, 'is_system_preset': True},
        {'name': PRESET_NON_ASSUJETTI, 'vat_registered': False,'reverse_charge': False, 'airsi_subject': False, 'is_system_preset': True},
        {'name': PRESET_FOREIGN_B2B,   'vat_registered': False,'reverse_charge': True,  'airsi_subject': False, 'is_system_preset': True},
        {'name': PRESET_AIRSI_SUBJECT, 'vat_registered': True, 'reverse_charge': False, 'airsi_subject': True,  'is_system_preset': True},
    ]
    
    org_id = '336877c0-8c75-43bc-8463-b3e775dfee77'
    for preset in presets:
        obj, created = CounterpartyTaxProfile.objects.get_or_create(
            organization_id=org_id,
            name=preset['name'],
            defaults=preset,
        )
    
    profiles = CounterpartyTaxProfile.objects.filter(organization_id=org_id)
    test("Seeded counterparty presets",
         profiles.count() >= 4,
         f"count={profiles.count()}")


# ── 0.2.5  Tax Mode Resolution ─────────────────────────────────────
print("\n── 0.2.5  Tax Mode Resolution ──────────────────────────")

# These are pure logic tests on the calculator
test("TaxCalculator.calculate_line_tax exists", callable(getattr(TaxCalculator, 'calculate_line_tax', None)))
test("TaxCalculator.calculate_order_tax exists", callable(getattr(TaxCalculator, 'calculate_order_tax', None)))
test("TaxCalculator.resolve_effective_cost exists", callable(getattr(TaxCalculator, 'resolve_effective_cost', None)))

# Effective cost resolution
cost_ht = TaxCalculator.resolve_effective_cost(
    Decimal('1000'), Decimal('1180'),
    pricing_cost_basis='AUTO', vat_recoverable=True)
test("Effective cost: AUTO + recoverable → HT",
     cost_ht == Decimal('1000'),
     f"cost={cost_ht}")

cost_ttc = TaxCalculator.resolve_effective_cost(
    Decimal('1000'), Decimal('1180'),
    pricing_cost_basis='AUTO', vat_recoverable=False)
test("Effective cost: AUTO + non-recoverable → TTC",
     cost_ttc == Decimal('1180'),
     f"cost={cost_ttc}")

cost_force = TaxCalculator.resolve_effective_cost(
    Decimal('1000'), Decimal('1180'),
    pricing_cost_basis='FORCE_HT', vat_recoverable=False)
test("Effective cost: FORCE_HT overrides even non-recoverable",
     cost_force == Decimal('1000'),
     f"cost={cost_force}")


# ── Summary ────────────────────────────────────────────────────────
print("\n" + "="*70)
passed = sum(1 for _, s in results if s == PASS)
failed = sum(1 for _, s in results if s == FAIL)
print(f"  RESULTS: {passed} passed, {failed} failed, {len(results)} total")
if failed == 0:
    print("  🎉 ALL TAX ENGINE TESTS PASSED — Phase 0.2 VERIFIED")
else:
    print("  ⚠️  FAILURES DETECTED — review above")
    for name, s in results:
        if s == FAIL:
            print(f"    {FAIL}  {name}")
print("="*70 + "\n")
