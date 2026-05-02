"""
Add requires_barcode field to ProductAttribute model.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0047_v3_attribute_nomenclature_and_product_basename'),
    ]

    operations = [
        migrations.AddField(
            model_name='productattribute',
            name='requires_barcode',
            field=models.BooleanField(
                default=False,
                help_text='Products with this attribute require individual barcodes and stock tracking'
            ),
        ),
    ]
