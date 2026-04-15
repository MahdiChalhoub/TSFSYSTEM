"""
Inject Stock — Populate inventory for EXISTING products across warehouses
=========================================================================
Distributes realistic stock quantities across all existing physical
warehouses (STORE + WAREHOUSE) for every active, stockable product.

- Skips SERVICE products (no physical stock)
- Skips parent-only variant groups (is_parent=True, no direct stock)
- Stores get ~30% of warehouse quantities (realistic retail pattern)
- Fully idempotent — uses get_or_create, safe to re-run

Usage:
  python manage.py inject_stock
  python manage.py inject_stock --org-id 5
"""
import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Inject realistic stock quantities for existing products into existing warehouses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--org-id', type=int, default=None,
            help='Organization ID to inject stock for (default: first org)'
        )
        parser.add_argument(
            '--min-qty', type=int, default=20,
            help='Minimum stock quantity for warehouses (default: 20)'
        )
        parser.add_argument(
            '--max-qty', type=int, default=300,
            help='Maximum stock quantity for warehouses (default: 300)'
        )

    def handle(self, *args, **options):
        from erp.models import Organization
        from apps.inventory.models.product_models import Product
        from apps.inventory.models.warehouse_models import Warehouse, Inventory

        # ── Resolve org ──
        org_id = options.get('org_id')
        if org_id:
            org = Organization.objects.filter(id=org_id).first()
        else:
            org = Organization.objects.first()

        if not org:
            self.stderr.write(self.style.ERROR('No organization found.'))
            return

        self.stdout.write(f'🏭 Injecting stock for: {org.name} (id={org.id})')

        min_qty = options['min_qty']
        max_qty = options['max_qty']

        # ── Get stockable products ──
        products = Product.objects.filter(
            organization=org,
            is_active=True,
        ).exclude(
            product_type='SERVICE'
        ).exclude(
            is_parent=True
        )
        total_products = products.count()
        self.stdout.write(f'  📦 Found {total_products} stockable products')

        # ── Get physical warehouses (STORE + WAREHOUSE only) ──
        stock_locations = Warehouse.objects.filter(
            organization=org,
            is_active=True,
            location_type__in=['STORE', 'WAREHOUSE'],
        )
        total_locations = stock_locations.count()
        self.stdout.write(f'  🏬 Found {total_locations} stock locations')

        if total_products == 0:
            self.stderr.write(self.style.WARNING('No stockable products found.'))
            return
        if total_locations == 0:
            self.stderr.write(self.style.WARNING('No stock locations found.'))
            return

        # ── Inject stock ──
        created = 0
        skipped = 0

        with transaction.atomic():
            for product in products.iterator():
                for loc in stock_locations:
                    # Warehouses get full quantity range
                    qty = Decimal(str(random.randint(min_qty, max_qty)))

                    # Stores get less stock than warehouses (retail pattern)
                    if loc.location_type == 'STORE':
                        qty = (qty * Decimal('0.3')).quantize(Decimal('1'))
                        qty = max(qty, Decimal('5'))  # minimum 5 units in store

                    _, was_created = Inventory.objects.get_or_create(
                        warehouse=loc,
                        product=product,
                        variant=None,
                        organization=org,
                        defaults={
                            'quantity': qty,
                        }
                    )
                    if was_created:
                        created += 1
                    else:
                        skipped += 1

        # ── Summary ──
        total_inv = Inventory.objects.filter(organization=org).count()
        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 Stock injection complete!\n'
            f'   Products processed: {total_products}\n'
            f'   Stock locations: {total_locations}\n'
            f'   Inventory records created: {created}\n'
            f'   Already existed (skipped): {skipped}\n'
            f'   Total inventory records: {total_inv}\n'
        ))
