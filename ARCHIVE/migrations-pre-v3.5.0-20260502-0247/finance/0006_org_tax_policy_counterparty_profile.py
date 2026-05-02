"""
Migration 0006: Add OrgTaxPolicy and CounterpartyTaxProfile tables.
Also adds commercial_category and tax_profile_id to Contact.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_remove_financialaccount_linked_coa_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrgTaxPolicy',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    db_column='organization_id',
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                )),
                ('name', models.CharField(max_length=150)),
                ('is_default', models.BooleanField(default=False)),
                ('country_code', models.CharField(default='CI', max_length=3)),
                ('currency_code', models.CharField(default='XOF', max_length=3)),
                # VAT
                ('vat_output_enabled', models.BooleanField(default=True)),
                ('vat_input_recoverability', models.DecimalField(
                    decimal_places=3, default='1.000', max_digits=4
                )),
                # AIRSI
                ('airsi_treatment', models.CharField(
                    choices=[('CAPITALIZE', 'Capitalize'), ('RECOVER', 'Recover'), ('EXPENSE', 'Expense')],
                    default='CAPITALIZE', max_length=12
                )),
                # Purchase Tax
                ('purchase_tax_rate', models.DecimalField(
                    decimal_places=4, default='0.0000', max_digits=5
                )),
                ('purchase_tax_mode', models.CharField(
                    choices=[('CAPITALIZE', 'Capitalize'), ('EXPENSE', 'Expense')],
                    default='CAPITALIZE', max_length=12
                )),
                # Sales / Turnover Tax
                ('sales_tax_rate', models.DecimalField(
                    decimal_places=4, default='0.0000', max_digits=5
                )),
                ('sales_tax_trigger', models.CharField(
                    choices=[('ON_TURNOVER', 'On Turnover'), ('ON_PROFIT', 'On Profit')],
                    default='ON_TURNOVER', max_length=12
                )),
                # Periodic
                ('periodic_amount', models.DecimalField(
                    decimal_places=2, default='0.00', max_digits=15
                )),
                ('periodic_interval', models.CharField(
                    choices=[('MONTHLY', 'Monthly'), ('ANNUAL', 'Annual')],
                    default='ANNUAL', max_length=10
                )),
                # Profit Tax
                ('profit_tax_mode', models.CharField(
                    choices=[('STANDARD', 'Standard'), ('FORFAIT', 'Forfait'), ('EXEMPT', 'Exempt')],
                    default='STANDARD', max_length=10
                )),
                # Scope
                ('allowed_scopes', models.JSONField(default=list)),
                ('internal_cost_mode', models.CharField(
                    choices=[
                        ('TTC_ALWAYS', 'TTC Always'),
                        ('SAME_AS_OFFICIAL', 'Same As Official'),
                        ('CUSTOM', 'Custom'),
                    ],
                    default='TTC_ALWAYS', max_length=20
                )),
                # Audit
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
            ],
            options={'db_table': 'org_tax_policy', 'ordering': ['-is_default', 'name']},
        ),

        migrations.CreateModel(
            name='CounterpartyTaxProfile',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    db_column='organization_id',
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                    null=True, blank=True,
                )),
                ('name', models.CharField(max_length=150)),
                ('country_code', models.CharField(default='CI', max_length=3)),
                ('vat_registered', models.BooleanField(default=True)),
                ('reverse_charge', models.BooleanField(default=False)),
                ('airsi_subject', models.BooleanField(default=False)),
                ('allowed_scopes', models.JSONField(default=list)),
                ('is_system_preset', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
            ],
            options={'db_table': 'counterparty_tax_profile', 'ordering': ['name']},
        ),

        migrations.AlterUniqueTogether(
            name='orgtaxpolicy',
            unique_together={('name', 'organization')},
        ),

    ]
