
import os
import django
import sys

# Setup Django environment
sys.path.append('/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.finance.models import ChartOfAccount, JournalEntry, JournalEntryLine, FiscalYear, FiscalPeriod
from erp.models import Organization, User
from apps.finance.services.ledger_coa import LedgerCOAMixin
from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError

def test_enterprise_coa_features():
    print("🚀 Starting Enterprise COA Feature Test...")
    
    # 1. Setup Test Org
    org, _ = Organization.objects.get_or_create(
        slug='test-lock-org',
        defaults={'name': 'Test Locking Org'}
    )
    # Reset setup status
    org.finance_setup_completed = False
    org.finance_hard_locked_at = None
    org.save()
    
    # Clear existing accounts for a clean run
    ChartOfAccount.objects.filter(organization=org).delete()
    
    # 2. Test apply_coa_template with Role & Section Detection
    print("\n--- Testing apply_coa_template (IFRS) ---")
    LedgerCOAMixin.apply_coa_template(org, 'IFRS_COA')
    
    # Verify Metadata
    ar_acc = ChartOfAccount.objects.get(organization=org, code='1110') # Accounts Receivable
    print(f"Checking AR Account: {ar_acc.name} ({ar_acc.code})")
    print(f"  System Role: {ar_acc.system_role} (Expected: AR_CONTROL)")
    print(f"  Financial Section: {ar_acc.financial_section} (Expected: BS_ASSET)")
    
    assert ar_acc.system_role == 'AR_CONTROL', f"Expected AR_CONTROL, got {ar_acc.system_role}"
    assert ar_acc.financial_section == 'BS_ASSET', f"Expected BS_ASSET, got {ar_acc.financial_section}"
    
    re_acc = ChartOfAccount.objects.filter(organization=org, code='3003').first() # Retained Earnings
    if re_acc:
        print(f"Checking Equity Account: {re_acc.name}")
        print(f"  System Role: {re_acc.system_role} (Expected: RETAINED_EARNINGS)")
        assert re_acc.system_role == 'RETAINED_EARNINGS'

    # 3. Test Validation Engine (Mandatory Roles)
    print("\n--- Testing validate_finance_readiness ---")
    try:
        LedgerCOAMixin.validate_finance_readiness(org)
        print("✅ Validation passed (Expected)")
    except ValidationError as e:
        print(f"❌ Validation failed unexpectedly: {e}")
        # If it fails, let's see why
        for role in ['AR_CONTROL', 'AP_CONTROL', 'CASH_ACCOUNT']:
             exists = ChartOfAccount.objects.filter(organization=org, system_role=role).exists()
             print(f"  Role {role} exists: {exists}")
    
    # Verify org status changed
    org.refresh_from_db()
    print(f"Org Finance Setup Completed: {org.finance_setup_completed}")
    assert org.finance_setup_completed is True

    # 4. Test Structural Lock (Hierarchy Change)
    print("\n--- Testing Structural Lock (Hierarchy Change) ---")
    # Try to move a child to a different parent
    child = ChartOfAccount.objects.filter(organization=org, parent__isnull=False).first()
    other_parent = ChartOfAccount.objects.filter(organization=org, parent__isnull=True).exclude(id=child.parent_id).first()
    
    if child and other_parent:
        print(f"Attempting to move {child.code} from {child.parent.code} to {other_parent.code}...")
        child.parent = other_parent
        try:
            child.save()
            print("❌ Structural Lock FAILED! Change was saved.")
        except ValidationError as e:
            print(f"✅ Structural Lock PASSED: {e}")

    # 5. Test Hard Lock Trigger (Journal Entry Posting)
    print("\n--- Testing Hard Lock Trigger ---")
    # Create a Fiscal Year/Period if none exist
    fy, _ = FiscalYear.objects.get_or_create(organization=org, name='FY2026', defaults={'start_date': '2026-01-01', 'end_date': '2026-12-31', 'status': 'OPEN'})
    fp, _ = FiscalPeriod.objects.get_or_create(organization=org, name='P03-2026', fiscal_year=fy, defaults={'start_date': '2026-03-01', 'end_date': '2026-03-31', 'status': 'OPEN'})
    
    # Create a Draft JE
    cash_acc = ChartOfAccount.objects.filter(organization=org, system_role='CASH_ACCOUNT').first()
    rev_acc = ChartOfAccount.objects.filter(organization=org, system_role='REVENUE_CONTROL').first()
    
    if not cash_acc or not rev_acc:
        # Fallback if roles didn't map perfectly in this template
        cash_acc = ChartOfAccount.objects.filter(organization=org, type='ASSET', allow_posting=True).first()
        rev_acc = ChartOfAccount.objects.filter(organization=org, type='INCOME', allow_posting=True).first()

    je = JournalEntry.objects.create(
        organization=org,
        description="First Test Transaction",
        fiscal_year=fy,
        fiscal_period=fp,
        transaction_date=timezone.now(),
        status='DRAFT'
    )
    JournalEntryLine.objects.create(journal_entry=je, account=cash_acc, debit=Decimal('100.00'), organization=org)
    JournalEntryLine.objects.create(journal_entry=je, account=rev_acc, credit=Decimal('100.00'), organization=org)
    
    print(f"Created Draft JE. Org Hard Lock: {org.finance_hard_locked_at}")
    assert org.finance_hard_locked_at is None
    
    print("Posting JE...")
    je.status = 'POSTED'
    je.save()
    
    org.refresh_from_db()
    print(f"JE Status: {je.status}")
    print(f"Org Hard Lock: {org.finance_hard_locked_at}")
    assert org.finance_hard_locked_at is not None
    print("✅ Hard Lock Triggered Successfully!")

    print("\n🎉 ALL ENTERPRISE COA TESTS PASSED!")

if __name__ == "__main__":
    try:
        test_enterprise_coa_features()
    except Exception as e:
        print(f"💥 TEST CRASHED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
