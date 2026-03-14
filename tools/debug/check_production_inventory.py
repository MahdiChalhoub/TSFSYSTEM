from django.apps import apps
import django
import os
import sys

# Set up Django environment
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp.settings')
django.setup()

from apps.inventory.models import Product, Brand, Parfum, Category, Unit

def check_inventory():
    print(f"Products: {Product.objects.count()}")
    print(f"Brands: {Brand.objects.count()}")
    print(f"Parfums: {Parfum.objects.count()}")
    print(f"Categories: {Category.objects.count()}")
    print(f"Units: {Unit.objects.count()}")
    
    # Check for recent products with size
    print("\nChecking recent products (last 3):")
    recent_products = Product.objects.all().order_by('-id')[:3]
    for p in recent_products:
        size_info = f"{p.size} {p.size_unit.short_name}" if p.size_unit else f"{p.size} (No Unit)"
        print(f" - {p.name} (SKU: {p.sku}): Size={p.size}, SizeUnit={p.size_unit_id}")

    # Check for brands with countries
    print("\nChecking brands (last 3):")
    brands = Brand.objects.all().order_by('-id')[:3]
    for b in brands:
        country_count = b.countries.count()
        print(f" - {b.name}: {country_count} countries linked")

if __name__ == "__main__":
    check_inventory()
