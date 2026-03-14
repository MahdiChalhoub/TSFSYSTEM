"""
Migration 0031: Phase 3 — TaxAccountMapping
=============================================
1. Create TaxAccountMapping table
2. Migrate data from OrgTaxPolicy FK columns to TaxAccountMapping rows
3. Keep FK columns on OrgTaxPolicy (deprecated, not removed to avoid breakage)
"""
from django.db import migrations, models
import django.db.models.deletion


# FK column → tax_type mapping for data migration
FK_TO_TAX_TYPE = {
    'vat_collected_account_id':        'VAT_OUTPUT',
    'vat_recoverable_account_id':      'VAT_INPUT',
    'vat_payable_account_id':          'VAT_PAYABLE',
    'vat_refund_receivable_account_id': 'VAT_REFUND',
    'vat_suspense_account_id':         'VAT_SUSPENSE',
    'airsi_account_id':                'AIRSI',
    'reverse_charge_account_id':       'REVERSE_CHARGE',
}


def migrate_fk_to_rows(apps, schema_editor):
    """Copy FK column values from OrgTaxPolicy to TaxAccountMapping rows."""
    OrgTaxPolicy = apps.get_model('finance', 'OrgTaxPolicy')
    TaxAccountMapping = apps.get_model('finance', 'TaxAccountMapping')

    created = 0
    for policy in OrgTaxPolicy.objects.all():
        for fk_field, tax_type in FK_TO_TAX_TYPE.items():
            account_id = getattr(policy, fk_field, None)
            if account_id:
                TaxAccountMapping.objects.get_or_create(
                    policy=policy,
                    tax_type=tax_type,
                    organization=policy.organization,
                    defaults={'account_id': account_id},
                )
                created += 1

    if created:
        print(f"\n  Migrated {created} tax account mappings from FK columns.")


def reverse_migration(apps, schema_editor):
    """Reverse: copy rows back to FK columns."""
    OrgTaxPolicy = apps.get_model('finance', 'OrgTaxPolicy')
    TaxAccountMapping = apps.get_model('finance', 'TaxAccountMapping')

    TYPE_TO_FK = {v: k for k, v in FK_TO_TAX_TYPE.items()}

    for mapping in TaxAccountMapping.objects.all():
        fk_field = TYPE_TO_FK.get(mapping.tax_type)
        if fk_field and mapping.account_id:
            OrgTaxPolicy.objects.filter(pk=mapping.policy_id).update(
                **{fk_field: mapping.account_id}
            )

    TaxAccountMapping.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0030_contextual_posting_rule'),
        ('erp', '0001_initial'),
    ]

    operations = [
        # 1. Create TaxAccountMapping table
        migrations.CreateModel(
            name='TaxAccountMapping',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tax_type', models.CharField(
                    choices=[
                        ('VAT_OUTPUT', 'VAT Output (Collected)'),
                        ('VAT_INPUT', 'VAT Input (Recoverable)'),
                        ('VAT_PAYABLE', 'VAT Payable (Settlement)'),
                        ('VAT_REFUND', 'VAT Refund Receivable'),
                        ('VAT_SUSPENSE', 'VAT Suspense (Cash-Basis)'),
                        ('AIRSI', 'AIRSI / Withholding Tax'),
                        ('REVERSE_CHARGE', 'Reverse Charge / Auto-liquidation'),
                        ('WHT_SALES', 'Withholding Tax on Sales'),
                        ('WHT_PURCHASES', 'Withholding Tax on Purchases'),
                        ('WHT_PAYABLE', 'Withholding Tax Payable'),
                        ('PURCHASE_TAX', 'Purchase Tax'),
                        ('SALES_TAX', 'Periodic Sales Tax'),
                        ('PROFIT_TAX', 'Profit Tax'),
                        ('CUSTOM', 'Custom Tax Type'),
                    ],
                    help_text='Tax type identifier', max_length=30,
                )),
                ('description', models.CharField(blank=True, default='', help_text='Human-readable note', max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('policy', models.ForeignKey(
                    help_text='Tax policy this mapping belongs to',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='account_mappings',
                    to='finance.orgtaxpolicy',
                )),
                ('account', models.ForeignKey(
                    blank=True, help_text='GL account for this tax type',
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='tax_account_mappings',
                    to='finance.chartofaccount',
                )),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                )),
            ],
            options={
                'db_table': 'finance_tax_account_mapping',
                'ordering': ['policy', 'tax_type'],
                'unique_together': {('policy', 'tax_type')},
            },
        ),

        # 2. Migrate FK column data → rows
        migrations.RunPython(migrate_fk_to_rows, reverse_migration),
    ]
