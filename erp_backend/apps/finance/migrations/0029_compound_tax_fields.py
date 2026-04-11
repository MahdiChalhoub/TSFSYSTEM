# Generated manually for compound tax support
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0028_migrate_posting_rules_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='customtaxrule',
            name='tax_base_mode',
            field=models.CharField(
                choices=[
                    ('HT', 'Calculate on HT (pre-tax amount)'),
                    ('TTC', 'Calculate on running gross (HT + all prior taxes in calculation_order)'),
                    ('PREVIOUS_TAX', 'Calculate on a specific prior tax amount'),
                ],
                default='HT',
                help_text='What base to calculate this tax on (HT, TTC, or a prior tax amount)',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='customtaxrule',
            name='base_tax_type',
            field=models.CharField(
                blank=True,
                help_text='If PREVIOUS_TAX: which tax_type to use as base (e.g. VAT, AIRSI, PURCHASE_TAX, CUSTOM)',
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='customtaxrule',
            name='calculation_order',
            field=models.IntegerField(
                default=100,
                help_text='Deterministic priority (lower = earlier). Core taxes: VAT=10, AIRSI=20, PURCHASE_TAX=30. Custom default=100.',
            ),
        ),
        migrations.AddField(
            model_name='customtaxrule',
            name='compound_group',
            field=models.CharField(
                blank=True,
                help_text='Group tag for chained taxes (e.g. "brazil_composite", "india_gst")',
                max_length=50,
                null=True,
            ),
        ),
    ]
