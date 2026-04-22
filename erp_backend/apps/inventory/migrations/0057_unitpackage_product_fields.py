"""
Elevate UnitPackage to a first-class product-like entity.
Adds: barcode, selling_price, image_url, is_active.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0056_packaging_suggestion_rule'),
    ]

    operations = [
        migrations.AddField(
            model_name='unitpackage',
            name='barcode',
            field=models.CharField(
                blank=True, null=True, max_length=100,
                help_text='Optional barcode for this package template',
            ),
        ),
        migrations.AddField(
            model_name='unitpackage',
            name='selling_price',
            field=models.DecimalField(
                blank=True, null=True, max_digits=15, decimal_places=2,
                help_text='Default selling price for products adopting this package',
            ),
        ),
        migrations.AddField(
            model_name='unitpackage',
            name='image_url',
            field=models.CharField(blank=True, null=True, max_length=500),
        ),
        migrations.AddField(
            model_name='unitpackage',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='Inactive packages are hidden from product forms',
            ),
        ),
    ]
