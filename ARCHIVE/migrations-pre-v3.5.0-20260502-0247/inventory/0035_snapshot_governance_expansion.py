"""
Inventory app: Snapshot expansion for barcode governance (Phase 3).
Adds product identity snapshots to GoodsReceiptLine, StockAdjustmentLine, StockTransferLine.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0034_barcode_governance_hardening'),
    ]

    operations = [
        # ── GoodsReceiptLine: 4 new snapshot fields ──
        migrations.AddField(
            model_name='goodsreceiptline',
            name='product_sku_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product SKU at time of receipt (immutable)'),
        ),
        migrations.AddField(
            model_name='goodsreceiptline',
            name='product_brand_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Brand name at time of receipt (immutable)'),
        ),
        migrations.AddField(
            model_name='goodsreceiptline',
            name='product_uom_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Unit of measure at time of receipt (immutable)'),
        ),
        migrations.AddField(
            model_name='goodsreceiptline',
            name='product_tax_code_snapshot',
            field=models.CharField(blank=True, max_length=50, null=True,
                help_text='Tax class/code at time of receipt (immutable)'),
        ),

        # ── StockAdjustmentLine: 3 new snapshot fields ──
        migrations.AddField(
            model_name='stockadjustmentline',
            name='product_name_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Product name at time of adjustment (immutable)'),
        ),
        migrations.AddField(
            model_name='stockadjustmentline',
            name='product_sku_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product SKU at time of adjustment (immutable)'),
        ),
        migrations.AddField(
            model_name='stockadjustmentline',
            name='product_barcode_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product barcode at time of adjustment (immutable)'),
        ),

        # ── StockTransferLine: 3 new snapshot fields ──
        migrations.AddField(
            model_name='stocktransferline',
            name='product_name_snapshot',
            field=models.CharField(blank=True, max_length=255, null=True,
                help_text='Product name at time of transfer (immutable)'),
        ),
        migrations.AddField(
            model_name='stocktransferline',
            name='product_sku_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product SKU at time of transfer (immutable)'),
        ),
        migrations.AddField(
            model_name='stocktransferline',
            name='product_barcode_snapshot',
            field=models.CharField(blank=True, max_length=100, null=True,
                help_text='Product barcode at time of transfer (immutable)'),
        ),
    ]
