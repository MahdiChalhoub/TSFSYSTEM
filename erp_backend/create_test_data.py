#!/usr/bin/env python3
"""
Create Test Data for Intelligence System
=========================================

Creates sample products, warehouses, and inventory for testing
the intelligence features.
"""

import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.inventory.models import Product, Warehouse, Inventory, Brand, Category, Unit
from erp.models import Organization
from django.contrib.auth import get_user_model

User = get_user_model()

print("=" * 70)
print("Creating Test Data for Intelligence System")
print("=" * 70)
print()

# Get or create organization
try:
    org = Organization.objects.first()
    if not org:
        print("⚠️  No organization found. Creating default organization...")
        org = Organization.objects.create(
            name="Test Organization",
            code="TEST-ORG"
        )
        print(f"✅ Created organization: {org.name}")
    else:
        print(f"✅ Using organization: {org.name}")
except Exception as e:
    print(f"❌ Error getting organization: {e}")
    print("   Creating without organization for now...")
    org = None

print()

# Create test user if needed
try:
    user = User.objects.filter(username='testuser').first()
    if not user:
        print("Creating test user...")
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        print(f"✅ Created user: testuser / testpass123")
    else:
        print(f"✅ Using existing user: {user.username}")

    # Create auth token
    from rest_framework.authtoken.models import Token
    token, created = Token.objects.get_or_create(user=user)
    if created:
        print(f"✅ Created auth token: {token.key}")
    else:
        print(f"✅ Using existing token: {token.key}")

    print()
    print("💡 Use this token for API testing:")
    print(f"   Authorization: Token {token.key}")
    print()

except Exception as e:
    print(f"⚠️  Could not create user: {e}")

print()

# Create supporting data
try:
    # Brand
    brand = Brand.objects.filter(name='Test Brand').first()
    if not brand:
        brand = Brand.objects.create(
            organization=org,
            name='Test Brand'
        )
        print(f"✅ Created brand: {brand.name}")
    else:
        print(f"✅ Using brand: {brand.name}")

    # Category
    category = Category.objects.filter(name='Test Category').first()
    if not category:
        category = Category.objects.create(
            organization=org,
            name='Test Category'
        )
        print(f"✅ Created category: {category.name}")
    else:
        print(f"✅ Using category: {category.name}")

    # Unit
    unit = Unit.objects.filter(name='Units').first()
    if not unit:
        unit = Unit.objects.create(
            organization=org,
            name='Units',
            abbreviation='U'
        )
        print(f"✅ Created unit: {unit.name}")
    else:
        print(f"✅ Using unit: {unit.name}")

except Exception as e:
    print(f"⚠️  Could not create supporting data: {e}")
    brand = None
    category = None
    unit = None

print()

# Create warehouses
warehouses = []
warehouse_data = [
    {'name': 'NYC Warehouse', 'code': 'WH-NYC', 'lat': 40.7128, 'lng': -74.0060},
    {'name': 'LA Warehouse', 'code': 'WH-LA', 'lat': 34.0522, 'lng': -118.2437},
    {'name': 'Chicago Warehouse', 'code': 'WH-CHI', 'lat': 41.8781, 'lng': -87.6298},
]

print("Creating warehouses...")
for wh_data in warehouse_data:
    try:
        wh = Warehouse.objects.filter(code=wh_data['code']).first()
        if not wh:
            wh = Warehouse.objects.create(
                organization=org,
                name=wh_data['name'],
                code=wh_data['code'],
                latitude=Decimal(str(wh_data['lat'])),
                longitude=Decimal(str(wh_data['lng']))
            )
            print(f"  ✅ Created: {wh.name} (ID: {wh.id})")
        else:
            print(f"  ✅ Exists: {wh.name} (ID: {wh.id})")
        warehouses.append(wh)
    except Exception as e:
        print(f"  ❌ Failed to create {wh_data['name']}: {e}")

print()

