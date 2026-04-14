# Migration for Product → COA link fields (Gap 2A.7)
# Adds revenue_account, cogs_account, inventory_account ForeignKeys to Product.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0001_initial'),
        ('inventory', '0050_einvoice_standard'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='revenue_account',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='revenue_products',
                to='finance.chartofaccount',
                help_text='Default revenue GL account for sales of this product',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='cogs_account',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cogs_products',
                to='finance.chartofaccount',
                help_text='Default COGS GL account for cost of goods sold',
            ),
        ),
        migrations.AddField(
            model_name='product',
            name='inventory_account',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inventory_products',
                to='finance.chartofaccount',
                help_text='Default inventory GL account for stock valuation',
            ),
        ),
    ]
