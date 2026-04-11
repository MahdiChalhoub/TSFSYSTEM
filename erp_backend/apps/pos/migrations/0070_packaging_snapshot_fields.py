"""
Add package snapshot fields to OrderLine and PurchaseOrderLine.
These freeze package context at transaction time for historical integrity.
"""
from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0069_orderline_purchaseorderline_packaging'),
    ]

    operations = [
        # ── POS OrderLine Snapshots ──
        migrations.AddField(
            model_name='orderline',
            name='packaging_name_snapshot',
            field=models.CharField(
                max_length=200, null=True, blank=True,
                help_text='Package display name at time of sale (immutable after creation)',
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='packaging_barcode_snapshot',
            field=models.CharField(
                max_length=100, null=True, blank=True,
                help_text='Package barcode at time of sale (immutable after creation)',
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='packaging_ratio_snapshot',
            field=models.DecimalField(
                max_digits=15, decimal_places=4, null=True, blank=True,
                help_text='Qty in base units at time of sale (immutable after creation)',
            ),
        ),

        # ── PurchaseOrderLine Snapshots ──
        migrations.AddField(
            model_name='purchaseorderline',
            name='packaging_name_snapshot',
            field=models.CharField(
                max_length=200, null=True, blank=True,
                help_text='Package display name at time of order (immutable after creation)',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='packaging_barcode_snapshot',
            field=models.CharField(
                max_length=100, null=True, blank=True,
                help_text='Package barcode at time of order (immutable after creation)',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='packaging_ratio_snapshot',
            field=models.DecimalField(
                max_digits=15, decimal_places=4, null=True, blank=True,
                help_text='Qty in base units at time of order (immutable after creation)',
            ),
        ),
    ]
