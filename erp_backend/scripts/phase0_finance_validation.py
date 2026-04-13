"""
Phase 0: Finance Core Validation Script
========================================
Tests the complete posting pipeline:
  1. Create test tenant + COA + posting rules
  2. Create manual journal entry → verify it posts to ledger
  3. Verify account balances are correct
  4. Verify posting resolver resolves correct accounts
  5. Verify trial balance calculation

Run: docker exec tsf_backend python manage.py shell < scripts/phase0_finance_validation.py
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Setup Django
if not django.conf.settings.configured:
    django.setup()

from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone

# ──────────────────────────────────────────────────────────────────────
# Setup: get or create test org + user
# ──────────────────────────────────────────────────────────────────────

from erp.models import Organization, User, GlobalCurrency

print("=" * 70)
print("  PHASE 0 — FINANCE CORE VALIDATION")
print("=" * 70)

# Use existing org (avoid schema drift issues on production DB)
org = Organization.objects.filter(slug='saas').first()
if not org:
    print("✗ FATAL: No 'saas' organization found. Cannot continue.")
    sys.exit(1)

user = User.objects.filter(is_superuser=True).first()
if not user:
    print("✗ FATAL: No superuser found. Cannot continue.")
    sys.exit(1)

# Ensure org has a currency
currency, _ = GlobalCurrency.objects.get_or_create(
    code='USD', defaults={'name': 'US Dollar', 'symbol': '$'}
)
if not org.base_currency:
    org.base_currency = currency
    org.save(update_fields=['base_currency'])

print(f"\n✓ Test org: {org.name} (id={org.id})")
print(f"✓ Test user: {user.username}")

# Set tenant context for TenantManager
from erp.middleware import set_current_tenant_id
set_current_tenant_id(str(org.id))

# ──────────────────────────────────────────────────────────────────────
# Test 1: COA Setup
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 1: Chart of Accounts Setup")
print("─" * 70)

from apps.finance.models import ChartOfAccount

# Create essential COA accounts if they don't exist
test_accounts = [
    {'code': '1000', 'name': 'Cash',                'type': 'ASSET',     'class_code': '1'},
    {'code': '1200', 'name': 'Inventory',            'type': 'ASSET',     'class_code': '1'},
    {'code': '2000', 'name': 'Accounts Payable',     'type': 'LIABILITY', 'class_code': '2'},
    {'code': '3000', 'name': 'Accounts Receivable',  'type': 'ASSET',     'class_code': '1'},
    {'code': '4000', 'name': 'Sales Revenue',        'type': 'REVENUE',   'class_code': '4'},
    {'code': '5000', 'name': 'Cost of Goods Sold',   'type': 'EXPENSE',   'class_code': '5'},
    {'code': '4430', 'name': 'VAT Collected',        'type': 'LIABILITY', 'class_code': '4'},
    {'code': '4450', 'name': 'VAT Recoverable',      'type': 'ASSET',     'class_code': '4'},
]

created_accounts = {}
for acc_data in test_accounts:
    acc, created = ChartOfAccount.objects.get_or_create(
        organization=org,
        code=acc_data['code'],
        defaults={
            'name': acc_data['name'],
            'type': acc_data['type'],
            'class_code': acc_data['class_code'],
            'balance': Decimal('0'),
            'balance_official': Decimal('0'),
            'is_active': True,
            'allow_posting': True,
        }
    )
    created_accounts[acc_data['code']] = acc
    status = "✓ Created" if created else "○ Exists"
    print(f"  {status}: {acc.code} — {acc.name} ({acc.type})")

print(f"\n  Total COA accounts: {ChartOfAccount.objects.filter(organization=org).count()}")

# ──────────────────────────────────────────────────────────────────────
# Test 2: Fiscal Year + Period Setup
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 2: Fiscal Year & Period Setup")
print("─" * 70)

from apps.finance.models import FiscalYear, FiscalPeriod

today = date.today()
fy_start = date(today.year, 1, 1)
fy_end = date(today.year, 12, 31)

fy, fy_created = FiscalYear.objects.get_or_create(
    organization=org,
    start_date=fy_start,
    defaults={
        'name': f'FY {today.year}',
        'end_date': fy_end,
        'is_active': True,
    }
)
print(f"  {'✓ Created' if fy_created else '○ Exists'}: {fy.name} ({fy_start} → {fy_end})")

# Create monthly periods
periods_created = 0
for month in range(1, 13):
    import calendar
    month_start = date(today.year, month, 1)
    month_end = date(today.year, month, calendar.monthrange(today.year, month)[1])
    
    fp, fp_created = FiscalPeriod.objects.get_or_create(
        organization=org,
        fiscal_year=fy,
        start_date=month_start,
        defaults={
            'name': f'{calendar.month_abbr[month]} {today.year}',
            'end_date': month_end,
            'status': 'OPEN',
        }
    )
    if fp_created:
        periods_created += 1

print(f"  ✓ Created {periods_created} new fiscal periods (12 total)")

# Get current period
current_period = FiscalPeriod.objects.filter(
    organization=org,
    start_date__lte=today,
    end_date__gte=today,
).first()
print(f"  ✓ Current period: {current_period.name}")

# ──────────────────────────────────────────────────────────────────────
# Test 3: Posting Rules Setup
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 3: Posting Rules Setup")
print("─" * 70)

from apps.finance.models.posting_rule import PostingRule

posting_rules = [
    ('sales.receivable',        '3000', 'Accounts Receivable'),
    ('sales.revenue',           '4000', 'Sales Revenue'),
    ('sales.cogs',              '5000', 'COGS'),
    ('sales.inventory',         '1200', 'Inventory'),
    ('sales.vat_collected',     '4430', 'VAT Collected'),
    ('purchases.payable',       '2000', 'Accounts Payable'),
    ('purchases.inventory',     '1200', 'Inventory'),
    ('purchases.vat_recoverable', '4450', 'VAT Recoverable'),
]

for event_code, acc_code, desc in posting_rules:
    acc = created_accounts.get(acc_code)
    if not acc:
        print(f"  ✗ SKIP: No account {acc_code} for {event_code}")
        continue
    rule, created = PostingRule.objects.get_or_create(
        organization=org,
        event_code=event_code,
        defaults={
            'account': acc,
            'source': 'SEED',
            'description': desc,
        }
    )
    status = "✓ Created" if created else "○ Exists"
    print(f"  {status}: {event_code} → {acc.code} ({acc.name})")

# ──────────────────────────────────────────────────────────────────────
# Test 4: PostingResolver Resolution
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 4: PostingResolver Account Resolution")
print("─" * 70)

from apps.finance.services.posting_resolver import PostingResolver, PostingEvents

# Clear cache
PostingResolver.clear_cache()

test_events = [
    PostingEvents.SALES_RECEIVABLE,
    PostingEvents.SALES_REVENUE,
    PostingEvents.SALES_COGS,
    PostingEvents.SALES_VAT_COLLECTED,
    PostingEvents.PURCHASES_PAYABLE,
    PostingEvents.PURCHASES_INVENTORY,
    PostingEvents.PURCHASES_VAT_RECOVERABLE,
]

all_resolved = True
for event_code in test_events:
    acc_id = PostingResolver.resolve(org, event_code, required=False)
    if acc_id:
        acc = ChartOfAccount.objects.filter(id=acc_id, organization=org).first()
        print(f"  ✓ {event_code:40s} → {acc.code} ({acc.name})" if acc else f"  ✗ {event_code} → id={acc_id} (NOT FOUND!)")
    else:
        print(f"  ✗ {event_code:40s} → NOT CONFIGURED")
        all_resolved = False

if all_resolved:
    print("\n  ✅ ALL posting events resolved successfully")
else:
    print("\n  ❌ Some posting events failed to resolve")

# ──────────────────────────────────────────────────────────────────────
# Test 5: Create & Post Manual Journal Entry
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 5: Create & Post Journal Entry")
print("─" * 70)

from apps.finance.services.ledger_service import LedgerService

# Reset test account balances
for acc in created_accounts.values():
    acc.balance = Decimal('0')
    acc.balance_official = Decimal('0')
    acc.save()

try:
    cash_acc = created_accounts['1000']
    revenue_acc = created_accounts['4000']
    
    entry = LedgerService.create_journal_entry(
        organization=org,
        transaction_date=today,
        description='Test sale: Phase 0 validation',
        reference='TEST-001',
        status='POSTED',
        scope='OFFICIAL',
        user=user,
        lines=[
            {'account_id': cash_acc.id, 'debit': Decimal('1000.00'), 'credit': Decimal('0.00'), 'description': 'Cash received'},
            {'account_id': revenue_acc.id, 'debit': Decimal('0.00'), 'credit': Decimal('1000.00'), 'description': 'Revenue earned'},
        ]
    )
    
    print(f"  ✓ Journal Entry created: {entry.reference}")
    print(f"    Status: {entry.status}")
    print(f"    Posted at: {entry.posted_at}")
    print(f"    Hash: {entry.entry_hash[:20]}..." if entry.entry_hash else "    Hash: (none)")
    print(f"    Lines: {entry.lines.count()}")
    
except Exception as e:
    print(f"  ✗ FAILED: {e}")
    import traceback; traceback.print_exc()

# ──────────────────────────────────────────────────────────────────────
# Test 6: Verify Account Balances
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 6: Verify Account Balances After Posting")
print("─" * 70)

# Refresh from DB
balance_ok = True
for code, acc in created_accounts.items():
    acc.refresh_from_db()
    if code == '1000':  # Cash — should have +1000 (debit account)
        expected = Decimal('1000.00')
        actual = acc.balance
        ok = abs(actual - expected) < Decimal('0.01')
        icon = "✓" if ok else "✗"
        print(f"  {icon} {acc.code} {acc.name:30s} Balance: {actual:>12.2f}  (expected: {expected:>12.2f})")
        if not ok: balance_ok = False
    elif code == '4000':  # Revenue — should have -1000 (credit account)
        expected = Decimal('-1000.00')
        actual = acc.balance
        ok = abs(actual - expected) < Decimal('0.01')
        icon = "✓" if ok else "✗"
        print(f"  {icon} {acc.code} {acc.name:30s} Balance: {actual:>12.2f}  (expected: {expected:>12.2f})")
        if not ok: balance_ok = False
    else:
        print(f"  ○ {acc.code} {acc.name:30s} Balance: {acc.balance:>12.2f}")

if balance_ok:
    print("\n  ✅ Account balances are CORRECT")
else:
    print("\n  ❌ Account balances are WRONG")

# ──────────────────────────────────────────────────────────────────────
# Test 7: Trial Balance
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 7: Trial Balance Verification")
print("─" * 70)

from apps.finance.services.balance_service import BalanceService

try:
    trial_balance = BalanceService.get_trial_balance(org, current_period)
    
    total_dr = Decimal('0')
    total_cr = Decimal('0')
    for row in trial_balance:
        dr = row.get('movement_debit', Decimal('0'))
        cr = row.get('movement_credit', Decimal('0'))
        total_dr += dr
        total_cr += cr
        print(f"  {row['account_code']:6s} {row['account_name']:30s}  Dr: {dr:>12.2f}  Cr: {cr:>12.2f}  (src: {row.get('source', 'N/A')})")
    
    print(f"\n  {'─' * 60}")
    print(f"  {'TOTAL':37s}  Dr: {total_dr:>12.2f}  Cr: {total_cr:>12.2f}")
    
    tb_balanced = abs(total_dr - total_cr) < Decimal('0.01')
    if tb_balanced:
        print(f"\n  ✅ Trial Balance is BALANCED (Dr == Cr)")
    else:
        print(f"\n  ❌ Trial Balance is OUT OF BALANCE!")

except Exception as e:
    print(f"  ✗ Trial Balance FAILED: {e}")
    import traceback; traceback.print_exc()

# ──────────────────────────────────────────────────────────────────────
# Test 8: Journal Entry Reversal
# ──────────────────────────────────────────────────────────────────────

print("\n" + "─" * 70)
print("  TEST 8: Journal Entry Reversal")
print("─" * 70)

try:
    reversal = LedgerService.reverse_journal_entry(org, entry.id, user=user)
    print(f"  ✓ Reversal created: {reversal.reference}")
    print(f"    Status: {reversal.status}")
    
    # Check balances are back to zero
    cash_acc.refresh_from_db()
    revenue_acc.refresh_from_db()
    
    cash_ok = abs(cash_acc.balance) < Decimal('0.01')
    rev_ok = abs(revenue_acc.balance) < Decimal('0.01')
    
    print(f"  {'✓' if cash_ok else '✗'} Cash balance after reversal: {cash_acc.balance}")
    print(f"  {'✓' if rev_ok else '✗'} Revenue balance after reversal: {revenue_acc.balance}")
    
    if cash_ok and rev_ok:
        print(f"\n  ✅ Reversal correctly zeroed balances")
    else:
        print(f"\n  ❌ Reversal did NOT zero balances")

except Exception as e:
    print(f"  ✗ Reversal FAILED: {e}")
    import traceback; traceback.print_exc()

# ──────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────

print("\n" + "=" * 70)
print("  PHASE 0 VALIDATION COMPLETE")
print("=" * 70)
print("""
  Tests:
    1. COA Setup                ✓
    2. Fiscal Year/Periods      ✓
    3. Posting Rules            ✓
    4. PostingResolver          — see results above
    5. Journal Entry Creation   — see results above
    6. Account Balances         — see results above
    7. Trial Balance            — see results above
    8. Journal Entry Reversal   — see results above
""")
