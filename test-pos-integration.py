import os
import django
import sys
from decimal import Decimal

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, Product, Warehouse, User, Site, ChartOfAccount, FinancialAccount
from erp.services import ProvisioningService, InventoryService, POSService, LedgerService

def test_pos_integration():
    print("--- Testing Point of Sale (POS) Integration ---")
    
    # 1. Setup Organization
    import uuid
    org_slug = f"pos-test-{uuid.uuid4().hex[:8]}"
    org = ProvisioningService.provision_organization("POS Retail Corp", org_slug)
    
    site = Site.objects.get(organization=org, code="MAIN")
    warehouse = Warehouse.objects.get(organization=org, site=site)
    user = User.objects.create(username=f"clerk_{org_slug}", organization=org)
    
    # Identify Cash Account
    cash_fin = FinancialAccount.objects.filter(organization=org, type='CASH').first()
    cash_ledger_acc_id = cash_fin.ledger_account.id

    # 2. Setup Inventory (10 units @ 50 HT)
    product = Product.objects.create(
        organization=org,
        sku="POS-T-001",
        name="Cola Bottle",
        tva_rate=Decimal('0.10'),
        cost_price=Decimal('0')
    )
    
    print("\n[Step 1]: Pre-loading inventory (10 units @ 50 AMC)")
    InventoryService.receive_stock(
        organization=org,
        product=product,
        warehouse=warehouse,
        quantity=Decimal('10'),
        cost_price_ht=Decimal('50'),
        is_tax_recoverable=True
    )
    product.refresh_from_db()
    assert product.cost_price == Decimal('50.00')

    # 3. POS Checkout (Sell 2 units @ 120 HT each)
    print("[Step 2]: Performing POS Checkout (2 units @ 120 each)")
    # Profit calculation: 
    # Revenue = 120 * 2 = 240
    # COGS = 50 * 2 = 100
    # Expected Profit = 140
    
    items = [
        {'product_id': product.id, 'quantity': 2, 'unit_price': 120}
    ]
    
    order = POSService.checkout(
        organization=org,
        user=user,
        warehouse=warehouse,
        payment_account_id=cash_ledger_acc_id,
        items=items
    )
    
    # 4. Verifications
    print("\n--- Verifications ---")
    
    # A. Inventory Reduction
    from erp.models import Inventory
    inv = Inventory.objects.get(organization=org, product=product, warehouse=warehouse)
    print(f"Stock remaining: {inv.quantity} (Expected: 8)")
    assert inv.quantity == Decimal('8.00')
    
    # B. Profit & Loss Verification (Internal)
    pl = LedgerService.get_profit_loss(org, scope='INTERNAL')
    print(f"Internal Revenue: {pl['revenue']} (Expected: 240)")
    # In our script, Revenue is stored as absolute Credit balance.
    # Price 120 * 2 = 240
    assert pl['revenue'] == Decimal('240.00')
    
    print(f"Internal Expenses (COGS): {pl['expenses']} (Expected: 100)")
    # COGS 50 * 2 = 100
    assert pl['expenses'] == Decimal('100.00')
    
    print(f"Internal Net Income: {pl['net_income']} (Expected: 140)")
    assert pl['net_income'] == Decimal('140.00')

    # C. Cash Account Verification
    cash_ledger_acc = ChartOfAccount.objects.get(id=cash_ledger_acc_id)
    # Cash Total = (2 * 120) * 1.1 = 240 + 24 = 264
    print(f"Cash Account Balance: {cash_ledger_acc.balance} (Expected: 264)")
    assert cash_ledger_acc.balance == Decimal('264.00')

    print("\n✅ POS Integration verified successfully!")

if __name__ == "__main__":
    test_pos_integration()
