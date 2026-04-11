"""
Wire packaging into transaction lines.
Adds packaging FK, packaging_qty, and base_qty to both
POS OrderLine and PurchaseOrderLine.
"""
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0068_add_security_rules_to_pos_settings'),
        ('inventory', '0023_productpackaging_first_class'),
    ]

    operations = [
        # ── POS OrderLine ──
        migrations.AddField(
            model_name='orderline',
            name='packaging',
            field=models.ForeignKey(
                to='inventory.ProductPackaging',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True, blank=True,
                related_name='order_lines',
                help_text='If set, this line was sold in a specific packaging level (e.g. Carton)',
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='packaging_qty',
            field=models.DecimalField(
                max_digits=12, decimal_places=3, null=True, blank=True,
                help_text='Quantity in packaging units (e.g. 2 cartons)',
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='base_qty',
            field=models.DecimalField(
                max_digits=12, decimal_places=3, null=True, blank=True,
                help_text='Auto-calculated: packaging_qty × ratio (actual stock units deducted)',
            ),
        ),

        # ── PurchaseOrderLine ──
        migrations.AddField(
            model_name='purchaseorderline',
            name='packaging',
            field=models.ForeignKey(
                to='inventory.ProductPackaging',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True, blank=True,
                related_name='purchase_lines',
                help_text='If set, this line was ordered in a specific packaging level (e.g. Carton of 24)',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='packaging_qty',
            field=models.DecimalField(
                max_digits=15, decimal_places=2, null=True, blank=True,
                help_text='Quantity in packaging units (e.g. 10 cartons)',
            ),
        ),
        migrations.AddField(
            model_name='purchaseorderline',
            name='base_qty',
            field=models.DecimalField(
                max_digits=15, decimal_places=2, null=True, blank=True,
                help_text='Auto-calculated: packaging_qty × ratio (e.g. 10 × 24 = 240 pieces for stock)',
            ),
        ),
    ]
