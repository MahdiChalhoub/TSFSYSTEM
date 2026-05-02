"""
Migration 0072: Product-level snapshot fields on POS OrderLine and PurchaseOrderLine.

Freezes product name, SKU, and barcode at transaction time to prevent
retroactive distortion when product master data changes.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0071_possettings_balance_config'),
    ]

    operations = [
        # ── POS OrderLine product snapshots ──────────────────────────
        migrations.AddField(
            model_name='orderline',
            name='product_name_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Product name at time of sale (immutable)'),
        ),
        migrations.AddField(
            model_name='orderline',
            name='product_sku_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product SKU at time of sale (immutable)'),
        ),
        migrations.AddField(
            model_name='orderline',
            name='product_barcode_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product primary barcode at time of sale (immutable)'),
        ),

        # ── PurchaseOrderLine product snapshots ──────────────────────
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_name_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Product name at time of order (immutable)'),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_sku_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product SKU at time of order (immutable)'),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='product_barcode_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product primary barcode at time of order (immutable)'),
        ),
    ]
