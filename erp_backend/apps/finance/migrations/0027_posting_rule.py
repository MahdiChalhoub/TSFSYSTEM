"""
Migration: Create PostingRule model
Replaces schemaless JSON blob in Organization.settings with a proper Django model.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0026_enhance_loan_installment'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PostingRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_code', models.CharField(db_index=True, help_text='Dotted event code, e.g. sales.receivable, purchases.payable', max_length=60)),
                ('module', models.CharField(choices=[('sales', 'Sales'), ('purchases', 'Purchases'), ('inventory', 'Inventory'), ('tax', 'Tax'), ('automation', 'Automation'), ('suspense', 'Suspense'), ('partners', 'Partners'), ('equity', 'Equity'), ('fixedAssets', 'Fixed Assets'), ('fx', 'FX / Revaluation'), ('payroll', 'Payroll')], default='sales', help_text='Module this rule belongs to (derived from event_code prefix)', max_length=20)),
                ('source', models.CharField(choices=[('AUTO', 'Auto-detected from COA'), ('MANUAL', 'Manual configuration'), ('SEED', 'Seeded from template'), ('MIGRATION', 'Migrated from legacy JSON')], default='AUTO', help_text='How this rule was created', max_length=20)),
                ('description', models.CharField(blank=True, default='', help_text='Human-readable description of what this event maps', max_length=200)),
                ('is_active', models.BooleanField(default=True, help_text='Inactive rules are skipped during resolution')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('account', models.ForeignKey(help_text='GL account mapped to this event', on_delete=django.db.models.deletion.PROTECT, related_name='posting_rules', to='finance.chartofaccount')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
            ],
            options={
                'db_table': 'finance_posting_rule',
                'ordering': ['module', 'event_code'],
                'unique_together': {('organization', 'event_code')},
            },
        ),
        migrations.AddIndex(
            model_name='postingrule',
            index=models.Index(fields=['organization', 'is_active'], name='pr_org_active_idx'),
        ),
    ]
