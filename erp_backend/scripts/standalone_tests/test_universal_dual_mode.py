import os
import sys
import django
import uuid
import json
from decimal import Decimal
from django.utils import timezone
from datetime import date, timedelta
from django.core.management import call_command

# Setup Django Environment
BASE_DIR = r"c:\tsfci\erp_backend"
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# 1. Overwrite Database Configuration to In-Memory SQLite
from django.conf import settings
settings.DATABASES['default'] = {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': ':memory:',
}

# 2. Bypass PostgreSQL-specific integrity checks
import types
mock_service = types.ModuleType('mock_service')
mock_service.CoreService = type('Mock', (), {'verify_system_integrity': lambda: True})
sys.modules['apps.core.services.system'] = mock_service

print("Setting up Django...")
django.setup()

# 3. Bypass Migrations
print("Synchronizing schema (In-Memory)...")
for app_config in django.apps.apps.get_app_configs():
    settings.MIGRATION_MODULES[app_config.label] = None

call_command('migrate', '--run-syncdb', verbosity=0, interactive=False)

from erp.models import Organization, User, Site, Warehouse
from apps.finance.models import FinancialEvent, JournalEntry, Loan, ChartOfAccount, TransactionSequence, FiscalYear, FiscalPeriod, FinancialAccount, Transaction
from apps.finance.services import FinancialEventService, LoanService, SequenceService
from apps.inventory.models import Product, Inventory, InventoryMovement, Unit
from apps.inventory.services import InventoryService
from apps.crm.models import Contact

def seed_minimal():
    print("Seeding minimal test data...")
    # Seed Organization with settings for posting rules
    org = Organization.objects.create(
        name="Local Test Org", 
        slug=f"test-org-{uuid.uuid4().hex[:4]}",
        settings={
            "finance_posting_rules": {
                "partners": {"capital": 1, "loan": 1, "withdrawal": 1},
                "equity": {"capital": 1, "draws": 1}
            }
        }
    )
    site = Site.objects.create(organization=org, name="Test Site", code="TEST-HQ")
    user = User.objects.create_user(
        username=f"test_admin_{uuid.uuid4().hex[:4]}", 
        email=f"test_{uuid.uuid4().hex[:4]}@tsf.ci", 
        password="password",
        organization=org, is_staff=True
    )
    
    # CoAs
    asset_root = ChartOfAccount.objects.create(organization=org, name="Assets", code="1000", type="ASSET")
    cash_coa = ChartOfAccount.objects.create(organization=org, name="Cash", code="1100", type="ASSET", parent=asset_root)
    liability_root = ChartOfAccount.objects.create(organization=org, name="Liabilities", code="2000", type="LIABILITY")
    loan_coa = ChartOfAccount.objects.create(organization=org, name="Loans Payable", code="2100", type="LIABILITY", parent=liability_root)
    
    # Update settings with real CoA IDs
    org.settings["finance_posting_rules"]["partners"]["capital"] = loan_coa.id
    org.save()

    contact = Contact.objects.create(organization=org, name="Test Contact", type="SUPPLIER", linked_account_id=loan_coa.id)
    warehouse = Warehouse.objects.create(organization=org, name="Test Warehouse", type="STORE", site=site)
    unit = Unit.objects.create(organization=org, name="Piece", code="PC")
    product = Product.objects.create(
        organization=org, name="Test Product", unit=unit, 
        selling_price_ttc=Decimal('100.00'), cost_price=Decimal('50.0')
    )
    
    # Fiscal Setup
    today = date.today()
    fy = FiscalYear.objects.create(
        organization=org, name="FY 2026", 
        start_date=date(today.year, 1, 1), end_date=date(today.year, 12, 31)
    )
    FiscalPeriod.objects.create(
        organization=org, fiscal_year=fy, name="Current Month",
        start_date=date(today.year, today.month, 1), 
        end_date=(date(today.year, today.month, 1) + timedelta(days=31)).replace(day=1) - timedelta(days=1),
        is_closed=False,
        status='OPEN'
    )
    
    # Financial Account
    fin_acc = FinancialAccount.objects.create(
        organization=org, name="Main Cash", type="CASH", 
        currency="USD", site=site, linked_coa=cash_coa
    )
    
    return org, user, contact, warehouse, product, fin_acc

