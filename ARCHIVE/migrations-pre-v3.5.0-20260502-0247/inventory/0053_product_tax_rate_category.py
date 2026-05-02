# Generated manually — adds tax_rate_category FK to Product model
# See: apps/inventory/models/product_models.py

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0052_warehouse_tax_policy_and_sharing'),
        ('finance', '0056_tax_rate_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='tax_rate_category',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Per-product VAT rate override. When set, TaxCalculator.resolve_product_rate() uses "
                    "this category's rate instead of tva_rate. Enables multi-rate VAT regimes per product "
                    "(UK 20%/5%/0%, Indian GST 5%/12%/18%/28%, Moroccan TVA 7%/10%/14%/20%)."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='products',
                to='finance.taxratecategory',
            ),
        ),
        migrations.AlterField(
            model_name='product',
            name='tva_rate',
            field=models.DecimalField(
                decimal_places=2,
                default='0.00',
                help_text='VAT rate as a percentage (e.g. 18.00 = 18%). Legacy field — prefer tax_rate_category for multi-rate regimes.',
                max_digits=5,
            ),
        ),
    ]
