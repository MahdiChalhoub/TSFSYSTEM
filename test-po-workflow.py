import os
import django
import sys
from decimal import Decimal

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, Product, Warehouse, Order, OrderLine, User, Site, ChartOfAccount
from erp.services import ProvisioningService, PurchaseService, LedgerService

def test_po_workflow():
    print("--- Testing Purchase Order (PO) Workflow ---")
    
    # 1. Setup Organization
    import uuid
    org_slug = f"po-test-{uuid.uuid4().hex[:8]}"
    org = ProvisioningService.provision_organization("PO Test Corp", org_slug)
    
    site = Site.objects.get(organization=org, code="MAIN")
    warehouse = Warehouse.objects.get(organization=org, site=site)
    user = User.objects.create(username=f"buyer_{org_slug}", organization=org)
    
    # 2. Create Product
    product = Product.objects.create(
        organization=org,
        sku="PO-ITEM-001",
        name="PO Test Item",
        tva_rate=Decimal('0.10'),
        cost_price=Decimal('0.00') # Start with 0 AMC
    )
    
    # 3. Create Draft PO
    print("\n[Step 1]: Creating Draft PO (Quantity 10 @ 100 HT)")
    order = Order.objects.create(
        organization=org,
        type='PURCHASE',
        status='DRAFT',
        user=user,
        site=site,
        total_amount=Decimal('1000.00') # 10 * 100
    )
    OrderLine.objects.create(
        organization=org,
        order=order,
        product=product,
        quantity=Decimal('10'),
        unit_price=Decimal('100'),
        total=Decimal('1000')
    )
    
    # 4. Authorize PO
    print("[Step 2]: Authorizing PO")
    PurchaseService.authorize_po(org, order.id)
    order.refresh_from_db()
    assert order.status == 'AUTHORIZED'
    
    # 5. Receive Stock
    print("[Step 3]: Receiving Stock (Physical Step)")
    # This should increase Inventory and Dr Inv / Cr Accrued Reception
    PurchaseService.receive_po(org, order.id, warehouse.id, is_tax_recoverable=True)
    order.refresh_from_db()
    assert order.status == 'RECEIVED'
    
    product.refresh_from_db()
    print(f"   - AMC after reception: {product.cost_price}")
    assert product.cost_price == Decimal('100.00')
    
    # Check Ledger
    accrued_acc = ChartOfAccount.objects.get(organization=org, sub_type='SUSPENSE')
    print(f"   - Accrued Reception Balance: {accrued_acc.balance}")
    # Since Dr Inv Cr Accrued -> Accrued (Liability) should be Negative/Credit (in net calc Dr - Cr)
    assert accrued_acc.balance == Decimal('-1000.00')

    # 6. Invoice PO
    print("[Step 4]: Invoicing PO (Financial Step)")
    # This should clear Accrued Reception and Cr Accounts Payable
    PurchaseService.invoice_po(org, order.id, "INV-SUP-999")
    order.refresh_from_db()
    assert order.status == 'INVOICED'
    
    accrued_acc.refresh_from_db()
    ap_acc = ChartOfAccount.objects.get(organization=org, sub_type='PAYABLE')
    print(f"   - Accrued Reception Balance (Cleared): {accrued_acc.balance}")
    print(f"   - Accounts Payable Balance: {ap_acc.balance}")
    
    assert accrued_acc.balance == Decimal('0.00')
    assert ap_acc.balance == Decimal('-1000.00')

    print("\n✅ Purchase Order Workflow verified successfully!")

if __name__ == "__main__":
    test_po_workflow()
