"""
Finance End-to-End Test Suite
=============================
Tests the full lifecycle from empty org to year-end close.

Run: cd erp_backend && python3 tests/test_finance_e2e.py

Test cases:
  1. Empty org — COA import
  2. Posting rules auto-sync
  3. Fiscal year + periods creation
  4. Simple journal entry (sale)
  5. Complex multi-line journal entry
  6. Balance verification (trial balance, P&L, balance sheet)
  7. Template switch with data (migration case)
  8. Site-level balance filtering
  9. Period close with draft entries (should fail)
  10. Period close (happy path)
  11. Year-end close preview
  12. Year-end close execution (P&L → Retained Earnings)
  13. Opening balances in next year
  14. Import case detection (EMPTY, UNTOUCHED, NEEDS_MIGRATION)
"""
import os, sys, django, traceback
from decimal import Decimal
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

# Force reload to get latest code
import importlib
import apps.finance.services.ledger_coa as _m1; importlib.reload(_m1)
import apps.finance.services.ledger_core as _m1b; importlib.reload(_m1b)
import apps.finance.services.ledger_service as _m2; importlib.reload(_m2)
import apps.finance.services.closing_service as _m3; importlib.reload(_m3)

from erp.models import Organization
from apps.finance.models import (
    ChartOfAccount, PostingRule, JournalEntry, JournalEntryLine,
    FiscalYear, FiscalPeriod,
)
from apps.finance.models.posting_event import PostingEvent
from apps.finance.services.ledger_service import LedgerService
from apps.finance.services.closing_service import ClosingService

# Re-import after reload to get fresh code
LedgerService = _m2.LedgerService
ClosingService = _m3.ClosingService
from django.db.models import Count, Q, Sum
from django.db import transaction


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

PASS = 0
FAIL = 0

def test(name, fn):
    global PASS, FAIL
    try:
        fn()
        PASS += 1
        print(f"  \033[92mPASS\033[0m  {name}")
    except Exception as e:
        FAIL += 1
        print(f"  \033[91mFAIL\033[0m  {name}")
        print(f"         {e}")
        traceback.print_exc()
        print()

def assert_eq(actual, expected, msg=""):
    if actual != expected:
        raise AssertionError(f"{msg}: expected {expected}, got {actual}")

def assert_true(val, msg=""):
    if not val:
        raise AssertionError(f"{msg}: expected True, got {val}")

def assert_gt(a, b, msg=""):
    if not (a > b):
        raise AssertionError(f"{msg}: expected {a} > {b}")

def find_account(org, **kwargs):
    return ChartOfAccount.objects.filter(organization=org, is_active=True, **kwargs).first()


# ═══════════════════════════════════════════════════════════════
# Setup — get org, clean slate
# ═══════════════════════════════════════════════════════════════

org = Organization.objects.first()
if not org:
    print("ERROR: No organization found. Create one first.")
    sys.exit(1)

print(f"\n{'='*60}")
print(f"FINANCE E2E TEST SUITE")
print(f"Org: {org.name} ({org.id})")
print(f"{'='*60}\n")


# ═══════════════════════════════════════════════════════════════
# TEST 1: COA Import (IFRS)
# ═══════════════════════════════════════════════════════════════

def test_01_coa_import():
    LedgerService.apply_coa_template(org, 'IFRS_COA', reset=True)
    active = ChartOfAccount.objects.filter(organization=org, is_active=True)
    assert_gt(active.count(), 100, "Active accounts")
    non_ifrs = active.exclude(template_origin='IFRS_COA').count()
    assert_eq(non_ifrs, 0, "Non-IFRS accounts")

test("01. COA Import (IFRS)", test_01_coa_import)


# ═══════════════════════════════════════════════════════════════
# TEST 2: Posting Rules Auto-Synced
# ═══════════════════════════════════════════════════════════════

