import os
import django
import sys
from decimal import Decimal

# Setup Django Environment
sys.path.append('C:\\tsfci\\erp_backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, Product, Warehouse, Inventory, Category, Unit, Site
from erp.services import InventoryService, ProvisioningService

def test_amc_engine():
    print("--- Testing AMC & Effective Cost Engine ---")
    
    # 1. Setup Organization
    org_slug = f"amc-test-{uuid.uuid4().hex[:8]}"
    print(f"Using Org Slug: {org_slug}")
    org = ProvisioningService.provision_organization("AMC Test Corp", org_slug)
    
    site = Site.objects.get(organization=org, code="MAIN")
    warehouse = Warehouse.objects.get(organization=org, site=site)
    
    # 2. Create Product
    product = Product.objects.create(
        organization=org,
        sku="TEST-AMC-001",
        name="Test Inventory Item",
        tva_rate=Decimal('0.10'), # 10% VAT
        cost_price=Decimal('0')
    )
    
    # 3. First Reception (10 units @ 100 HT, Tax Recoverable)
    # Effective Cost = 100
    print("\n[Reception 1]: 10 units @ 100 HT (Tax Recoverable)")
    InventoryService.receive_stock(org, product, warehouse, 10, 100, is_tax_recoverable=True)
    product.refresh_from_db()
    print(f"   - New AMC: {product.cost_price}")
    assert product.cost_price == Decimal('100.00'), f"Expected 100, got {product.cost_price}"

    # 4. Second Reception (10 units @ 100 HT, Tax NOT Recoverable)
    # Effective Cost = 100 * 1.1 = 110
    # Weighted Average: ((10 * 100) + (10 * 110)) / 20 = 105
    print("\n[Reception 2]: 10 units @ 100 HT (Tax NOT Recoverable)")
    InventoryService.receive_stock(org, product, warehouse, 10, 100, is_tax_recoverable=False)
    product.refresh_from_db()
    print(f"   - New AMC: {product.cost_price}")
    # Calculation: (1000 + 1100) / 20 = 105
    assert product.cost_price == Decimal('105.00'), f"Expected 105, got {product.cost_price}"

    # 5. Third Reception (20 units @ 150 HT, Tax Recoverable)
    # Effective Cost = 150
    # Weighted Average: ((20 * 105) + (20 * 150)) / 40 = 5100 / 40 = 127.5
    print("\n[Reception 3]: 20 units @ 150 HT (Tax Recoverable)")
    InventoryService.receive_stock(org, product, warehouse, 20, 150, is_tax_recoverable=True)
    product.refresh_from_db()
    print(f"   - New AMC: {product.cost_price}")
    assert product.cost_price == Decimal('127.50'), f"Expected 127.5, got {product.cost_price}"

    print("\nSUCCESS: AMC & Effective Cost Engine verified successfully!")

if __name__ == "__main__":
    import uuid
    try:
        test_amc_engine()
    except Exception as e:
        print(f"FAILURE: Test Failed: {str(e)}")
        import traceback
        traceback.print_exc()
