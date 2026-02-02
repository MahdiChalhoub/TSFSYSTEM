import os
import django
import sys
from decimal import Decimal

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import (
    Organization, Product, Warehouse, User, Site, 
    ChartOfAccount, FinancialAccount, Order, OrderLine, Contact,
    SystemSettings
)
from erp.services import (
    ProvisioningService, InventoryService, POSService, 
    LedgerService, PurchaseService
)

def test_full_system_readiness():
    print("====================================================")
    print(" READY: END-TO-END SYSTEM READINESS TEST")
    print("====================================================")
    
    # 1. PROVISIONING CHECK
    print("\n[Phase 1]: Provisioning a fresh organization...")
    import uuid
    org_slug = f"ready-test-{uuid.uuid4().hex[:6]}"
    org = ProvisioningService.provision_organization("Enterprise Ready Ltd", org_slug)
    
    # Verify defaults
    site = Site.objects.get(organization=org, code="MAIN")
    warehouse = Warehouse.objects.get(organization=org, site=site)
    cash_fin = FinancialAccount.objects.filter(organization=org, type='CASH').first()
    
    print(f" Provisioning successful. Org: {org_slug}")
    print(f" Default Site/Warehouse/Cash Account created.")
    
    # 2. CONFIGURATION CHECK (Posting Rules)
    print("\n[Phase 2]: Checking Posting Rules...")
    rules = SystemSettings.objects.filter(organization=org, key='finance_posting_rules').first()
    assert rules is not None, "FATAL: Posting rules not initialized!"
    print(" Finance Posting Rules initialized and saved.")

    # 3. PROCUREMENT -> INVENTORY LINK
    print("\n[Phase 3]: Testing Procurement -> Inventory linkage...")
    user = User.objects.create(username=f"admin_{org_slug}", organization=org)
    product = Product.objects.create(
        organization=org,
        sku="SKU-READY-001",
        name="Business Asset #1",
        tva_rate=Decimal('0.10'),
        cost_price=Decimal('0')
    )
    
    # Create PO
    po = Order.objects.create(
        organization=org, type='PURCHASE', status='DRAFT', 
        user=user, site=site, total_amount=Decimal('1000.00')
    )
    OrderLine.objects.create(
        organization=org, order=po, product=product,
        quantity=Decimal('10'), unit_price=Decimal('100'), total=Decimal('1000')
    )
    
    # Authorize & Receive
    PurchaseService.authorize_po(org, po.id)
    PurchaseService.receive_po(org, po.id, warehouse.id)
    
    product.refresh_from_db()
    print(f" Product AMC updated: {product.cost_price}")
    assert product.cost_price == Decimal('100.00'), "AMC Calculation mismatch!"
    
    # 4. SALES -> COGS LINK
    print("\n[Phase 4]: Testing Sales -> COGS linkage...")
    # Sell 5 units @ 200 each (COGS should be 100 per unit, total 500)
    items = [{'product_id': product.id, 'quantity': 5, 'unit_price': 200}]
    
    sale = POSService.checkout(
        organization=org,
        user=user,
        warehouse=warehouse,
        payment_account_id=cash_fin.ledger_account_id,
        items=items
    )
    
    # Verify Inventory
    from erp.models import Inventory
    inv = Inventory.objects.get(organization=org, product=product, warehouse=warehouse)
    print(f" Stock remaining: {inv.quantity} (Expected 5)")
    assert inv.quantity == Decimal('5.00')
    
    # 5. FINANCIAL INTEGRITY (LEDGER VS INVENTORY)
    print("\n[Phase 5]: Verifying Financial Integrity...")
    
    # Total Inventory Value = 5 * 100 = 500
    valuation = InventoryService.get_inventory_valuation(org)
    print(f"   - Inventory Valuation: {valuation['total_value']}")
    
    # Ledger Inventory Account Balance
    inv_acc_id = ConfigurationService.get_posting_rules(org)['sales']['inventory']
    inv_acc = ChartOfAccount.objects.get(id=inv_acc_id)
    print(f"   - Ledger Inventory Balance: {inv_acc.balance}")
    
    assert valuation['total_value'] == inv_acc.balance, "FATAL: Ledger/Inventory Discrepancy detected!"
    print(" Ledger and Physical Inventory are perfectly synced.")

    # 6. REPORTING CHECK (P&L)
    print("\n[Phase 6]: Final P&L Verification...")
    pl = LedgerService.get_profit_loss(org, scope='INTERNAL')
    # Sales: 5 * 200 = 1000
    # COGS: 5 * 100 = 500
    # Net: 500
    print(f"   - Revenue: {pl['revenue']}")
    print(f"   - COGS: {pl['expenses']}")
    print(f"   - Net Income: {pl['net_income']}")
    
    assert pl['net_income'] == Decimal('500.00')
    print("DONE: P&L Report verified.")

    print("\n====================================================")
    print("ALL SYSTEMS OPERATIONAL. NO MISSING LINKS DETECTED.")
    print("   The system is ready for production use.")
    print("====================================================")

if __name__ == "__main__":
    from erp.services import ConfigurationService # Needed for later check
    test_full_system_readiness()