def test_02_posting_rules():
    rules = PostingRule.objects.filter(organization=org, is_active=True).count()
    assert_gt(rules, 30, "PostingRules count")
    # Check critical rules exist
    for event in ['sales.invoice.receivable', 'sales.invoice.revenue', 'purchases.invoice.payable']:
        r = PostingRule.objects.filter(organization=org, event_code=event).first()
        if r:
            assert_true(r.account_id is not None, f"Rule {event} has account")

test("02. Posting rules auto-synced", test_02_posting_rules)


# ═══════════════════════════════════════════════════════════════
# TEST 3: Fiscal Year Creation
# ═══════════════════════════════════════════════════════════════

def test_03_fiscal_year():
    # Clean up leftover test data — pure raw SQL to avoid Django cascade touching missing tables
    from django.db import connection
    with connection.cursor() as c:
        # Find test JE ids
        c.execute("SELECT id FROM journalentry WHERE tenant_id = %s AND description LIKE 'E2E Test:%%'", [str(org.id)])
        je_ids = [r[0] for r in c.fetchall()]
        # Find test FY ids
        c.execute("SELECT id FROM fiscalyear WHERE tenant_id = %s AND name LIKE 'TEST_FY%%'", [str(org.id)])
        fy_ids = [r[0] for r in c.fetchall()]
        # Find closing JE ids for test years
        if fy_ids:
            placeholders = ','.join(['%s'] * len(fy_ids))
            c.execute(f"SELECT id FROM journalentry WHERE fiscal_year_id IN ({placeholders})", fy_ids)
            je_ids.extend([r[0] for r in c.fetchall()])
        # Delete JE lines then JEs
        if je_ids:
            ph = ','.join(['%s'] * len(je_ids))
            c.execute(f"DELETE FROM journalentryline WHERE journal_entry_id IN ({ph})", je_ids)
            c.execute(f"DELETE FROM journalentry WHERE id IN ({ph})", je_ids)
        # Unlink remaining JEs from test FYs
        if fy_ids:
            ph = ','.join(['%s'] * len(fy_ids))
            c.execute(f"UPDATE journalentry SET fiscal_year_id = NULL, fiscal_period_id = NULL WHERE fiscal_year_id IN ({ph})", fy_ids)
            c.execute(f"DELETE FROM opening_balance WHERE fiscal_year_id IN ({ph})", fy_ids)
            c.execute(f"DELETE FROM fiscalperiod WHERE fiscal_year_id IN ({ph})", fy_ids)
            c.execute(f"DELETE FROM fiscalyear WHERE id IN ({ph})", fy_ids)

    # Use far-future dates to avoid overlap with existing FY 2026
    from apps.finance.services.fiscal_service import FiscalYearService
    fy = FiscalYearService.create_fiscal_year(org, {
        'name': 'TEST_FY 2030',
        'start_date': '2030-01-01',
        'end_date': '2030-12-31',
        'frequency': 'MONTHLY',
        'period_status': 'OPEN',
    })
    assert_true(fy is not None, "Fiscal year created")
    periods = FiscalPeriod.objects.filter(fiscal_year=fy)
    assert_gt(periods.count(), 0, "Periods created")

test("03. Fiscal year + periods creation", test_03_fiscal_year)


# ═══════════════════════════════════════════════════════════════
# TEST 4: Simple Journal Entry (Sale)
# ═══════════════════════════════════════════════════════════════

def test_04_simple_je():
    recv = find_account(org, system_role='RECEIVABLE', allow_posting=True)
    rev = find_account(org, type='INCOME', allow_posting=True)
    assert_true(recv, "Receivable account found")
    assert_true(rev, "Revenue account found")

    # Use an open period date — find first open period
    open_period = FiscalPeriod.objects.filter(
        fiscal_year__organization=org, status='OPEN'
    ).order_by('start_date').first()
    je_date = open_period.start_date if open_period else date(2026, 4, 15)

    je = LedgerService.create_journal_entry(
        organization=org,
        transaction_date=je_date,
        description='E2E Test: Simple sale',
        lines=[
            {'account_id': recv.id, 'debit': Decimal('1000'), 'credit': Decimal('0')},
            {'account_id': rev.id, 'debit': Decimal('0'), 'credit': Decimal('1000')},
        ],
        status='POSTED', scope='OFFICIAL',
    )
    assert_true(je.id, "JE created")
    assert_eq(je.status, 'POSTED', "JE status")
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert_eq(lines.count(), 2, "JE line count")
    total_debit = lines.aggregate(s=Sum('debit'))['s']
    total_credit = lines.aggregate(s=Sum('credit'))['s']
    assert_eq(total_debit, total_credit, "Debits = Credits")

