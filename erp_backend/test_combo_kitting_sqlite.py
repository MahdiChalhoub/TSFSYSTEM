import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
# Force sqlite for isolated test
os.environ['DB_ENGINE'] = 'django.db.backends.sqlite3'
os.environ['DB_NAME'] = ':memory:'

django.setup()

from django.core.management import call_command
call_command('migrate', interactive=False)

from erp.models import Organization, Site
from apps.inventory.models import Product, Warehouse, Inventory, ComboComponent
from apps.inventory.services import InventoryService
from decimal import Decimal

org = Organization.objects.create(name="Test Org")
site = Site.objects.create(organization=org, name="Main Site")
warehouse = Warehouse.objects.create(organization=org, name="Main Warehouse", site=site)

# 1. Create Child Components
child1 = Product.objects.create(organization=org, sku="CHILD-01", name="Motherboard", product_type='STANDARD', cost_price=Decimal('50.00'))
child2 = Product.objects.create(organization=org, sku="CHILD-02", name="CPU", product_type='STANDARD', cost_price=Decimal('150.00'))

# 2. Add some stock to children
InventoryService.receive_stock(org, child1, warehouse, quantity=10, cost_price_ht=50.00, reference="IN-001")
InventoryService.receive_stock(org, child2, warehouse, quantity=10, cost_price_ht=150.00, reference="IN-002")

# 3. Create COMBO Product
combo = Product.objects.create(organization=org, sku="BNDL-PC", name="PC Kit", product_type='COMBO')

# 4. Link COMBO Components
ComboComponent.objects.create(organization=org, combo_product=combo, component_product=child1, quantity=1)
ComboComponent.objects.create(organization=org, combo_product=combo, component_product=child2, quantity=1)

# 5. Simulate a COMBO Sale (reduce stock)
eff_amc = InventoryService.reduce_stock(org, combo, warehouse, quantity=1, reference="SALE-COMBO-1")
i1 = Inventory.objects.get(organization=org, product=child1, warehouse=warehouse)
i2 = Inventory.objects.get(organization=org, product=child2, warehouse=warehouse)
print(f"SUCCESS: Cogs = {eff_amc}. Child 1 Qty: {i1.quantity}, Child 2 Qty: {i2.quantity}")
