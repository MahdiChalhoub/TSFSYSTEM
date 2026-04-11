"""
Seed demo data for InventoryGroup + ProductGroup pages.
Creates products if needed, then groups them.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.inventory.models import Product
from apps.inventory.models.grouping_models import InventoryGroup, InventoryGroupMember
from apps.inventory.models.product_models import ProductGroup
from erp.models import Organization


# ── Demo Products (if DB is empty) ──────────────────────────────────────
DEMO_PRODUCTS = [
    {'name': 'Persil Detergent Small (Turkey)', 'sku': 'DET-PERSIL-SM-TR', 'cost': '3.50', 'sell_ht': '5.00', 'sell_ttc': '5.50'},
    {'name': 'Persil Detergent Small (France)', 'sku': 'DET-PERSIL-SM-FR', 'cost': '4.20', 'sell_ht': '6.00', 'sell_ttc': '6.60'},
    {'name': 'Persil Detergent Small (Lebanon)', 'sku': 'DET-PERSIL-SM-LB', 'cost': '3.80', 'sell_ht': '5.50', 'sell_ttc': '6.05'},
    {'name': 'Persil Detergent Large (Turkey)', 'sku': 'DET-PERSIL-LG-TR', 'cost': '8.00', 'sell_ht': '11.00', 'sell_ttc': '12.10'},
    {'name': 'Persil Detergent Large (France)', 'sku': 'DET-PERSIL-LG-FR', 'cost': '9.50', 'sell_ht': '13.00', 'sell_ttc': '14.30'},
    {'name': 'Basmati Rice 5kg (India)', 'sku': 'RICE-BAS-5KG-IN', 'cost': '6.00', 'sell_ht': '8.50', 'sell_ttc': '9.35'},
    {'name': 'Basmati Rice 5kg (Pakistan)', 'sku': 'RICE-BAS-5KG-PK', 'cost': '5.20', 'sell_ht': '7.80', 'sell_ttc': '8.58'},
    {'name': 'Long Grain Rice 5kg (Thailand)', 'sku': 'RICE-LG-5KG-TH', 'cost': '4.50', 'sell_ht': '6.50', 'sell_ttc': '7.15'},
    {'name': 'Jasmine Rice 5kg (Vietnam)', 'sku': 'RICE-JAS-5KG-VN', 'cost': '5.80', 'sell_ht': '8.00', 'sell_ttc': '8.80'},
    {'name': 'Extra Virgin Olive Oil 1L (Tunisia)', 'sku': 'OIL-EV-1L-TN', 'cost': '7.00', 'sell_ht': '10.50', 'sell_ttc': '11.55'},
    {'name': 'Extra Virgin Olive Oil 1L (Spain)', 'sku': 'OIL-EV-1L-ES', 'cost': '8.50', 'sell_ht': '12.00', 'sell_ttc': '13.20'},
    {'name': 'Extra Virgin Olive Oil 1L (Italy)', 'sku': 'OIL-EV-1L-IT', 'cost': '9.20', 'sell_ht': '13.00', 'sell_ttc': '14.30'},
    {'name': 'Pure Olive Oil 1L (Turkey)', 'sku': 'OIL-PURE-1L-TR', 'cost': '5.00', 'sell_ht': '7.50', 'sell_ttc': '8.25'},
    {'name': 'Evian Natural Water 1.5L', 'sku': 'WATER-EVIAN-1.5L', 'cost': '0.80', 'sell_ht': '1.50', 'sell_ttc': '1.65'},
    {'name': 'Volvic Natural Water 1.5L', 'sku': 'WATER-VOLV-1.5L', 'cost': '0.75', 'sell_ht': '1.40', 'sell_ttc': '1.54'},
    {'name': 'Evian Natural Water 500ml', 'sku': 'WATER-EVIAN-500', 'cost': '0.40', 'sell_ht': '0.80', 'sell_ttc': '0.88'},
    {'name': 'Sparkling Water San Pellegrino 1L', 'sku': 'WATER-SP-1L', 'cost': '1.20', 'sell_ht': '2.00', 'sell_ttc': '2.20'},
    {'name': 'Barilla Spaghetti 500g', 'sku': 'PASTA-BAR-500', 'cost': '1.50', 'sell_ht': '2.50', 'sell_ttc': '2.75'},
    {'name': 'Barilla Penne 500g', 'sku': 'PASTA-BAR-PEN-500', 'cost': '1.50', 'sell_ht': '2.50', 'sell_ttc': '2.75'},
    {'name': 'De Cecco Fusilli 500g', 'sku': 'PASTA-DC-FUS-500', 'cost': '1.80', 'sell_ht': '3.00', 'sell_ttc': '3.30'},
    {'name': 'Indomie Noodles Pack x5', 'sku': 'NOODLE-INDO-5PK', 'cost': '2.00', 'sell_ht': '3.50', 'sell_ttc': '3.85'},
    {'name': 'Nescafe Gold 200g', 'sku': 'COFFEE-NESCAFE-200', 'cost': '8.00', 'sell_ht': '12.00', 'sell_ttc': '13.20'},
    {'name': 'Lipton Yellow Label 100 bags', 'sku': 'TEA-LIPTON-100', 'cost': '4.50', 'sell_ht': '7.00', 'sell_ttc': '7.70'},
    {'name': 'Nutella 750g', 'sku': 'SPREAD-NUT-750', 'cost': '5.50', 'sell_ht': '8.50', 'sell_ttc': '9.35'},
    {'name': 'Heinz Ketchup 500ml', 'sku': 'SAUCE-HEINZ-500', 'cost': '2.80', 'sell_ht': '4.20', 'sell_ttc': '4.62'},
]

# ── Inventory Group definitions (substitution intelligence) ─────────────
INV_GROUPS = [
    {
        'name': 'Persil Small Format',
        'group_type': 'EXACT',
        'commercial_size_label': 'Small',
        'description': 'Same detergent product from Turkey, France, and Lebanon — track cheapest source and aggregate stock.',
        'members': [
            ('DET-PERSIL-SM-TR', 'PRIMARY', 1),
            ('DET-PERSIL-SM-FR', 'TWIN', 5),
            ('DET-PERSIL-SM-LB', 'TWIN', 10),
        ]
    },
    {
        'name': 'Persil Large Format',
        'group_type': 'EXACT',
        'commercial_size_label': 'Large',
        'description': 'Large format Persil from Turkey and France.',
        'members': [
            ('DET-PERSIL-LG-TR', 'PRIMARY', 1),
            ('DET-PERSIL-LG-FR', 'TWIN', 5),
        ]
    },
    {
        'name': 'Rice 5kg Equivalent',
        'group_type': 'SIMILAR',
        'commercial_size_label': '5kg',
        'description': 'All 5kg rice bags — interchangeable for stock coverage.',
        'members': [
            ('RICE-BAS-5KG-IN', 'PRIMARY', 1),
            ('RICE-BAS-5KG-PK', 'TWIN', 5),
            ('RICE-LG-5KG-TH', 'SUBSTITUTE', 10),
            ('RICE-JAS-5KG-VN', 'SUBSTITUTE', 15),
        ]
    },
    {
        'name': 'Olive Oil 1L',
        'group_type': 'SIMILAR',
        'commercial_size_label': '1L',
        'description': 'Interchangeable 1L olive oil bottles.',
        'members': [
            ('OIL-EV-1L-TN', 'PRIMARY', 1),
            ('OIL-EV-1L-ES', 'TWIN', 5),
            ('OIL-EV-1L-IT', 'TWIN', 10),
            ('OIL-PURE-1L-TR', 'SUBSTITUTE', 20),
        ]
    },
    {
        'name': 'Bottled Water Family',
        'group_type': 'FAMILY',
        'commercial_size_label': None,
        'description': 'All bottled water products for analytics dashboards.',
        'members': [
            ('WATER-EVIAN-1.5L', 'PRIMARY', 1),
            ('WATER-VOLV-1.5L', 'TWIN', 5),
            ('WATER-EVIAN-500', 'NOT_SUB', 10),
            ('WATER-SP-1L', 'NOT_SUB', 15),
        ]
    },
    {
        'name': 'Pasta & Noodles',
        'group_type': 'FAMILY',
        'commercial_size_label': None,
        'description': 'Pasta and noodle product family for volume analytics.',
        'members': [
            ('PASTA-BAR-500', 'PRIMARY', 1),
            ('PASTA-BAR-PEN-500', 'TWIN', 5),
            ('PASTA-DC-FUS-500', 'SUBSTITUTE', 10),
            ('NOODLE-INDO-5PK', 'NOT_SUB', 20),
        ]
    },
]

# ── Pricing Group definitions (price synchronization) ───────────────────
PRICE_GROUPS = [
    {
        'name': 'Premium Imported Goods',
        'pricing_mode': 'MANUAL',
        'margin_floor_pct': 25.0,
        'max_discount_pct': 10.0,
        'rounding_rule': 'NEAREST_50',
        'override_policy': 'WARN',
        'product_skus': ['OIL-EV-1L-IT', 'OIL-EV-1L-ES', 'COFFEE-NESCAFE-200', 'SPREAD-NUT-750'],
    },
    {
        'name': 'Daily Essentials',
        'pricing_mode': 'SYNC_COST_PLUS',
        'margin_floor_pct': 15.0,
        'max_discount_pct': 5.0,
        'rounding_rule': 'NEAREST_100',
        'override_policy': 'BLOCK',
        'product_skus': ['RICE-BAS-5KG-IN', 'RICE-BAS-5KG-PK', 'PASTA-BAR-500', 'PASTA-BAR-PEN-500', 'OIL-PURE-1L-TR', 'SAUCE-HEINZ-500'],
    },
    {
        'name': 'Seasonal Promotions',
        'pricing_mode': 'MANUAL',
        'margin_floor_pct': 5.0,
        'max_discount_pct': 30.0,
        'rounding_rule': 'NONE',
        'override_policy': 'ALLOW',
        'product_skus': ['DET-PERSIL-SM-TR', 'DET-PERSIL-LG-TR', 'TEA-LIPTON-100'],
    },
    {
        'name': 'Beverages & Water',
        'pricing_mode': 'SYNC_COST_PLUS',
        'margin_floor_pct': 20.0,
        'max_discount_pct': 15.0,
        'rounding_rule': 'NEAREST_50',
        'override_policy': 'WARN',
        'product_skus': ['WATER-EVIAN-1.5L', 'WATER-VOLV-1.5L', 'WATER-EVIAN-500', 'WATER-SP-1L'],
    },
]


class Command(BaseCommand):
    help = 'Seed demo data for InventoryGroup and ProductGroup pages.'

    def add_arguments(self, parser):
        parser.add_argument('--org-slug', type=str, default='tsf-global',
                            help='Organization slug (default: tsf-global)')
        parser.add_argument('--clear', action='store_true',
                            help='Clear existing demo groups before seeding.')

    @transaction.atomic
    def handle(self, *args, **options):
        slug = options.get('org_slug', 'tsf-global')
        clear = options.get('clear', False)

        # Resolve org
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            org = Organization.objects.first()
            if not org:
                self.stderr.write('❌ No organization found.')
                return
            self.stdout.write(f'⚠️  Slug "{slug}" not found, using {org.name}')

        self.stdout.write(f'🏢 Organization: {org.name} (ID: {org.id})')

        # Set tenant context so AuditLogMixin / ConnectorLog picks up the right org
        from kernel.tenancy.context import set_current_tenant
        set_current_tenant(org)

        # ── Create demo products if needed ──────────────────────────
        existing = Product.all_objects.filter(organization=org).count()
        self.stdout.write(f'📦 Existing products: {existing}')

        if existing < 10:
            self.stdout.write('🛒 Creating demo products...')
            for pdef in DEMO_PRODUCTS:
                Product.objects.update_or_create(
                    sku=pdef['sku'],
                    organization=org,
                    defaults={
                        'name': pdef['name'],
                        'cost_price': Decimal(pdef['cost']),
                        'selling_price_ht': Decimal(pdef['sell_ht']),
                        'selling_price_ttc': Decimal(pdef['sell_ttc']),
                        'is_active': True,
                    }
                )
            self.stdout.write(f'  ✅ Seeded {len(DEMO_PRODUCTS)} products')

        # Build SKU → product map
        sku_map = {p.sku: p for p in Product.all_objects.filter(organization=org) if p.sku}
        self.stdout.write(f'🗺️  SKU map: {len(sku_map)} entries')

        if clear:
            InventoryGroup.objects.filter(organization=org).delete()
            ProductGroup.objects.filter(organization=org).delete()
            self.stdout.write('🧹 Cleared existing groups.')

        # ── Seed Inventory Groups ──────────────────────────────────
        for grp_def in INV_GROUPS:
            grp, created = InventoryGroup.objects.update_or_create(
                name=grp_def['name'],
                organization=org,
                defaults={
                    'group_type': grp_def['group_type'],
                    'commercial_size_label': grp_def.get('commercial_size_label'),
                    'description': grp_def.get('description', ''),
                    'is_active': True,
                }
            )
            status = '✅ Created' if created else '🔄 Updated'
            self.stdout.write(f'  {status} InventoryGroup: {grp.name}')

            for sku, role, priority in grp_def['members']:
                product = sku_map.get(sku)
                if not product:
                    self.stdout.write(f'    ⚠️  SKU {sku} not found, skipping')
                    continue
                _m, mc = InventoryGroupMember.objects.update_or_create(
                    group=grp, product=product, organization=org,
                    defaults={
                        'substitution_role': role,
                        'substitution_priority': priority,
                        'is_active': True,
                    }
                )
                if mc:
                    self.stdout.write(f'    + {product.name} as {role}')

        # ── Seed Pricing Groups ──────────────────────────────────
        for pg_def in PRICE_GROUPS:
            pg, created = ProductGroup.objects.update_or_create(
                name=pg_def['name'],
                organization=org,
                defaults={
                    'pricing_mode': pg_def.get('pricing_mode', 'MANUAL'),
                    'margin_floor_pct': pg_def.get('margin_floor_pct'),
                    'max_discount_pct': pg_def.get('max_discount_pct'),
                    'rounding_rule': pg_def.get('rounding_rule', 'NONE'),
                    'override_policy': pg_def.get('override_policy', 'WARN'),
                }
            )
            status = '✅ Created' if created else '🔄 Updated'
            self.stdout.write(f'  {status} PricingGroup: {pg.name}')

            for sku in pg_def.get('product_skus', []):
                product = sku_map.get(sku)
                if not product:
                    self.stdout.write(f'    ⚠️  SKU {sku} not found, skipping')
                    continue
                product.product_group = pg
                product.save(update_fields=['product_group'])
                self.stdout.write(f'    + Linked {product.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Done! Seeded 6 InventoryGroups + 4 ProductGroups with real products.'
        ))