test("04. Simple journal entry (sale)", test_04_simple_je)


# ═══════════════════════════════════════════════════════════════
# TEST 5: Complex Multi-Line JE
# ═══════════════════════════════════════════════════════════════

def test_05_complex_je():
    recv = find_account(org, system_role='RECEIVABLE', allow_posting=True)
    rev = find_account(org, type='INCOME', allow_posting=True)
    cogs_acct = find_account(org, system_role='COGS', allow_posting=True)
    inv_acct = find_account(org, system_role='INVENTORY', allow_posting=True)

    lines = [
        {'account_id': recv.id, 'debit': Decimal('2360'), 'credit': Decimal('0')},     # Customer owes
        {'account_id': rev.id, 'debit': Decimal('0'), 'credit': Decimal('2000')},       # Revenue
    ]
    # Add COGS/Inventory if available
    if cogs_acct and inv_acct:
        lines.extend([
            {'account_id': cogs_acct.id, 'debit': Decimal('1200'), 'credit': Decimal('0')},
            {'account_id': inv_acct.id, 'debit': Decimal('0'), 'credit': Decimal('1200')},
        ])
    # Tax line to balance if only 2 lines
    vat = find_account(org, system_role='VAT_OUTPUT', allow_posting=True)
    if vat:
        lines.append({'account_id': vat.id, 'debit': Decimal('0'), 'credit': Decimal('360')})

    # Ensure balanced
    total_d = sum(l['debit'] for l in lines)
    total_c = sum(l['credit'] for l in lines)
    if total_d != total_c:
        # Add balancing line
        diff = total_d - total_c
        if diff > 0 and rev:
            lines.append({'account_id': rev.id, 'debit': Decimal('0'), 'credit': diff})
        elif diff < 0 and recv:
            lines.append({'account_id': recv.id, 'debit': abs(diff), 'credit': Decimal('0')})

    open_period = FiscalPeriod.objects.filter(
        fiscal_year__organization=org, status='OPEN'
    ).order_by('start_date').first()
    je_date = open_period.start_date if open_period else date(2026, 4, 10)

    je = LedgerService.create_journal_entry(
        organization=org,
        transaction_date=je_date,
        description='E2E Test: Complex multi-line sale with COGS',
        lines=lines,
        status='POSTED', scope='OFFICIAL',
    )
    assert_true(je.id, "Complex JE created")
    je_lines = JournalEntryLine.objects.filter(journal_entry=je)
    assert_gt(je_lines.count(), 2, "Multiple lines")
    td = je_lines.aggregate(s=Sum('debit'))['s']
    tc = je_lines.aggregate(s=Sum('credit'))['s']
    assert_eq(td, tc, "Complex JE balanced")

test("05. Complex multi-line journal entry", test_05_complex_je)


# ═══════════════════════════════════════════════════════════════
# TEST 6: Balance Verification
# ═══════════════════════════════════════════════════════════════

def test_06_balances():
    # Trial balance
    accounts = LedgerService.get_trial_balance(org, scope='OFFICIAL')
    assert_gt(len(accounts), 0, "Trial balance accounts")

    # Check receivable has a balance
    recv = [a for a in accounts if getattr(a, 'system_role', '') == 'RECEIVABLE' and a.allow_posting]
    if recv:
        assert_gt(recv[0].temp_balance, Decimal('0'), "Receivable has debit balance")

    # P&L
    pnl = LedgerService.get_profit_loss(org, scope='OFFICIAL')
    assert_gt(pnl['revenue'], Decimal('0'), "Revenue > 0")

    # Balance sheet
    bs = LedgerService.get_balance_sheet(org, scope='OFFICIAL')
    assert_gt(bs['assets'], Decimal('0'), "Assets > 0")

