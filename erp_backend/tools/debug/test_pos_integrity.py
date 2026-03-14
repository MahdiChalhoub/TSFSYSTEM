import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\tsfci\erp_backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp_backend.settings")
django.setup()

from apps.pos.models import Order, OrderLine
from apps.pos.services import POSService
from apps.inventory.models import Product, Warehouse, Inventory, Site
from apps.finance.models import ChartOfAccount, TransactionSequence
from erp.models import Organization, User
from django.utils import timezone

def verify_pos_integrity():
    print("--- Starting POS Integrity & Dual-Mode Verification ---")
    
    org = Organization.objects.first()
    user = User.objects.filter(organization=org, is_staff=True).first()
    site = Site.objects.filter(organization=org).first()
    warehouse = Warehouse.objects.filter(organization=org, site=site).first()
    
    # 1. Setup Product with base price
    product = Product.objects.filter(organization=org).first()
    product.selling_price_ttc = Decimal('100.00')
    product.cost_price = Decimal('50.00')
    product.save()
    
    # Ensure stock
    Inventory.objects.update_or_create(
        organization=org, warehouse=warehouse, product=product,
        defaults={'quantity': Decimal('1000')}
    )
    
    # Setup Chart of Accounts for Checkout (if needed)
    # This assumes posting rules are already configured or POSService handles missing ones gracefully (it raises ValidationError)
    
    try:
        # 2. Test Dual-Mode Sequencing
        print("Testing Dual-Mode Sequencing...")
        
        # Checkout Official
        order_off = POSService.checkout(
            organization=org, user=user, warehouse=warehouse,
            payment_account_id=1, # Dummy ID, check if it works
            items=[{'product_id': product.id, 'quantity': 1, 'unit_price': 100}],
            scope='OFFICIAL'
        )
        print(f"Official Order: {order_off.invoice_number} | Hash: {order_off.receipt_hash[:12]}...")
        
        # Checkout Internal
        order_int = POSService.checkout(
            organization=org, user=user, warehouse=warehouse,
            payment_account_id=1,
            items=[{'product_id': product.id, 'quantity': 1, 'unit_price': 100}],
            scope='INTERNAL'
        )
        print(f"Internal Order: {order_int.invoice_number} | Hash: {order_int.receipt_hash[:12]}...")
        
        if order_off.invoice_number == order_int.invoice_number:
            print("ERROR: Official and Internal sequences collided!")
        else:
            print("SUCCESS: Dual-Mode sequences are independent.")

        # 3. Test Price Override Forensics
        print("\nTesting Price Override Forensics...")
        order_low = POSService.checkout(
            organization=org, user=user, warehouse=warehouse,
            payment_account_id=1,
            items=[{'product_id': product.id, 'quantity': 1, 'unit_price': 50}], # 50% discount
            scope='OFFICIAL'
        )
        
        line = order_low.lines.first()
        if line.price_override_detected:
            print(f"SUCCESS: Price override detected for Order {order_low.id}")
        else:
            print("ERROR: Price override NOT detected!")

        # 4. Test Immutability
        print("\nTesting POS Immutability...")
        try:
            order_off.total_amount = Decimal('1000000')
            order_off.save()
            print("ERROR: Immutability guard bypassed!")
        except Exception as e:
            print(f"SUCCESS: Immutability guard blocked modification: {str(e)}")

    except Exception as e:
        print(f"FAILED: Unexpected error during verification: {str(e)}")
        import traceback; traceback.print_exc()

if __name__ == "__main__":
    verify_pos_integrity()
