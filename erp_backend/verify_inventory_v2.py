import os
import django
import uuid
from decimal import Decimal

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.inventory.models import Product, Warehouse, StockAdjustmentOrder, StockAdjustmentLine, Inventory, InventoryMovement
from apps.inventory.services import InventoryService
from apps.finance.models import Organization, JournalEntry, JournalEntryLine
from django.contrib.auth import get_user_model
from django.utils import timezone

def run_verification():
    print("🚀 Starting Inventory Enhancement Verification...")
    
    org = Organization.objects.filter(slug='tsf-global').first()
    if not org:
        print("❌ Error: Demo organization 'tsf-global' not found. Run seed.py first.")
        return

    admin = get_user_model().objects.filter(is_superuser=True).first()
    warehouse = Warehouse.objects.filter(organization=org).first()
    
    print(f"🏢 Org: {org.name}, Admin: {admin.username}, Warehouse: {warehouse.name}")

    # 1. Create a test product
    sku = f"TEST-{uuid.uuid4().hex[:6].upper()}"
    product = Product.objects.create(
        organization=org,
        sku=sku,
        name=f"Verification Product {sku}",
        cost_price=Decimal('100.00'),
        cost_price_ht=Decimal('100.00'),
        tva_rate=Decimal('0.11'),
        status='ACTIVE'
    )
    print(f"📦 Created Product: {product.name} (SKU: {product.sku})")

    # 2. Test Partial Stock Reception (Valuation Check)
    print("📥 Receiving 10 units @ 110.00...")
    InventoryService.receive_stock(
        organization=org,
        product=product,
        warehouse=warehouse,
        quantity=10,
        cost_price_ht=110.00,
        user=admin,
        reference=f"REC-{sku}"
    )
    
    # Check Movement & Valuation
    movements = InventoryMovement.objects.filter(reference=f"REC-{sku}")
    print(f"✅ Movements Created: {movements.count()}")
    
    # 3. Test Stock Adjustment Order (Batch Processing & Finance Sync)
    print("📝 Creating Stock Adjustment Order (2 lines)...")
    order = StockAdjustmentOrder.objects.create(
        organization=org,
        date=timezone.now().date(),
        warehouse=warehouse,
        reference=f"ADJ-ORDER-{sku}",
        reason="Verification Test"
    )
    
    StockAdjustmentLine.objects.create(
        order=order, product=product, warehouse=warehouse,
        qty_adjustment=5, reason="Gain Test"
    )
    StockAdjustmentLine.objects.create(
        order=order, product=product, warehouse=warehouse,
        qty_adjustment=-2, reason="Loss Test"
    )
    
    print(f"⚙️ Processing Order {order.reference}...")
    InventoryService.process_adjustment_order(org, order, user=admin)
    
    # Verify Order Status
    order.refresh_from_db()
    print(f"🏁 Order Status: {order.lifecycle_status}, Is Posted: {order.is_posted}")
    
    if order.lifecycle_status == 'CONFIRMED' and order.is_posted:
        print("✅ Bulk Processing Logic: SUCCESS")
    else:
        print("❌ Bulk Processing Logic: FAILED")

    # 4. Verify Batch Financial Posting
    je = JournalEntry.objects.filter(reference=order.reference).first()
    if je:
        print(f"💰 Batch Journal Entry Found: {je.description} (Lines: {je.lines.count()})")
        if je.lines.count() == 4: # Gain (2 lines) + Loss (2 lines) = 4 lines
            print("✅ Batch Financial Posting: SUCCESS")
        else:
            print(f"❌ Batch Financial Posting: FAILED (Expected 4 lines, got {je.lines.count()})")
    else:
        print("❌ Batch Journal Entry NOT found.")

    # 5. Test Ledger Sync
    print("⚖️ Testing sync_inventory_to_ledger...")
    sync_res = InventoryService.sync_inventory_to_ledger(org, user=admin)
    print(f"📊 Sync Result: {sync_res['status']} ({sync_res.get('message', sync_res.get('adjusted_by'))})")
    
    print("\n✨ Verification Complete!")

if __name__ == '__main__':
    run_verification()