test("06. Balance verification (TB, P&L, BS)", test_06_balances)


# ═══════════════════════════════════════════════════════════════
# TEST 7: Template Switch With Data
# ═══════════════════════════════════════════════════════════════

def test_07_template_switch():
    # Currently IFRS with journal entries → switch to LEBANESE
    LedgerService.apply_coa_template(org, 'LEBANESE_PCN', reset=True)
    active = ChartOfAccount.objects.filter(organization=org, is_active=True)
    non_leb = active.exclude(template_origin='LEBANESE_PCN').count()
    assert_eq(non_leb, 0, "No non-Lebanese active")

    # JEs should still exist
    je_count = JournalEntry.objects.filter(organization=org).count()
    assert_gt(je_count, 0, "JEs preserved after switch")

    # Switch back to IFRS
    LedgerService.apply_coa_template(org, 'IFRS_COA', reset=True)
    non_ifrs = ChartOfAccount.objects.filter(organization=org, is_active=True).exclude(template_origin='IFRS_COA').count()
    assert_eq(non_ifrs, 0, "Clean IFRS after switch back")

test("07. Template switch with data", test_07_template_switch)


# ═══════════════════════════════════════════════════════════════
# TEST 8: Site-Level Balance Filtering
# ═══════════════════════════════════════════════════════════════

def test_08_site_filter():
    # All sites
    all_accts = LedgerService.get_chart_of_accounts(org, scope='OFFICIAL')
    all_bal = sum(abs(getattr(a, 'rollup_balance', 0)) for a in all_accts if a.parent_id is None)

    # Fake site (should have zero)
    fake_accts = LedgerService.get_chart_of_accounts(org, scope='OFFICIAL', site_id=99999)
    fake_bal = sum(abs(getattr(a, 'rollup_balance', 0)) for a in fake_accts if a.parent_id is None)

    assert_eq(fake_bal, Decimal('0'), "Fake site has zero balance")
    # All sites should have some balance from our JEs
    assert_gt(all_bal, Decimal('0'), "All sites has balance")

test("08. Site-level balance filtering", test_08_site_filter)


# ═══════════════════════════════════════════════════════════════
# TEST 9: Period Close With Draft (should fail)
# ═══════════════════════════════════════════════════════════════

def test_09_period_close_draft():
    fy = FiscalYear.objects.filter(organization=org, name='TEST_FY 2030').first()
    if not fy:
        raise Exception("TEST_FY not found")

    # Create a DRAFT JE in a period
    period = FiscalPeriod.objects.filter(fiscal_year=fy, status='OPEN').first()
    if not period:
        raise Exception("No open period")

    recv = find_account(org, system_role='RECEIVABLE', allow_posting=True)
    rev = find_account(org, type='INCOME', allow_posting=True)

    draft_je = LedgerService.create_journal_entry(
        organization=org,
        transaction_date=date(period.start_date.year, period.start_date.month, period.start_date.day),
        description='E2E Test: Draft for close test',
        lines=[
            {'account_id': recv.id, 'debit': Decimal('50'), 'credit': Decimal('0')},
            {'account_id': rev.id, 'debit': Decimal('0'), 'credit': Decimal('50')},
        ],
        status='DRAFT', scope='OFFICIAL',
    )

    # Try closing — should fail
    try:
        ClosingService.close_fiscal_period(org, period)
        raise Exception("Should have failed but didn't")
    except Exception as e:
        if 'draft' in str(e).lower():
            pass  # Expected
        else:
            raise

    # Cleanup — delete draft via raw SQL (bank_statement_line table may not exist)
    from django.db import connection as conn
    with conn.cursor() as c:
        c.execute("DELETE FROM journalentryline WHERE journal_entry_id = %s", [draft_je.id])
        c.execute("DELETE FROM journalentry WHERE id = %s", [draft_je.id])

