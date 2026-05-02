"""
POS app: Snapshot expansion for barcode governance (Phase 3).
Adds brand, UOM, and tax_code snapshot fields to OrderLine and PurchaseOrderLine.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0073_supplier_package_pricing'),
    ]

    operations = [
        # ── OrderLine: 3 new snapshot fields ──
        migrations.AddField(
            model_name='orderline',
            name='product_brand_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Brand name at time of sale — commercial traceability (immutable)'),
        ),
        migrations.AddField(
            model_name='orderline',
            name='product_uom_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Unit of measure at time of sale (immutable)'),
        ),
        migrations.AddField(
            model_name='orderline',
            name='product_tax_code_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Tax class/code at time of sale — not just rate (immutable)'),
        ),

        # ── PurchaseOrderLine: 3 new snapshot fields ──
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_brand_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Brand name at time of order — commercial traceability (immutable)'),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_uom_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Unit of measure at time of order (immutable)'),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_tax_code_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Tax class/code at time of order (immutable)'),
        ),
    ]