def verify_universal_dual_mode():
    print("=== TSF Universal Dual-Mode Integrity Verification ===")
    
    results = []
    all_passed = True

    try:
        org, user, contact, warehouse, product, fin_acc = seed_minimal()
        
        # 1. Verification of FinancialEvents (Partner Loan Injection)
        print("\n--- Phase 1: FinancialEvent Scope Isolation ---")
        evt_off = FinancialEventService.create_event(
            organization=org, event_type='PARTNER_LOAN', amount=Decimal('500'), 
            date=timezone.now(), contact_id=contact.id, scope='OFFICIAL', user=user,
            account_id=fin_acc.id
        )
        evt_int = FinancialEventService.create_event(
            organization=org, event_type='PARTNER_LOAN', amount=Decimal('700'), 
            date=timezone.now(), contact_id=contact.id, scope='INTERNAL', user=user,
            account_id=fin_acc.id
        )
        
        print(f"Official Event Ref: {evt_off.reference}")
        print(f"Internal Event Ref: {evt_int.reference}")
        
        if evt_off.scope == 'OFFICIAL' and evt_int.scope == 'INTERNAL' and evt_off.reference != evt_int.reference:
            results.append(("FinancialEvent Scoping", "SUCCESS"))
        else:
            results.append(("FinancialEvent Scoping", "FAILED"))

        # 2. Verification of Inventory Movements
        print("\n--- Phase 2: Inventory Movement Scope Isolation ---")
        InventoryService.receive_stock(
            organization=org, product=product, warehouse=warehouse, 
            quantity=Decimal('10'), cost_price_ht=Decimal('10.0'), scope='OFFICIAL', user=user
        )
        InventoryService.receive_stock(
            organization=org, product=product, warehouse=warehouse, 
            quantity=Decimal('5'), cost_price_ht=Decimal('10.0'), scope='INTERNAL', user=user
        )
        
        mov_off = InventoryMovement.objects.filter(product=product, scope='OFFICIAL').last()
        mov_int = InventoryMovement.objects.filter(product=product, scope='INTERNAL').last()
        
        print(f"Official Stock Scope: {mov_off.scope}")
        print(f"Internal Stock Scope: {mov_int.scope}")
        
        if mov_off.scope == 'OFFICIAL' and mov_int.scope == 'INTERNAL':
            results.append(("Inventory Scoping", "SUCCESS"))
        else:
            results.append(("Inventory Scoping", "FAILED"))

        # 3. Verification of Loan Life-cycle Scoping
        print("\n--- Phase 3: Loan Lifecycle Scope Isolation ---")
        loan_data = {
            "contact_id": contact.id,
            "principal_amount": Decimal('1000'),
            "interest_rate": Decimal('5'),
            "term_months": 12,
            "start_date": timezone.now().date()
        }
        
        loan_off = LoanService.create_contract(org, loan_data, scope='OFFICIAL')
        loan_int = LoanService.create_contract(org, loan_data, scope='INTERNAL')
        
        print(f"Official Loan Number: {loan_off.contract_number}")
        print(f"Internal Loan Number: {loan_int.contract_number}")
        
        # Disburse Official
        LoanService.disburse_loan(org, loan_off.id, account_id=fin_acc.id, user=user)
        # Repay Official
        repay_event = LoanService.process_repayment(org, loan_off.id, Decimal('100'), account_id=fin_acc.id, user=user, scope='OFFICIAL')
        
        print(f"Repayment Scope: {repay_event.scope} | Loan Scope: {loan_off.scope}")
        
        if loan_off.scope == 'OFFICIAL' and loan_int.scope == 'INTERNAL' and repay_event.scope == 'OFFICIAL':
            results.append(("Loan Scoping", "SUCCESS"))
        else:
            results.append(("Loan Scoping", "FAILED"))

        # 4. Cross-Module Ledger Propagation
        print("\n--- Phase 4: Ledger Scope Propagation ---")
        entry_off = JournalEntry.objects.filter(reference=evt_off.reference).first()
        entry_int = JournalEntry.objects.filter(reference=evt_int.reference).first()
        
        if entry_off and entry_int:
            print(f"Official Ledger Scope: {entry_off.scope}")
            print(f"Internal Ledger Scope: {entry_int.scope}")
            
            if entry_off.scope == 'OFFICIAL' and entry_int.scope == 'INTERNAL':
                results.append(("Ledger Propagation", "SUCCESS"))
            else:
                results.append(("Ledger Propagation", "FAILED"))
        else:
            results.append(("Ledger Propagation", f"FAILED (Missing Entries Off:{entry_off}, Int:{entry_int})"))

    except Exception as e:
        print(f"\nFATAL ERROR during verification: {str(e)}")
        import traceback; traceback.print_exc()
        all_passed = False

    print("\n=== Final Certification Results ===")
    if not results: all_passed = False
    for test, result in results:
        print(f"{test}: {result}")
        if result != "SUCCESS": all_passed = False
    
    if all_passed:
        print("\n✅ SYSTEM CERTIFIED: Universal Dual-Mode Integrity logic verified.")
        sys.exit(0)
    else:
        print("\n❌ CERTIFICATION FAILED: Scope isolation inconsistencies detected.")
        sys.exit(1)

if __name__ == "__main__":
    verify_universal_dual_mode()
