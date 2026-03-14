# Generated manually for Phase 2 destination-based tax support
from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0029_compound_tax_fields'),
    ]

    operations = [
        # ── TaxJurisdictionRule (new model) ──────────────────────────
        migrations.CreateModel(
            name='TaxJurisdictionRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text="Descriptive name (e.g. 'Côte d\\'Ivoire Domestic VAT')", max_length=200)),
                ('country_code', models.CharField(db_index=True, help_text='ISO 3166-1 alpha-2/3 country code', max_length=3)),
                ('region_code', models.CharField(blank=True, help_text='State/province/region code for sub-national taxes', max_length=50, null=True)),
                ('tax_type', models.CharField(
                    choices=[('VAT', 'Value Added Tax'), ('SALES_TAX', 'Sales Tax'), ('GST', 'Goods & Services Tax'),
                             ('EXCISE', 'Excise Duty'), ('WITHHOLDING', 'Withholding Tax'), ('OTHER', 'Other')],
                    default='VAT', max_length=20)),
                ('rate', models.DecimalField(decimal_places=4, default=Decimal('0.0000'), help_text='Standard tax rate', max_digits=7)),
                ('place_of_supply_mode', models.CharField(
                    choices=[('ORIGIN', 'Tax based on seller location'), ('DESTINATION', 'Tax based on buyer/delivery location'),
                             ('REVERSE_CHARGE', 'Buyer self-assesses')],
                    default='ORIGIN', max_length=20)),
                ('reverse_charge_allowed', models.BooleanField(default=False)),
                ('zero_rate_export', models.BooleanField(default=True)),
                ('registration_threshold', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('priority', models.IntegerField(default=100)),
                ('is_active', models.BooleanField(default=True)),
                ('is_system_preset', models.BooleanField(default=False)),
                ('effective_from', models.DateField(blank=True, null=True)),
                ('effective_to', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('organization', models.ForeignKey(
                    blank=True, null=True, on_delete=models.deletion.CASCADE,
                    to='saas.organization', related_name='tax_jurisdiction_rules')),
            ],
            options={
                'db_table': 'tax_jurisdiction_rule',
                'ordering': ['-priority', 'country_code', 'region_code'],
            },
        ),
        migrations.AddIndex(
            model_name='taxjurisdictionrule',
            index=models.Index(fields=['country_code', 'region_code', 'tax_type'],
                               name='tax_juris_country_region_idx'),
        ),

        # ── CounterpartyTaxProfile: add state_code ───────────────────
        migrations.AddField(
            model_name='counterpartytaxprofile',
            name='state_code',
            field=models.CharField(blank=True, help_text='State/province/region code for sub-national taxes', max_length=50, null=True),
        ),
    ]
