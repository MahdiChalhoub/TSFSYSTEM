import os
import django
import sys
from decimal import Decimal
from django.utils import timezone

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import (
    Organization, Product, Site, Warehouse, Order, OrderLine, 
    ChartOfAccount, FinancialAccount, User
)
from erp.services import (
    ProvisioningService, PurchaseService, POSService, LedgerService, ConfigurationService
)

import uuid

def run_readiness_test():
    print("--- STARTING SYSTEM READINESS VERIFICATION ---")
    
    # 1. Provisioning
    slug = f"test-{uuid.uuid4().hex[:8]}"
    print(f"1. Provisioning Organization: {slug}")
    # Cleanup if exists
    # Organization.objects.filter(slug=slug).delete()
    org = ProvisioningService.provision_organization(name="Readiness Test Org", slug=slug)
    
    # 2. Setup Data
    site = Site.objects.filter(organization=org).first()
    warehouse = Warehouse.objects.filter(organization=org, site=site).first()
    
    # Create a Product
    print("2. Creating Test Product: 'High-End Fragrance'")
    product = Product.objects.create(
        organization=org,
        name="High-End Fragrance",
        sku="FRG-HE-001",
        barcode="1234567890",
        cost_price=Decimal('0.00'),
        cost_price_ht=Decimal('0.00'),
        selling_price_ht=Decimal('500.00'),
        selling_price_ttc=Decimal('555.00'),
        tva_rate=Decimal('0.11'),
        is_expiry_tracked=False,
        min_stock_level=10,
        status='ACTIVE',
        is_active=True
    )
    
    # 3. Procurement Workflow (The Three-Way Match)
    print("3. Executing Procurement Workflow")
    # A. Create PO
    user = User.objects.filter(organization=org, is_staff=True).first()
    if not user:
        # Create a dummy staff user for testing
        user = User.objects.create(username=f"staff_{slug}", organization=org, is_staff=True)

    order = Order.objects.create(
        organization=org,
        type='PURCHASE',
        status='DRAFT',
        user=user,
        site=site,
        total_amount=Decimal('1000.00'),
        tax_amount=Decimal('0.00'),
        is_verified=False,
        is_locked=False
    )
    OrderLine.objects.create(
        organization=org,
        order=order,
        product=product,
        quantity=Decimal('10.00'),
        unit_price=Decimal('100.00'),
        tax_rate=Decimal('0.00'),
        total=Decimal('1000.00'),
        unit_cost_ht=Decimal('100.00'),
        effective_cost=Decimal('100.00')
    )
    
    # B. Authorize
    print("   - Authorizing PO")
    PurchaseService.authorize_po(org, order.id)
    
    # C. Receive (Physical & Suspense Liability)
    print("   - Receiving Goods (Dr Inventory / Cr Accrued Reception)")
    PurchaseService.receive_po(org, order.id, warehouse.id)
    
    # D. Invoice (Clear Suspense & Establish AP)
    print("   - Invoicing PO (Dr Accrued Reception / Cr Accouts Payable)")
    unique_inv = f"INV-{slug}"
    PurchaseService.invoice_po(org, order.id, invoice_number=unique_inv)
    
    # Verify Stock level
    from erp.models import Inventory
    stock = Inventory.objects.get(organization=org, product=product, warehouse=warehouse).quantity
    print(f"   - Verified Stock level: {stock} units")
    
    # 4. Sales Workflow (POS Checkout)
    print("4. Executing Point of Sale Workflow")
    cash_acc = FinancialAccount.objects.get(organization=org, name="Cash Drawer")
    
    items = [
        {'product_id': product.id, 'quantity': 2, 'unit_price': 500.00}
    ]
    
    # Checkout
    print("   - Checking out 2 units via POS (Total: $1110.00 incl. tax)")
    POSService.checkout(
        organization=org,
        user=user,
        warehouse=warehouse,
        payment_account_id=cash_acc.id,
        items=items
    )
    
    # Verify stock reduction
    stock = Inventory.objects.get(organization=org, product=product, warehouse=warehouse).quantity
    print(f"   - Verified Stock level after sale: {stock} units")
    
    # 5. Financial Reporting Verification
    print("5. Verifying Financial Integrity")
    
    # Check Trial Balance
    accounts = LedgerService.get_trial_balance(org, scope='INTERNAL')
    
    # Expectations:
    # 1. Cash Drawer: +$1110.00 (Sale Revenue + Tax)
    # 2. Accounts Payable: -$1000.00 (Purchased 10 units at $100 each)
    # 3. Inventory: +$1000 (Reception) - $200 (COGS for 2 units) = $800.00
    # 4. Revenue: -$1000.00 (Internal) (Prices are HT in the posting logic)
    # 5. COGS: +$200.00
    # 6. VAT Payable: -$110.00 (From Sale)
    
    print("\n--- Ledger Balances ---")
    for acc in accounts:
        if abs(acc.temp_balance) > 0 or acc.parent is None:
            print(f"  [{acc.code}] {acc.name} (Type: {acc.type}, Parent: {acc.parent_id}): balance=${acc.temp_balance}, rollup=${acc.rollup_balance}")

    # Check Balance Sheet Integrity
    bs = LedgerService.get_balance_sheet(org, scope='INTERNAL')
    print(f"\n--- Balance Sheet Verification ---")
    print(f"  Assets (Sum of Roots): ${bs['assets']}")
    print(f"  Liabilities (Sum of Roots, Abs): ${bs['liabilities']}")
    print(f"  Equity (Sum of Roots, Abs): ${bs['equity']}")
    print(f"  Current Earnings: ${bs['current_earnings']}")
    print(f"  Calculated L+E+Earnings: ${bs['total_liabilities_and_equity']}")
    print(f"  Difference: {bs['assets'] - bs['total_liabilities_and_equity']}")
    print(f"  Balanced: {bs['is_balanced']}")
    
    if not bs['is_balanced']:
        print("!!! ERROR: BALANCE SHEET IS NOT BALANCED !!!")
        sys.exit(1)
        
    pl = LedgerService.get_profit_loss(org, scope='INTERNAL')
    print(f"\n--- Profit & Loss Verification ---")
    print(f"  Revenue: ${pl['revenue']}")
    print(f"  Expenses (COGS): ${pl['expenses']}")
    print(f"  Net Income: ${pl['net_income']}")
    
    # Expected Net Income: $1000 (Revenue) - $200 (COGS) = $800
    if abs(pl['net_income'] - Decimal('800.00')) > 0.01:
        print(f"!!! ERROR: Net Income mismatch. Expected $800.00, got ${pl['net_income']}")
        sys.exit(1)

    print("\n--- SYSTEM READINESS VERIFIED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_readiness_test()
