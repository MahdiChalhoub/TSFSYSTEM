# Generated manually for Phase 2: Add supplier_declared_qty to PurchaseOrderLine

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0045_phase1_rename_ordered_to_sent'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseorderline',
            name='supplier_declared_qty',
            field=models.DecimalField(
                decimal_places=2,
                max_digits=15,
                null=True,
                blank=True,
                help_text='Quantity declared by supplier in BL/Proforma. None = not yet declared.',
            ),
        ),
    ]
