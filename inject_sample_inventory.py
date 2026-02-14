import os
import django
import sys
from decimal import Decimal

# Set up Django environment
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()

from apps.inventory.models import Product, Brand, Parfum, Category, Unit
from apps.core.models import Organization

def inject_data():
    # 1. Get Organization
    org = Organization.objects.filter(slug='saas').first() or Organization.objects.first()
    if not org:
        print("No organization found!")
        return
    
    print(f"Injecting data for Organization: {org.name} ({org.slug})")

    # 2. Categories
    perfumery, _ = Category.objects.get_or_create(
        name="Perfumery", 
        organization=org,
        defaults={'code': 'PERF'}
    )
    men_perfume, _ = Category.objects.get_or_create(
        name="Men Perfume", 
        parentId=perfumery.id,
        organization=org,
        defaults={'code': 'MPERF'}
    )
    women_perfume, _ = Category.objects.get_or_create(
        name="Women Perfume", 
        parentId=perfumery.id,
        organization=org,
        defaults={'code': 'WPERF'}
    )

    # 3. Units
    ml, _ = Unit.objects.get_or_create(
        name="Milliliter",
        short_name="ml",
        organization=org
    )

    # 4. Attributes (Parfums)
    vanilla, _ = Parfum.objects.get_or_create(
        name="Vanilla Sky",
        short_name="VAN",
        organization=org
    )
    vanilla.categories.add(perfumery, women_perfume)

    musk, _ = Parfum.objects.get_or_create(
        name="Royal Musk",
        short_name="MUSK",
        organization=org
    )
    musk.categories.add(perfumery, men_perfume)

    # 5. Brands
    chanel, _ = Brand.objects.get_or_create(
        name="Chanel",
        short_name="CH",
        organization=org
    )
    chanel.categories.add(perfumery, women_perfume)

    dior, _ = Brand.objects.get_or_create(
        name="Dior",
        short_name="DIOR",
        organization=org
    )
    dior.categories.add(perfumery, men_perfume)

    # 6. Products
    p1, _ = Product.objects.get_or_create(
        sku="CH-VAN-100",
        organization=org,
        defaults={
            'name': "Chanel Vanilla 100ml",
            'category': women_perfume,
            'brand': chanel,
            'unit': ml,
            'parfum': vanilla,
            'size': Decimal('100.00'),
            'size_unit': ml,
            'cost_price': Decimal('85.00'),
            'selling_price_ttc': Decimal('120.00'),
            'status': 'ACTIVE'
        }
    )

    p2, _ = Product.objects.get_or_create(
        sku="DIOR-MUSK-50",
        organization=org,
        defaults={
            'name': "Dior Royal Musk 50ml",
            'category': men_perfume,
            'brand': dior,
            'unit': ml,
            'parfum': musk,
            'size': Decimal('50.00'),
            'size_unit': ml,
            'cost_price': Decimal('60.00'),
            'selling_price_ttc': Decimal('95.00'),
            'status': 'ACTIVE'
        }
    )

    print("Successfully injected sample inventory data!")

if __name__ == "__main__":
    inject_data()
