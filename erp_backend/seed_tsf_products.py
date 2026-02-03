import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from erp.models import Organization, Product, Category, Unit

def seed_products():
    org = Organization.objects.get(slug='tsf')
    print(f"Seeding products for {org.name}")
    
    cat, _ = Category.objects.get_or_create(name='Parfums', organization=org)
    unit, _ = Unit.objects.get_or_create(code='PC', organization=org, defaults={'name': 'Piece'})
    
    products = [
        {'name': 'Sauvage Elixir', 'sku': 'SAU-001', 'price': 150.00, 'img': 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=1000&auto=format&fit=crop'},
        {'name': 'Bleu de Chanel', 'sku': 'BLE-002', 'price': 120.00, 'img': 'https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=1000&auto=format&fit=crop'},
        {'name': 'Creed Aventus', 'sku': 'CRE-003', 'price': 350.00, 'img': 'https://images.unsplash.com/photo-1557170334-a9632e77c6e4?q=80&w=1000&auto=format&fit=crop'},
        {'name': 'La Nuit de l\'Homme', 'sku': 'LAN-004', 'price': 95.00, 'img': 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=1000&auto=format&fit=crop'},
    ]
    
    for p in products:
        Product.objects.update_or_create(
            organization=org,
            sku=p['sku'],
            defaults={
                'name': p['name'],
                'category': cat,
                'unit': unit,
                'selling_price_ttc': Decimal(p['price']),
                'selling_price_ht': Decimal(p['price']) / Decimal('1.2'), # Assume 20% tax
                'status': 'ACTIVE'
            }
        )
    print("Done.")

if __name__ == "__main__":
    seed_products()