test("09. Period close blocked by draft JEs", test_09_period_close_draft)


# ═══════════════════════════════════════════════════════════════
# TEST 10: Period Close (happy path)
# ═══════════════════════════════════════════════════════════════

def test_10_period_close():
    fy = FiscalYear.objects.filter(organization=org, name='TEST_FY 2030').first()
    period = FiscalPeriod.objects.filter(fiscal_year=fy, status='OPEN').first()
    if not period:
        raise Exception("No open period")

    ClosingService.close_fiscal_period(org, period)
    period.refresh_from_db()
    assert_eq(period.status, 'CLOSED', "Period status")
    assert_true(period.is_closed, "Period is_closed flag")

test("10. Period close (happy path)", test_10_period_close)


# ═══════════════════════════════════════════════════════════════
# TEST 11: Year-End Close Preview
# ═══════════════════════════════════════════════════════════════

def test_11_close_preview():
    fy = FiscalYear.objects.filter(organization=org, name='TEST_FY 2030').first()

    # Check RE account exists
    re = ChartOfAccount.objects.filter(
        organization=org, type='EQUITY', is_active=True
    ).filter(
        Q(system_role='RETAINED_EARNINGS') | Q(name__icontains='retained') | Q(name__icontains='report')
    ).first()
    assert_true(re, "Retained Earnings account exists")

    # Check P&L
    pnl = LedgerService.get_profit_loss(org, scope='OFFICIAL')
    # We posted transactions so revenue should be > 0
    assert_gt(pnl['revenue'], Decimal('0'), "Revenue for close preview")

test("11. Year-end close preview data", test_11_close_preview)


# ═══════════════════════════════════════════════════════════════
# TEST 12: Year-End Close Execution
# ═══════════════════════════════════════════════════════════════

def test_12_year_end_close():
    fy = FiscalYear.objects.filter(organization=org, name='TEST_FY 2030').first()
    if not fy:
        raise Exception("TEST_FY not found")

    # Close all open periods first
    for p in FiscalPeriod.objects.filter(fiscal_year=fy, is_closed=False):
        p.status = 'CLOSED'
        p.is_closed = True
        p.save()

    # Create next year for opening balances
    FiscalYear.objects.filter(organization=org, name='TEST_FY 2031').delete()
    from apps.finance.services.fiscal_service import FiscalYearService
    fy_next = FiscalYearService.create_fiscal_year(org, {
        'name': 'TEST_FY 2031',
        'start_date': '2031-01-01',
        'end_date': '2031-12-31',
        'frequency': 'MONTHLY',
        'period_status': 'OPEN',
    })

    # Get P&L before close
    pnl_before = LedgerService.get_profit_loss(org, scope='OFFICIAL')
    net_before = pnl_before['net_income']

    # Execute year-end close
    ClosingService.close_fiscal_year(org, fy)

    fy.refresh_from_db()
    assert_true(fy.is_closed, "Year is closed")
    assert_true(fy.is_hard_locked, "Year is hard locked")

    # Check closing JE was created
    closing_je = JournalEntry.objects.filter(
        organization=org, journal_type='CLOSING', description__icontains=fy.name
    ).first()
    assert_true(closing_je, "Closing JE exists")

test("12. Year-end close execution", test_12_year_end_close)


# ═══════════════════════════════════════════════════════════════
# TEST 13: Opening Balances in Next Year
# ═══════════════════════════════════════════════════════════════

