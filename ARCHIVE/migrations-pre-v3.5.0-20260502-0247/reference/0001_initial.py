"""
Initial migration for the Reference Master Data module.
Creates: ref_countries, ref_currencies, ref_country_currency_map,
         ref_org_countries, ref_org_currencies
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('erp', '0001_initial'),
    ]

    operations = [
        # 1. Currency (must come before Country because Country references Currency)
        migrations.CreateModel(
            name='Currency',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, help_text='ISO 4217 alpha code (e.g., USD, EUR, XOF)', max_length=3, unique=True)),
                ('numeric_code', models.CharField(blank=True, default='', help_text='ISO 4217 numeric code (e.g., 840, 978, 952)', max_length=3)),
                ('name', models.CharField(help_text='Currency name (e.g., US Dollar, Euro)', max_length=255)),
                ('symbol', models.CharField(blank=True, default='', help_text='Currency symbol (e.g., $, €, £)', max_length=10)),
                ('minor_unit', models.PositiveSmallIntegerField(default=2, help_text='Number of decimal places (e.g., 2 for USD, 0 for JPY, 3 for BHD)')),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Currency',
                'verbose_name_plural': 'Currencies',
                'db_table': 'ref_currencies',
                'ordering': ['code'],
            },
        ),
        # 2. Country (with FK to Currency)
        migrations.CreateModel(
            name='Country',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('iso2', models.CharField(db_index=True, help_text='ISO 3166-1 alpha-2 code (e.g., US, FR, LB)', max_length=2, unique=True)),
                ('iso3', models.CharField(db_index=True, help_text='ISO 3166-1 alpha-3 code (e.g., USA, FRA, LBN)', max_length=3, unique=True)),
                ('numeric_code', models.CharField(blank=True, default='', help_text='ISO 3166-1 numeric code (e.g., 840, 250, 422)', max_length=3)),
                ('name', models.CharField(help_text='Common English name', max_length=255)),
                ('official_name', models.CharField(blank=True, default='', help_text='Official state name (e.g., Republic of Lebanon)', max_length=255)),
                ('phone_code', models.CharField(blank=True, default='', help_text='International dialing code (e.g., +1, +33, +961)', max_length=20)),
                ('region', models.CharField(blank=True, default='', help_text='Geographic region (e.g., Americas, Europe, Asia)', max_length=100)),
                ('subregion', models.CharField(blank=True, default='', help_text='Geographic subregion (e.g., Northern America, Western Europe)', max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('default_currency', models.ForeignKey(blank=True, help_text='Primary/default currency for this country', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='default_for_countries', to='reference.currency')),
            ],
            options={
                'verbose_name': 'Country',
                'verbose_name_plural': 'Countries',
                'db_table': 'ref_countries',
                'ordering': ['name'],
            },
        ),
        # 3. CountryCurrencyMap
        migrations.CreateModel(
            name='CountryCurrencyMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_primary', models.BooleanField(default=False, help_text='Primary currency for this country')),
                ('is_active', models.BooleanField(default=True)),
                ('country', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='currency_mappings', to='reference.country')),
                ('currency', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='country_mappings', to='reference.currency')),
            ],
            options={
                'db_table': 'ref_country_currency_map',
                'ordering': ['country__name', '-is_primary'],
                'unique_together': {('country', 'currency')},
            },
        ),
        # 4. OrgCountry (tenant-scoped)
        migrations.CreateModel(
            name='OrgCountry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=True)),
                ('is_default', models.BooleanField(default=False, help_text='Default/base country for this organization')),
                ('display_order', models.PositiveIntegerField(default=0)),
                ('country', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='org_activations', to='reference.country')),
                ('organization', models.ForeignKey(blank=True, db_column='tenant_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reference_orgcountry_v2_set', to='erp.organization')),
            ],
            options={
                'db_table': 'ref_org_countries',
                'ordering': ['-is_default', 'display_order', 'country__name'],
                'unique_together': {('organization', 'country')},
            },
        ),
        migrations.AddIndex(
            model_name='orgcountry',
            index=models.Index(fields=['organization', 'is_enabled'], name='ref_org_cou_tenant__6f4b2e_idx'),
        ),
        # 5. OrgCurrency (tenant-scoped)
        migrations.CreateModel(
            name='OrgCurrency',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=True)),
                ('is_default', models.BooleanField(default=False, help_text='Base/functional currency for this organization')),
                ('display_order', models.PositiveIntegerField(default=0)),
                ('exchange_rate_source', models.CharField(blank=True, choices=[('MANUAL', 'Manual Entry'), ('ECB', 'European Central Bank'), ('BCEAO', 'BCEAO (West Africa)'), ('IMPORT', 'Imported'), ('API', 'External API')], default='MANUAL', help_text='Default exchange rate source for this currency', max_length=50)),
                ('is_reporting_currency', models.BooleanField(default=False, help_text='Used for consolidated reporting')),
                ('is_transaction_currency', models.BooleanField(default=True, help_text='Allowed in transactional documents (invoices, POs, payments)')),
                ('currency', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='org_activations', to='reference.currency')),
                ('organization', models.ForeignKey(blank=True, db_column='tenant_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reference_orgcurrency_v2_set', to='erp.organization')),
            ],
            options={
                'db_table': 'ref_org_currencies',
                'ordering': ['-is_default', 'display_order', 'currency__code'],
                'unique_together': {('organization', 'currency')},
            },
        ),
        migrations.AddIndex(
            model_name='orgcurrency',
            index=models.Index(fields=['organization', 'is_enabled'], name='ref_org_cur_tenant__a3c1de_idx'),
        ),
    ]
