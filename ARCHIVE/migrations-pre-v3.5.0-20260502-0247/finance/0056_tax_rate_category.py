# Generated manually for TaxRateCategory model
# See: apps/finance/models/tax_engine_ext.py

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0055_dynamic_form'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaxRateCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(
                    max_length=100,
                    help_text='e.g. "Standard Rate 18%", "Zero Rate"'
                )),
                ('rate', models.DecimalField(
                    max_digits=7, decimal_places=4,
                    help_text='VAT rate as decimal fraction (e.g. 0.18 for 18%)'
                )),
                ('country_code', models.CharField(
                    max_length=3, blank=True, default='',
                    help_text='ISO 3166-1 alpha-2 code — informational, not enforced'
                )),
                ('is_default', models.BooleanField(
                    default=False,
                    help_text='If True, this rate is used when no category is assigned to a product'
                )),
                ('description', models.CharField(max_length=300, blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True, blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True, blank=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                    db_column='organization_id',
                    null=True, blank=True,
                )),
            ],
            options={
                'db_table': 'tax_rate_category',
                'ordering': ['-is_default', 'name'],
                'verbose_name': 'Tax Rate Category',
                'verbose_name_plural': 'Tax Rate Categories',
                'unique_together': {('organization', 'name')},
            },
        ),
    ]
