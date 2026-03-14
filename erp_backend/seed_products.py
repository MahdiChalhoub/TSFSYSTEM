import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.inventory.models import Product, Category, Brand, Unit
from erp.models import Organization

def create_demo_products():
    org = Organization.objects.get(slug='test-org')
    unit, _ = Unit.objects.get_or_create(code='PC', organization=org, defaults={'name': 'Piece'})
    
    cat_elec, _ = Category.objects.get_or_create(name='Electronics', organization=org)
    cat_home, _ = Category.objects.get_or_create(name='Home & Living', organization=org)
    
    brand_alpha, _ = Brand.objects.get_or_create(name='AlphaTech', organization=org)
    brand_omega, _ = Brand.objects.get_or_create(name='OmegaHome', organization=org)

    products_data = [
        ('Gaming Laptop Z1', 'High-end gaming laptop', 1500, cat_elec, brand_alpha),
        ('Wireless Mouse', 'Ergonomic wireless mouse', 25, cat_elec, brand_alpha),
        ('Mechanical Keyboard', 'RGB Mechanical Keyboard', 80, cat_elec, brand_alpha),
        ('Smart LED Bulb', 'Color changing smart bulb', 15, cat_home, brand_omega),
        ('Coffee Maker', 'Programmable coffee maker', 60, cat_home, brand_omega),
    ]

    for name, desc, price, cat, brand in products_data:
        Product.objects.get_or_create(
            name=name,
            organization=org,
            defaults={
                'description': desc,
                'selling_price_ht': Decimal(price) / Decimal('1.2'),
                'selling_price_ttc': Decimal(price),
                'category': cat,
                'brand': brand,
                'unit': unit,
                'sku': f"SKU-{name[:3].upper()}-{random.randint(100, 999)}" if 'random' in globals() else f"SKU-{name[:3].upper()}-123"
            }
        )
    
    import random
    # Fix SKU with random properly
    for p in Product.objects.filter(sku='SKU-PRO-123'): # just in case
         p.sku = f"SKU-{p.name[:3].upper()}-{random.randint(100,999)}"
         p.save()

    print(f"Created {Product.objects.count()} demo products.")

if __name__ == "__main__":
    create_demo_products()