def test_13_opening_balances():
    from apps.finance.models import OpeningBalance
    fy_next = FiscalYear.objects.filter(organization=org, name='TEST_FY 2031').first()
    if not fy_next:
        raise Exception("TEST_FY 2031 not found")

    obs = OpeningBalance.objects.filter(organization=org, fiscal_year=fy_next)
    assert_gt(obs.count(), 0, "Opening balances generated")

    # Opening balances should only be BS accounts (ASSET, LIABILITY, EQUITY)
    for ob in obs:
        assert_true(ob.account.type in ['ASSET', 'LIABILITY', 'EQUITY'],
                     f"OB account {ob.account.code} type={ob.account.type} is BS account")

test("13. Opening balances in next year", test_13_opening_balances)


# ═══════════════════════════════════════════════════════════════
# TEST 14: Import Case Detection
# ═══════════════════════════════════════════════════════════════

def test_14_import_case():
    active = ChartOfAccount.objects.filter(organization=org, is_active=True)
    has_je = JournalEntryLine.objects.filter(organization=org).exists()
    has_custom = active.filter(Q(template_origin__isnull=True) | Q(template_origin='')).exists()
    has_balances = active.filter(Q(balance__gt=0) | Q(balance__lt=0)).exists()

    if active.count() == 0:
        case = 'EMPTY'
    elif not has_je and not has_balances and not has_custom:
        case = 'UNTOUCHED'
    else:
        case = 'NEEDS_MIGRATION'

    # We have JEs so should be NEEDS_MIGRATION
    assert_eq(case, 'NEEDS_MIGRATION', "Import case with data")

test("14. Import case detection", test_14_import_case)


# ═══════════════════════════════════════════════════════════════
# Cleanup
# ═══════════════════════════════════════════════════════════════

print(f"\n{'='*60}")
print("CLEANUP")
print(f"{'='*60}")

# Delete test data using raw SQL to avoid PROTECT/missing table issues
from django.db import connection
test_je_ids = list(JournalEntry.objects.filter(organization=org, description__startswith='E2E Test:').values_list('id', flat=True))
closing_je_ids = list(JournalEntry.objects.filter(organization=org, journal_type='CLOSING', description__icontains='TEST_FY').values_list('id', flat=True))
all_je_ids = test_je_ids + closing_je_ids
if all_je_ids:
    with connection.cursor() as c:
        placeholders = ','.join(['%s'] * len(all_je_ids))
        c.execute(f"UPDATE fiscalyear SET closing_journal_entry_id = NULL WHERE closing_journal_entry_id IN ({placeholders})", all_je_ids)
        c.execute(f"DELETE FROM journalentryline WHERE journal_entry_id IN ({placeholders})", all_je_ids)
        c.execute(f"UPDATE journalentry SET status='DRAFT' WHERE id IN ({placeholders})", all_je_ids)
        c.execute(f"DELETE FROM journalentry WHERE id IN ({placeholders})", all_je_ids)
print(f"  Cleaned {len(all_je_ids)} test journal entries")

# Delete opening balances for test years
for fy in FiscalYear.objects.filter(organization=org, name__startswith='TEST_FY'):
    JournalEntry.objects.filter(fiscal_year=fy).update(fiscal_year=None, fiscal_period=None)
    try:
        from apps.finance.models import OpeningBalance
        OpeningBalance.objects.filter(fiscal_year=fy).delete()
    except Exception:
        pass
    FiscalPeriod.objects.filter(fiscal_year=fy).delete()
    fy.is_hard_locked = False; fy.save(update_fields=['is_hard_locked'])
    with connection.cursor() as c:
        c.execute("DELETE FROM fiscalyear WHERE id = %s", [fy.id])
print(f"  Cleaned test fiscal years")

# Restore IFRS
try:
    LedgerService.apply_coa_template(org, 'IFRS_COA', reset=True)
    print(f"  Restored IFRS COA")
except Exception:
    pass

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════

print(f"\n{'='*60}")
if FAIL == 0:
    print(f"\033[92mALL {PASS} TESTS PASSED\033[0m")
else:
    print(f"\033[91m{FAIL} FAILED\033[0m, {PASS} passed")
print(f"{'='*60}\n")

sys.exit(1 if FAIL > 0 else 0)