# Create products
products = []
product_data = [
    {'name': 'Premium Widget', 'sku': 'WIDGET-001', 'price': 49.99, 'cost': 25.00},
    {'name': 'Standard Gadget', 'sku': 'GADGET-001', 'price': 29.99, 'cost': 15.00},
    {'name': 'Deluxe Gizmo', 'sku': 'GIZMO-001', 'price': 79.99, 'cost': 40.00},
    {'name': 'Basic Tool', 'sku': 'TOOL-001', 'price': 19.99, 'cost': 10.00},
    {'name': 'Pro Equipment', 'sku': 'EQUIP-001', 'price': 149.99, 'cost': 75.00},
]

print("Creating products...")
for prod_data in product_data:
    try:
        prod = Product.objects.filter(sku=prod_data['sku']).first()
        if not prod:
            prod = Product.objects.create(
                organization=org,
                name=prod_data['name'],
                sku=prod_data['sku'],
                brand=brand,
                category=category,
                unit=unit,
                retail_price=Decimal(str(prod_data['price'])),
                cost_price=Decimal(str(prod_data['cost'])),
                is_active=True
            )
            print(f"  ✅ Created: {prod.name} (ID: {prod.id})")
        else:
            print(f"  ✅ Exists: {prod.name} (ID: {prod.id})")
        products.append(prod)
    except Exception as e:
        print(f"  ❌ Failed to create {prod_data['name']}: {e}")

print()

# Create inventory levels
print("Creating inventory levels...")
import random

for warehouse in warehouses:
    for product in products:
        try:
            inv = Inventory.objects.filter(
                warehouse=warehouse,
                product=product
            ).first()

            if not inv:
                quantity = random.randint(50, 500)
                inv = Inventory.objects.create(
                    organization=org,
                    warehouse=warehouse,
                    product=product,
                    quantity=quantity,
                    reserved_quantity=random.randint(0, 20)
                )
                print(f"  ✅ {warehouse.code} × {product.sku}: {quantity} units")
            else:
                print(f"  ✅ {warehouse.code} × {product.sku}: {inv.quantity} units (exists)")

        except Exception as e:
            print(f"  ❌ Failed to create inventory: {e}")

print()
print("=" * 70)
print("Test Data Creation Complete!")
print("=" * 70)
print()
print("📊 Summary:")
print(f"   Warehouses: {len(warehouses)}")
print(f"   Products: {len(products)}")
print(f"   Inventory Records: {len(warehouses) * len(products)}")
print()

if warehouses and products:
    print("🧪 Sample Test Cases:")
    print()
    print("1. Forecast Demand:")
    print(f"   Product ID: {products[0].id}")
    print(f"   curl -X POST http://localhost:8000/api/inventory/intelligence/forecast-demand/ \\")
    print(f"     -H \"Authorization: Token {token.key if 'token' in locals() else 'YOUR_TOKEN'}\" \\")
    print(f"     -H \"Content-Type: application/json\" \\")
    print(f"     -d '{{\"product_id\": {products[0].id}, \"days_ahead\": 30}}'")
    print()

    print("2. Analyze Transfer:")
    if len(warehouses) >= 2:
        print(f"   From: {warehouses[0].name} (ID: {warehouses[0].id})")
        print(f"   To: {warehouses[1].name} (ID: {warehouses[1].id})")
        print(f"   Product: {products[0].name} (ID: {products[0].id})")
        print(f"   curl -X POST http://localhost:8000/api/inventory/intelligence/analyze-transfer/ \\")
        print(f"     -H \"Authorization: Token {token.key if 'token' in locals() else 'YOUR_TOKEN'}\" \\")
        print(f"     -H \"Content-Type: application/json\" \\")
        print(f"     -d '{{")
        print(f"       \"product_id\": {products[0].id},")
        print(f"       \"from_warehouse_id\": {warehouses[0].id},")
        print(f"       \"to_warehouse_id\": {warehouses[1].id},")
        print(f"       \"quantity\": 50,")
        print(f"       \"reason\": \"Stock replenishment\"")
        print(f"     }}'")
    print()

    print("3. Frontend Testing:")
    print(f"   Navigate to: http://localhost:3000/inventory/intelligence")
    print(f"   Use Product ID: {products[0].id}")
    print(f"   Use Warehouse IDs: {warehouses[0].id}, {warehouses[1].id}")
    print()

print("✅ Ready for testing!")
print()
