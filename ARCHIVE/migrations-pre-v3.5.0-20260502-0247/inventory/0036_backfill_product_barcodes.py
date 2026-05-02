"""
Data migration: Backfill ProductBarcode from legacy Product.barcode and Packaging.barcode fields.

This MUST run before the resolver fallbacks are removed (already done in Phase 1).
It seeds PRIMARY ProductBarcode records from all existing legacy barcode fields,
ensuring POS scanning continues to work.

Strategy:
1. Seed from Product.barcode → ProductBarcode (type=PRIMARY, product-level)
2. Seed from ProductPackaging.barcode → ProductBarcode (type=PACKAGING, package-level)
3. Report duplicates as ALIAS (don't fail)
4. Log summary counts
"""
from django.db import migrations


def backfill_product_barcodes(apps, schema_editor):
    """Seed ProductBarcode from legacy Product.barcode and ProductPackaging.barcode."""
    Product = apps.get_model('inventory', 'Product')
    ProductPackaging = apps.get_model('inventory', 'ProductPackaging')
    ProductBarcode = apps.get_model('inventory', 'ProductBarcode')

    created_product = 0
    created_packaging = 0
    skipped_exists = 0
    skipped_empty = 0

    # ── 1. Seed from Product.barcode ──
    products_with_barcode = Product.objects.exclude(
        barcode__isnull=True
    ).exclude(barcode='')

    for product in products_with_barcode.iterator(chunk_size=500):
        # Skip if already exists in ProductBarcode
        if ProductBarcode.objects.filter(
            product=product,
            organization_id=product.organization_id,
            code=product.barcode,
            is_active=True,
        ).exists():
            skipped_exists += 1
            continue

        # Check for code collision in another product
        if ProductBarcode.objects.filter(
            organization_id=product.organization_id,
            code=product.barcode,
            is_active=True,
        ).exists():
            # Create as ALIAS to avoid unique constraint violation
            ProductBarcode.objects.create(
                organization_id=product.organization_id,
                product=product,
                code=product.barcode,
                barcode_type='ALIAS',
                source='MIGRATED',
                is_active=False,  # Inactive — duplicate
            )
            skipped_exists += 1
            continue

        # Check if a PRIMARY already exists for this product
        if ProductBarcode.objects.filter(
            product=product,
            organization_id=product.organization_id,
            barcode_type='PRIMARY',
            is_active=True,
            packaging__isnull=True,
        ).exists():
            # Already has a primary — create as ALIAS
            ProductBarcode.objects.create(
                organization_id=product.organization_id,
                product=product,
                code=product.barcode,
                barcode_type='ALIAS',
                source='MIGRATED',
                is_active=True,
            )
            created_product += 1
            continue

        ProductBarcode.objects.create(
            organization_id=product.organization_id,
            product=product,
            code=product.barcode,
            barcode_type='PRIMARY',
            source='MIGRATED',
            is_active=True,
        )
        created_product += 1

    # ── 2. Seed from ProductPackaging.barcode ──
    packagings_with_barcode = ProductPackaging.objects.exclude(
        barcode__isnull=True
    ).exclude(barcode='').select_related('product')

    for pkg in packagings_with_barcode.iterator(chunk_size=500):
        if not pkg.product_id:
            skipped_empty += 1
            continue

        # Skip if already exists
        if ProductBarcode.objects.filter(
            product_id=pkg.product_id,
            packaging=pkg,
            organization_id=pkg.organization_id,
            code=pkg.barcode,
            is_active=True,
        ).exists():
            skipped_exists += 1
            continue

        # Check for code collision
        if ProductBarcode.objects.filter(
            organization_id=pkg.organization_id,
            code=pkg.barcode,
            is_active=True,
        ).exists():
            ProductBarcode.objects.create(
                organization_id=pkg.organization_id,
                product_id=pkg.product_id,
                packaging=pkg,
                code=pkg.barcode,
                barcode_type='ALIAS',
                source='MIGRATED',
                is_active=False,
            )
            skipped_exists += 1
            continue

        # Check if a PRIMARY already exists for this packaging
        if ProductBarcode.objects.filter(
            packaging=pkg,
            organization_id=pkg.organization_id,
            barcode_type='PRIMARY',
            is_active=True,
        ).exists():
            ProductBarcode.objects.create(
                organization_id=pkg.organization_id,
                product_id=pkg.product_id,
                packaging=pkg,
                code=pkg.barcode,
                barcode_type='PACKAGING',
                source='MIGRATED',
                is_active=True,
            )
            created_packaging += 1
            continue

        ProductBarcode.objects.create(
            organization_id=pkg.organization_id,
            product_id=pkg.product_id,
            packaging=pkg,
            code=pkg.barcode,
            barcode_type='PACKAGING',
            source='MIGRATED',
            is_active=True,
        )
        created_packaging += 1

    print(f"[Backfill] ProductBarcode seeded: "
          f"{created_product} product-level, {created_packaging} packaging-level, "
          f"{skipped_exists} skipped (exists), {skipped_empty} skipped (empty)")


def reverse_backfill(apps, schema_editor):
    """Remove migrated entries only."""
    ProductBarcode = apps.get_model('inventory', 'ProductBarcode')
    deleted, _ = ProductBarcode.objects.filter(source='MIGRATED').delete()
    print(f"[Reverse backfill] Deleted {deleted} MIGRATED ProductBarcode records")


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0035_snapshot_governance_expansion'),
    ]

    operations = [
        migrations.RunPython(backfill_product_barcodes, reverse_backfill),
    ]
