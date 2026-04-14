"""
Seed Demo Products — Comprehensive Product Data Generator
==========================================================
Creates realistic demo products covering ALL product types:
 1. STANDARD products with multi-level packaging
 2. COMBO / Bundle products
 3. Multi-variant products (parent + children)
 4. SERVICE type products

ALL products have EVERY field populated:
 - Brand, Category, Unit, Country of Origin,
 - Product Group, Parfum/Fragrance, Attributes (Color, Size, Volume)
 - Pricing (cost, selling HT/TTC, TVA)
 - Stock levels, reorder points, min/max levels

Usage:
  python manage.py seed_demo_products
"""
import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Seed comprehensive demo products with all fields populated'

    def handle(self, *args, **options):
        from erp.models import Organization, Country as LegacyCountry
        from apps.reference.models import Country as RefCountry
        from apps.inventory.models.product_models import (
            Product, Brand, Category, Unit, Parfum, ProductGroup,
            ProductAttribute, ComboComponent, ProductPackaging,
        )

        org = Organization.objects.first()
        if not org:
            self.stderr.write('No organization found.')
            return

        self.stdout.write(f'Seeding demo products for: {org.name}')

        with transaction.atomic():
            # ═══════════════════════════════════════
            # 1. UNITS
            # ═══════════════════════════════════════
            units_data = [
                ('PC', 'Piece', 'pc', 'UNIT'),
                ('KG', 'Kilogram', 'kg', 'WEIGHT'),
                ('ML', 'Milliliter', 'ml', 'VOLUME'),
                ('L', 'Liter', 'L', 'VOLUME'),
                ('BOX', 'Box', 'box', 'UNIT'),
                ('PACK', 'Pack', 'pack', 'UNIT'),
            ]
            units = {}
            for code, name, short, utype in units_data:
                u, _ = Unit.objects.get_or_create(
                    code=code, organization=org,
                    defaults={'name': name, 'short_name': short, 'type': utype}
                )
                units[code] = u
            self.stdout.write(f'  ✓ {len(units)} units ready')

            # ═══════════════════════════════════════
            # 2. CATEGORIES (hierarchical)
            # ═══════════════════════════════════════
            cats = {}
            cat_tree = {
                'Beverages': ['Soft Drinks', 'Juices', 'Water'],
                'Cosmetics': ['Fragrances', 'Skincare', 'Makeup'],
                'Food': ['Snacks', 'Dairy', 'Bakery'],
                'Electronics': ['Accessories', 'Audio', 'Cables'],
                'Household': ['Cleaning', 'Kitchen', 'Storage'],
            }
            for parent_name, children in cat_tree.items():
                parent, _ = Category.objects.get_or_create(
                    name=parent_name, organization=org,
                    defaults={'code': parent_name[:3].upper(), 'level': 0}
                )
                cats[parent_name] = parent
                for child_name in children:
                    child, _ = Category.objects.get_or_create(
                        name=child_name, organization=org,
                        defaults={'code': child_name[:4].upper(), 'parent': parent, 'level': 1}
                    )
                    cats[child_name] = child
            self.stdout.write(f'  ✓ {len(cats)} categories ready')

            # ═══════════════════════════════════════
            # 3. BRANDS
            # ═══════════════════════════════════════
            brands_data = [
                'Coca-Cola', 'Pepsi', 'Nestlé', 'L\'Oréal', 'Samsung',
                'Nike', 'Dior', 'Chanel', 'Hermès', 'Tom Ford',
                'Unilever', 'Apple', 'Sony', 'Procter & Gamble', 'Danone',
            ]
            brands = {}
            for bname in brands_data:
                b, _ = Brand.objects.get_or_create(
                    name=bname, organization=org,
                    defaults={'short_name': bname[:4].upper()}
                )
                brands[bname] = b
            self.stdout.write(f'  ✓ {len(brands)} brands ready')

            # ═══════════════════════════════════════
            # 4. COUNTRIES (reference)
            # ═══════════════════════════════════════
            ref_countries = {}
            country_data = [
                ('France', 'FR'), ('Lebanon', 'LB'), ('USA', 'US'),
                ('Italy', 'IT'), ('Germany', 'DE'), ('Japan', 'JP'),
                ('South Korea', 'KR'), ('China', 'CN'), ('Turkey', 'TR'),
                ('United Kingdom', 'GB'),
            ]
            for cname, ccode in country_data:
                c = RefCountry.objects.filter(name__icontains=cname).first()
                if not c:
                    c = RefCountry.objects.filter(iso2=ccode).first()
                if c:
                    ref_countries[cname] = c
            # Also seed legacy countries
            for cname, ccode in country_data:
                LegacyCountry.objects.get_or_create(code=ccode, defaults={'name': cname})
            self.stdout.write(f'  ✓ {len(ref_countries)} reference countries linked')

            # ═══════════════════════════════════════
            # 5. PARFUMS (Fragrance variants)
            # ═══════════════════════════════════════
            parfums_data = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Musky', 'Aquatic', 'Spicy']
            parfums = {}
            for pname in parfums_data:
                p, _ = Parfum.objects.get_or_create(
                    name=pname, organization=org,
                    defaults={'short_name': pname[:3].upper()}
                )
                parfums[pname] = p
            self.stdout.write(f'  ✓ {len(parfums)} parfums ready')

            # ═══════════════════════════════════════
            # 6. PRODUCT GROUPS
            # ═══════════════════════════════════════
            groups_data = [
                ('Eau de Parfum Collection', 'Dior', 'Floral', 'Fragrances'),
                ('Soft Drink Range', 'Coca-Cola', None, 'Soft Drinks'),
                ('Premium Skincare Line', 'L\'Oréal', None, 'Skincare'),
                ('Tech Accessories', 'Samsung', None, 'Accessories'),
                ('Sports Collection', 'Nike', None, None),
            ]
            groups = {}
            for gname, brand_name, parfum_name, cat_name in groups_data:
                g, _ = ProductGroup.objects.get_or_create(
                    name=gname, organization=org,
                    defaults={
                        'brand': brands.get(brand_name),
                        'parfum': parfums.get(parfum_name) if parfum_name else None,
                        'category': cats.get(cat_name) if cat_name else None,
                        'description': f'Product group: {gname}',
                    }
                )
                groups[gname] = g
            self.stdout.write(f'  ✓ {len(groups)} product groups ready')

            # ═══════════════════════════════════════
            # 7. ATTRIBUTE TREE (V2 System)
            # ═══════════════════════════════════════
            attr_groups = {}
            attr_tree = {
                'Color': {'is_variant': True, 'show_in_name': True, 'name_position': 2, 'values': [
                    ('Red', '#FF0000'), ('Blue', '#0066CC'), ('Black', '#000000'),
                    ('White', '#FFFFFF'), ('Gold', '#FFD700'), ('Silver', '#C0C0C0'),
                    ('Rose', '#FF69B4'), ('Green', '#228B22'),
                ]},
                'Volume': {'is_variant': True, 'show_in_name': True, 'name_position': 1, 'short_label': 'ml', 'values': [
                    ('30', None), ('50', None), ('75', None),
                    ('100', None), ('150', None), ('200', None),
                ]},
                'Size': {'is_variant': True, 'show_in_name': True, 'name_position': 1, 'values': [
                    ('XS', None), ('S', None), ('M', None),
                    ('L', None), ('XL', None), ('XXL', None),
                ]},
                'Material': {'is_variant': False, 'show_in_name': False, 'values': [
                    ('Cotton', None), ('Polyester', None), ('Leather', None),
                    ('Silk', None), ('Wool', None),
                ]},
                'Concentration': {'is_variant': True, 'show_in_name': True, 'name_position': 0, 'values': [
                    ('Eau de Parfum', None), ('Eau de Toilette', None),
                    ('Parfum', None), ('Eau de Cologne', None),
                ]},
                'Flavor': {'is_variant': True, 'show_in_name': True, 'name_position': 1, 'values': [
                    ('Original', None), ('Cherry', None), ('Vanilla', None),
                    ('Lemon', None), ('Mango', None), ('Strawberry', None),
                ]},
            }
            attr_values = {}
            for group_name, cfg in attr_tree.items():
                root, _ = ProductAttribute.objects.get_or_create(
                    name=group_name, parent=None, organization=org,
                    defaults={
                        'is_variant': cfg['is_variant'],
                        'show_in_name': cfg.get('show_in_name', False),
                        'name_position': cfg.get('name_position', 99),
                        'short_label': cfg.get('short_label'),
                        'code': group_name[:4].upper(),
                    }
                )
                attr_groups[group_name] = root
                for val_name, color_hex in cfg['values']:
                    val, _ = ProductAttribute.objects.get_or_create(
                        name=val_name, parent=root, organization=org,
                        defaults={'color_hex': color_hex, 'code': val_name[:4].upper()}
                    )
                    attr_values[f"{group_name}:{val_name}"] = val
            self.stdout.write(f'  ✓ {len(attr_groups)} attribute groups, {len(attr_values)} values ready')

            # ═══════════════════════════════════════
            # 8. STANDARD PRODUCTS (with multi-level packaging)
            # ═══════════════════════════════════════
            sku_counter = [1000]
            def next_sku(prefix='PRD'):
                sku_counter[0] += 1
                return f'{prefix}-{sku_counter[0]:05d}'

            def rand_price(low, high):
                return Decimal(str(round(random.uniform(low, high), 2)))

            standard_products = [
                # (name, brand, category, country, parfum, group, unit, attrs, tva, cost, sell)
                ('Coca-Cola Classic 330ml', 'Coca-Cola', 'Soft Drinks', 'USA', None, 'Soft Drink Range', 'PC',
                 ['Flavor:Original'], 11, 0.35, 0.75),
                ('Coca-Cola Cherry 330ml', 'Coca-Cola', 'Soft Drinks', 'USA', None, 'Soft Drink Range', 'PC',
                 ['Flavor:Cherry'], 11, 0.35, 0.75),
                ('Pepsi Original 500ml', 'Pepsi', 'Soft Drinks', 'USA', None, None, 'PC',
                 ['Flavor:Original', 'Volume:500'], 11, 0.40, 0.85),
                ('Pepsi Vanilla 500ml', 'Pepsi', 'Soft Drinks', 'USA', None, None, 'PC',
                 ['Flavor:Vanilla', 'Volume:500'], 11, 0.40, 0.85),
                ('Nestlé Pure Life 1.5L', 'Nestlé', 'Water', 'France', None, None, 'PC',
                 [], 5.5, 0.20, 0.50),
                ('Nestlé Pure Life 500ml', 'Nestlé', 'Water', 'France', None, None, 'PC',
                 [], 5.5, 0.10, 0.30),
                ('L\'Oréal Revitalift Cream 50ml', 'L\'Oréal', 'Skincare', 'France', None, 'Premium Skincare Line', 'PC',
                 ['Volume:50', 'Color:White'], 20, 8.50, 22.99),
                ('L\'Oréal Revitalift Serum 30ml', 'L\'Oréal', 'Skincare', 'France', None, 'Premium Skincare Line', 'PC',
                 ['Volume:30', 'Color:Gold'], 20, 12.00, 34.99),
                ('Samsung USB-C Cable 1m', 'Samsung', 'Cables', 'South Korea', None, 'Tech Accessories', 'PC',
                 ['Color:Black'], 20, 2.50, 9.99),
                ('Samsung USB-C Cable 2m', 'Samsung', 'Cables', 'South Korea', None, 'Tech Accessories', 'PC',
                 ['Color:White', 'Size:L'], 20, 3.50, 14.99),
                ('Samsung Wireless Charger', 'Samsung', 'Accessories', 'South Korea', None, 'Tech Accessories', 'PC',
                 ['Color:Black'], 20, 12.00, 39.99),
                ('Danone Activia Yogurt Strawberry', 'Danone', 'Dairy', 'France', None, None, 'PC',
                 ['Flavor:Strawberry'], 5.5, 0.45, 1.20),
                ('Danone Activia Yogurt Vanilla', 'Danone', 'Dairy', 'France', None, None, 'PC',
                 ['Flavor:Vanilla'], 5.5, 0.45, 1.20),
                ('Unilever Dove Soap Bar 100g', 'Unilever', 'Skincare', 'United Kingdom', None, None, 'PC',
                 ['Color:White'], 11, 0.80, 2.49),
                ('Unilever Dove Body Wash 500ml', 'Unilever', 'Skincare', 'United Kingdom', None, None, 'PC',
                 ['Volume:500', 'Color:White'], 11, 2.50, 6.99),
            ]

            created_products = {}
            for (name, brand_name, cat_name, country_name, parfum_name,
                 group_name, unit_code, attr_keys, tva, cost, sell) in standard_products:
                sku = next_sku()
                sell_ht = Decimal(str(round(sell / (1 + tva/100), 2)))
                cost_ht = Decimal(str(round(cost / (1 + tva/100), 2)))
                p, created = Product.objects.get_or_create(
                    sku=sku, organization=org,
                    defaults={
                        'name': name,
                        'base_name': name.split(' ')[0] + ' ' + name.split(' ')[1] if len(name.split(' ')) > 1 else name,
                        'product_type': 'STANDARD',
                        'brand': brands.get(brand_name),
                        'category': cats.get(cat_name),
                        'unit': units.get(unit_code),
                        'country_of_origin': ref_countries.get(country_name),
                        'parfum': parfums.get(parfum_name) if parfum_name else None,
                        'product_group': groups.get(group_name) if group_name else None,
                        'cost_price': Decimal(str(cost)),
                        'cost_price_ht': cost_ht,
                        'cost_price_ttc': Decimal(str(cost)),
                        'selling_price_ht': sell_ht,
                        'selling_price_ttc': Decimal(str(sell)),
                        'tva_rate': Decimal(str(tva)),
                        'min_stock_level': random.randint(5, 20),
                        'max_stock_level': random.randint(100, 500),
                        'reorder_point': Decimal(str(random.randint(10, 30))),
                        'reorder_quantity': Decimal(str(random.randint(50, 200))),
                        'barcode': f'590{random.randint(1000000000, 9999999999)}',
                        'description': f'Premium {name} - high quality product from {brand_name}',
                    }
                )
                # Link attributes
                for ak in attr_keys:
                    if ak in attr_values:
                        p.attribute_values.add(attr_values[ak])
                created_products[name] = p
            self.stdout.write(f'  ✓ {len(created_products)} standard products created')

            # ═══════════════════════════════════════
            # 9. MULTI-LEVEL PACKAGING (on select products)
            # ═══════════════════════════════════════
            packaging_targets = [
                ('Coca-Cola Classic 330ml', [
                    ('Can 330ml', 1, 1, units['PC'], Decimal('0.75'), Decimal('0.35')),
                    ('Pack of 6', 2, 6, units['PACK'], Decimal('4.20'), Decimal('1.90')),
                    ('Carton of 24', 3, 24, units['BOX'], Decimal('15.50'), Decimal('7.50')),
                ]),
                ('Coca-Cola Cherry 330ml', [
                    ('Can 330ml', 1, 1, units['PC'], Decimal('0.75'), Decimal('0.35')),
                    ('Pack of 6', 2, 6, units['PACK'], Decimal('4.20'), Decimal('1.90')),
                    ('Carton of 24', 3, 24, units['BOX'], Decimal('15.50'), Decimal('7.50')),
                ]),
                ('Nestlé Pure Life 1.5L', [
                    ('Bottle 1.5L', 1, 1, units['PC'], Decimal('0.50'), Decimal('0.20')),
                    ('Pack of 6', 2, 6, units['PACK'], Decimal('2.70'), Decimal('1.10')),
                    ('Pallet 120 bottles', 3, 120, units['BOX'], Decimal('48.00'), Decimal('20.00')),
                ]),
                ('Nestlé Pure Life 500ml', [
                    ('Bottle 500ml', 1, 1, units['PC'], Decimal('0.30'), Decimal('0.10')),
                    ('Pack of 12', 2, 12, units['PACK'], Decimal('3.20'), Decimal('1.10')),
                    ('Carton of 24', 3, 24, units['BOX'], Decimal('6.00'), Decimal('2.00')),
                ]),
                ('Danone Activia Yogurt Strawberry', [
                    ('Cup 125g', 1, 1, units['PC'], Decimal('1.20'), Decimal('0.45')),
                    ('Pack of 4', 2, 4, units['PACK'], Decimal('4.50'), Decimal('1.60')),
                    ('Tray of 12', 3, 12, units['BOX'], Decimal('12.00'), Decimal('4.50')),
                ]),
            ]
            pkg_count = 0
            for prod_name, levels in packaging_targets:
                if prod_name in created_products:
                    product = created_products[prod_name]
                    for pkg_name, level, ratio, unit, sell_ttc, buy_ht in levels:
                        ProductPackaging.objects.get_or_create(
                            product=product, level=level, organization=org,
                            defaults={
                                'name': pkg_name,
                                'sku': f'{product.sku}-L{level}',
                                'barcode': f'590{random.randint(1000000000, 9999999999)}',
                                'unit': unit,
                                'ratio': Decimal(str(ratio)),
                                'custom_selling_price': sell_ttc,
                                'purchase_price_ht': buy_ht,
                                'purchase_price_ttc': buy_ht * Decimal('1.11'),
                                'price_mode': 'FIXED',
                                'is_default_purchase': (level == 2),
                                'is_default_sale': (level == 1),
                                'weight_kg': Decimal(str(round(0.33 * ratio, 2))),
                            }
                        )
                        pkg_count += 1
            self.stdout.write(f'  ✓ {pkg_count} packaging levels created')

            # ═══════════════════════════════════════
            # 10. MULTI-VARIANT PRODUCTS (Fragrances)
            # ═══════════════════════════════════════
            variant_families = [
                {
                    'parent_name': 'Dior Sauvage',
                    'brand': 'Dior', 'category': 'Fragrances', 'country': 'France',
                    'parfum': 'Woody', 'group': 'Eau de Parfum Collection',
                    'variants': [
                        {'suffix': 'EDT 50ml', 'attrs': ['Concentration:Eau de Toilette', 'Volume:50'], 'cost': 35, 'sell': 85},
                        {'suffix': 'EDT 100ml', 'attrs': ['Concentration:Eau de Toilette', 'Volume:100'], 'cost': 50, 'sell': 120},
                        {'suffix': 'EDP 60ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:50'], 'cost': 45, 'sell': 110},
                        {'suffix': 'EDP 100ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:100'], 'cost': 65, 'sell': 155},
                        {'suffix': 'Parfum 100ml', 'attrs': ['Concentration:Parfum', 'Volume:100'], 'cost': 90, 'sell': 220},
                    ],
                },
                {
                    'parent_name': 'Chanel No.5',
                    'brand': 'Chanel', 'category': 'Fragrances', 'country': 'France',
                    'parfum': 'Floral', 'group': None,
                    'variants': [
                        {'suffix': 'EDP 35ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:30'], 'cost': 40, 'sell': 95},
                        {'suffix': 'EDP 50ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:50'], 'cost': 55, 'sell': 130},
                        {'suffix': 'EDP 100ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:100'], 'cost': 75, 'sell': 180},
                        {'suffix': 'Parfum 30ml', 'attrs': ['Concentration:Parfum', 'Volume:30'], 'cost': 85, 'sell': 250},
                    ],
                },
                {
                    'parent_name': 'Tom Ford Oud Wood',
                    'brand': 'Tom Ford', 'category': 'Fragrances', 'country': 'Italy',
                    'parfum': 'Oriental', 'group': None,
                    'variants': [
                        {'suffix': 'EDP 30ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:30'], 'cost': 60, 'sell': 150},
                        {'suffix': 'EDP 50ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:50'], 'cost': 85, 'sell': 225},
                        {'suffix': 'EDP 100ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:100'], 'cost': 120, 'sell': 350},
                    ],
                },
                {
                    'parent_name': 'Hermès Terre d\'Hermès',
                    'brand': 'Hermès', 'category': 'Fragrances', 'country': 'France',
                    'parfum': 'Citrus', 'group': None,
                    'variants': [
                        {'suffix': 'EDT 50ml', 'attrs': ['Concentration:Eau de Toilette', 'Volume:50'], 'cost': 30, 'sell': 75},
                        {'suffix': 'EDT 100ml', 'attrs': ['Concentration:Eau de Toilette', 'Volume:100'], 'cost': 45, 'sell': 110},
                        {'suffix': 'EDP 75ml', 'attrs': ['Concentration:Eau de Parfum', 'Volume:75'], 'cost': 50, 'sell': 125},
                        {'suffix': 'Parfum 75ml', 'attrs': ['Concentration:Parfum', 'Volume:75'], 'cost': 70, 'sell': 180},
                    ],
                },
                {
                    'parent_name': 'Nike Air Max',
                    'brand': 'Nike', 'category': None, 'country': 'China',
                    'parfum': None, 'group': 'Sports Collection',
                    'variants': [
                        {'suffix': 'Black S', 'attrs': ['Color:Black', 'Size:S'], 'cost': 45, 'sell': 129},
                        {'suffix': 'Black M', 'attrs': ['Color:Black', 'Size:M'], 'cost': 45, 'sell': 129},
                        {'suffix': 'Black L', 'attrs': ['Color:Black', 'Size:L'], 'cost': 45, 'sell': 129},
                        {'suffix': 'White S', 'attrs': ['Color:White', 'Size:S'], 'cost': 45, 'sell': 129},
                        {'suffix': 'White M', 'attrs': ['Color:White', 'Size:M'], 'cost': 45, 'sell': 129},
                        {'suffix': 'White L', 'attrs': ['Color:White', 'Size:L'], 'cost': 45, 'sell': 129},
                        {'suffix': 'Red M', 'attrs': ['Color:Red', 'Size:M'], 'cost': 48, 'sell': 139},
                        {'suffix': 'Red L', 'attrs': ['Color:Red', 'Size:L'], 'cost': 48, 'sell': 139},
                    ],
                },
            ]
            variant_count = 0
            for family in variant_families:
                parent_sku = next_sku('VAR')
                parent = Product.objects.create(
                    sku=parent_sku, name=family['parent_name'],
                    base_name=family['parent_name'],
                    organization=org,
                    product_type='STANDARD',
                    is_parent=True,
                    brand=brands.get(family['brand']),
                    category=cats.get(family['category']) if family['category'] else None,
                    unit=units['PC'],
                    country_of_origin=ref_countries.get(family['country']),
                    parfum=parfums.get(family['parfum']) if family['parfum'] else None,
                    product_group=groups.get(family['group']) if family['group'] else None,
                    cost_price=Decimal('0'), selling_price_ttc=Decimal('0'),
                    tva_rate=Decimal('20'),
                    description=f'Parent variant group for {family["parent_name"]}',
                    min_stock_level=0, max_stock_level=0,
                )
                created_products[family['parent_name']] = parent

                for v in family['variants']:
                    child_sku = next_sku('VAR')
                    full_name = f"{family['parent_name']} {v['suffix']}"
                    tva = 20
                    cost = v['cost']
                    sell = v['sell']
                    child = Product.objects.create(
                        sku=child_sku, name=full_name,
                        base_name=family['parent_name'],
                        organization=org,
                        product_type='STANDARD',
                        parent_product=parent,
                        brand=brands.get(family['brand']),
                        category=cats.get(family['category']) if family['category'] else None,
                        unit=units['PC'],
                        country_of_origin=ref_countries.get(family['country']),
                        parfum=parfums.get(family['parfum']) if family['parfum'] else None,
                        product_group=groups.get(family['group']) if family['group'] else None,
                        cost_price=Decimal(str(cost)),
                        cost_price_ht=Decimal(str(round(cost / (1 + tva/100), 2))),
                        cost_price_ttc=Decimal(str(cost)),
                        selling_price_ht=Decimal(str(round(sell / (1 + tva/100), 2))),
                        selling_price_ttc=Decimal(str(sell)),
                        tva_rate=Decimal(str(tva)),
                        min_stock_level=random.randint(3, 10),
                        max_stock_level=random.randint(50, 200),
                        reorder_point=Decimal(str(random.randint(5, 15))),
                        reorder_quantity=Decimal(str(random.randint(20, 50))),
                        barcode=f'590{random.randint(1000000000, 9999999999)}',
                        description=f'{full_name} - variant of {family["parent_name"]}',
                    )
                    for ak in v['attrs']:
                        if ak in attr_values:
                            child.attribute_values.add(attr_values[ak])
                    created_products[full_name] = child
                    variant_count += 1
            self.stdout.write(f'  ✓ {len(variant_families)} variant families, {variant_count} child variants created')

            # ═══════════════════════════════════════
            # 11. COMBO / BUNDLE PRODUCTS
            # ═══════════════════════════════════════
            combos_data = [
                {
                    'name': 'Summer Beverage Bundle',
                    'brand': 'Coca-Cola', 'category': 'Soft Drinks', 'country': 'USA',
                    'cost': 1.50, 'sell': 2.99, 'tva': 11,
                    'components': [
                        ('Coca-Cola Classic 330ml', 2),
                        ('Pepsi Original 500ml', 1),
                        ('Nestlé Pure Life 500ml', 2),
                    ]
                },
                {
                    'name': 'Luxury Fragrance Discovery Set',
                    'brand': 'Dior', 'category': 'Fragrances', 'country': 'France',
                    'cost': 45, 'sell': 89.99, 'tva': 20,
                    'components': [
                        ('Dior Sauvage EDT 50ml', 1),
                        ('Chanel No.5 EDP 35ml', 1),
                    ]
                },
                {
                    'name': 'Family Snack Pack',
                    'brand': 'Danone', 'category': 'Dairy', 'country': 'France',
                    'cost': 2.50, 'sell': 4.99, 'tva': 5.5,
                    'components': [
                        ('Danone Activia Yogurt Strawberry', 2),
                        ('Danone Activia Yogurt Vanilla', 2),
                    ]
                },
                {
                    'name': 'Tech Starter Kit',
                    'brand': 'Samsung', 'category': 'Accessories', 'country': 'South Korea',
                    'cost': 18, 'sell': 49.99, 'tva': 20,
                    'components': [
                        ('Samsung USB-C Cable 1m', 1),
                        ('Samsung USB-C Cable 2m', 1),
                        ('Samsung Wireless Charger', 1),
                    ]
                },
                {
                    'name': 'Skincare Essentials Kit',
                    'brand': 'L\'Oréal', 'category': 'Skincare', 'country': 'France',
                    'cost': 22, 'sell': 49.99, 'tva': 20,
                    'components': [
                        ('L\'Oréal Revitalift Cream 50ml', 1),
                        ('L\'Oréal Revitalift Serum 30ml', 1),
                        ('Unilever Dove Soap Bar 100g', 2),
                    ]
                },
            ]
            combo_count = 0
            for combo in combos_data:
                sku = next_sku('CMB')
                tva = combo['tva']
                cost = combo['cost']
                sell = combo['sell']
                combo_product = Product.objects.create(
                    sku=sku, name=combo['name'],
                    base_name=combo['name'],
                    organization=org,
                    product_type='COMBO',
                    brand=brands.get(combo['brand']),
                    category=cats.get(combo['category']),
                    unit=units['PC'],
                    country_of_origin=ref_countries.get(combo['country']),
                    cost_price=Decimal(str(cost)),
                    cost_price_ht=Decimal(str(round(cost / (1 + tva/100), 2))),
                    cost_price_ttc=Decimal(str(cost)),
                    selling_price_ht=Decimal(str(round(sell / (1 + tva/100), 2))),
                    selling_price_ttc=Decimal(str(sell)),
                    tva_rate=Decimal(str(tva)),
                    min_stock_level=5,
                    max_stock_level=50,
                    barcode=f'590{random.randint(1000000000, 9999999999)}',
                    description=f'Combo bundle: {combo["name"]}',
                )
                created_products[combo['name']] = combo_product
                for comp_name, qty in combo['components']:
                    comp = created_products.get(comp_name)
                    if comp:
                        ComboComponent.objects.create(
                            combo_product=combo_product,
                            component_product=comp,
                            quantity=Decimal(str(qty)),
                            organization=org,
                        )
                combo_count += 1
            self.stdout.write(f'  ✓ {combo_count} combo/bundle products created')

            # ═══════════════════════════════════════
            # 12. SERVICE PRODUCTS
            # ═══════════════════════════════════════
            services_data = [
                ('Gift Wrapping Service', 'Household', None, 5, 0, 5.99),
                ('Express Delivery', 'Household', None, 20, 0, 9.99),
                ('Product Engraving', 'Cosmetics', 'Dior', 20, 0, 15.00),
            ]
            svc_count = 0
            for sname, cat_name, brand_name, tva, cost, sell in services_data:
                sku = next_sku('SVC')
                Product.objects.create(
                    sku=sku, name=sname,
                    base_name=sname,
                    organization=org,
                    product_type='SERVICE',
                    brand=brands.get(brand_name) if brand_name else None,
                    category=cats.get(cat_name) if cat_name else None,
                    unit=units['PC'],
                    cost_price=Decimal(str(cost)),
                    selling_price_ht=Decimal(str(round(sell / (1 + tva/100), 2))),
                    selling_price_ttc=Decimal(str(sell)),
                    tva_rate=Decimal(str(tva)),
                    description=f'Service: {sname}',
                )
                svc_count += 1
            self.stdout.write(f'  ✓ {svc_count} service products created')

            # ═══════════════════════════════════════
            # 13. WAREHOUSES (Branch → Store → Warehouse hierarchy)
            # ═══════════════════════════════════════
            from apps.inventory.models.warehouse_models import Warehouse, Inventory

            # Resolve default country for branches
            default_country = None
            try:
                from apps.reference.models import OrgCountry
                oc = OrgCountry.objects.filter(
                    organization=org, is_default=True, is_enabled=True
                ).select_related('country').first()
                if oc:
                    default_country = oc.country
            except Exception:
                pass
            if not default_country:
                default_country = RefCountry.objects.filter(iso2='CI').first()
                if not default_country:
                    default_country = RefCountry.objects.first()

            warehouses = {}

            # ── Branch 1: Main Branch ──
            branch1, _ = Warehouse.objects.get_or_create(
                code='BR-MAIN', organization=org,
                defaults={
                    'name': 'Siège Principal',
                    'location_type': 'BRANCH',
                    'address': '12 Avenue Chardy, Plateau',
                    'city': 'Abidjan',
                    'phone': '+225 27 20 33 44 55',
                    'country': default_country,
                    'can_sell': False,
                }
            )
            warehouses['Branch-Main'] = branch1

            store1, _ = Warehouse.objects.get_or_create(
                code='ST-CENTRAL', organization=org,
                defaults={
                    'name': 'Magasin Central',
                    'location_type': 'STORE',
                    'parent': branch1,
                    'address': '12 Avenue Chardy, RDC',
                    'city': 'Abidjan',
                    'can_sell': True,
                }
            )
            warehouses['Store-Central'] = store1

            wh1, _ = Warehouse.objects.get_or_create(
                code='WH-CENTRAL', organization=org,
                defaults={
                    'name': 'Entrepôt Central',
                    'location_type': 'WAREHOUSE',
                    'parent': branch1,
                    'address': 'Zone Industrielle, Yopougon',
                    'city': 'Abidjan',
                    'can_sell': False,
                }
            )
            warehouses['Warehouse-Central'] = wh1

            # ── Branch 2: Secondary Branch ──
            branch2, _ = Warehouse.objects.get_or_create(
                code='BR-SOUTH', organization=org,
                defaults={
                    'name': 'Succursale Sud',
                    'location_type': 'BRANCH',
                    'address': '45 Boulevard de la Paix',
                    'city': 'San-Pédro',
                    'phone': '+225 27 34 71 00 00',
                    'country': default_country,
                    'can_sell': False,
                }
            )
            warehouses['Branch-South'] = branch2

            store2, _ = Warehouse.objects.get_or_create(
                code='ST-SOUTH', organization=org,
                defaults={
                    'name': 'Point de Vente Sud',
                    'location_type': 'STORE',
                    'parent': branch2,
                    'address': '45 Boulevard de la Paix, RDC',
                    'city': 'San-Pédro',
                    'can_sell': True,
                }
            )
            warehouses['Store-South'] = store2

            wh2, _ = Warehouse.objects.get_or_create(
                code='WH-SOUTH', organization=org,
                defaults={
                    'name': 'Dépôt Sud',
                    'location_type': 'WAREHOUSE',
                    'parent': branch2,
                    'address': 'Zone Portuaire, San-Pédro',
                    'city': 'San-Pédro',
                    'can_sell': False,
                }
            )
            warehouses['Warehouse-South'] = wh2

            # ── Virtual Transit Warehouse ──
            wh_transit, _ = Warehouse.objects.get_or_create(
                code='VW-TRANSIT', organization=org,
                defaults={
                    'name': 'Transit Inter-Sites',
                    'location_type': 'VIRTUAL',
                    'parent': branch1,
                    'can_sell': False,
                }
            )
            warehouses['Virtual-Transit'] = wh_transit

            self.stdout.write(f'  ✓ {len(warehouses)} warehouses/locations ready')

            # ═══════════════════════════════════════
            # 14. INVENTORY STOCK (distribute products across warehouses)
            # ═══════════════════════════════════════
            stock_locations = [store1, wh1, store2, wh2]  # 4 physical locations
            inv_count = 0

            for prod_name, product in created_products.items():
                # Skip parent-only variant groups (no stock on parents)
                if product.is_parent:
                    continue
                # Skip SERVICE products (no physical stock)
                if product.product_type == 'SERVICE':
                    continue

                for loc in stock_locations:
                    # Realistic random quantities — main locations get more
                    if loc in [store1, wh1]:  # Main branch gets 60-300
                        qty = Decimal(str(random.randint(60, 300)))
                    else:  # South branch gets 20-150
                        qty = Decimal(str(random.randint(20, 150)))

                    # Stores get less stock than warehouses
                    if loc.location_type == 'STORE':
                        qty = (qty * Decimal('0.3')).quantize(Decimal('1'))

                    Inventory.objects.get_or_create(
                        warehouse=loc, product=product,
                        variant=None, organization=org,
                        defaults={
                            'quantity': qty,
                        }
                    )
                    inv_count += 1

            self.stdout.write(f'  ✓ {inv_count} inventory records created')

            # ═══════════════════════════════════════
            # SUMMARY
            # ═══════════════════════════════════════
            total = Product.original_objects.filter(organization=org).count()
            total_stock = Inventory.objects.filter(organization=org).count()
            self.stdout.write(self.style.SUCCESS(
                f'\n🎉 Demo seeding complete!\n'
                f'   Total products: {total}\n'
                f'   Standard: {len(standard_products)}\n'
                f'   Variant families: {len(variant_families)} ({variant_count} children)\n'
                f'   Combos: {combo_count}\n'
                f'   Services: {svc_count}\n'
                f'   Packaging levels: {pkg_count}\n'
                f'   Attribute groups: {len(attr_groups)}\n'
                f'   Attribute values: {len(attr_values)}\n'
                f'   Brands: {len(brands)}\n'
                f'   Categories: {len(cats)}\n'
                f'   Warehouses: {len(warehouses)}\n'
                f'   Inventory records: {total_stock}\n'
            ))
