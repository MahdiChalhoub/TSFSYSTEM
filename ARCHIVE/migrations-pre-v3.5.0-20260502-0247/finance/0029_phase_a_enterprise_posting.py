"""
Migration 0029: Phase A — Enterprise Posting Engine
====================================================
- PostingEvent model (global event catalog)
- PostingRuleHistory model (audit trail)
- Expand system_role choices on ChartOfAccount
- Widen PostingRule.event_code to 80 chars
- Add posting_snapshot JSONField to JournalEntry
- Seed ~120 canonical posting events
"""
from django.db import migrations, models
import django.db.models.deletion


def seed_posting_events(apps, schema_editor):
    """Seed the PostingEvent catalog with ~120 canonical events."""
    PostingEvent = apps.get_model('finance', 'PostingEvent')

    # Only seed if empty (idempotent)
    if PostingEvent.objects.exists():
        return

    from apps.finance.services.posting_event_catalog import POSTING_EVENT_CATALOG
    events = [
        PostingEvent(**event)
        for event in POSTING_EVENT_CATALOG
    ]
    PostingEvent.objects.bulk_create(events, ignore_conflicts=True)


def reverse_seed(apps, schema_editor):
    """Remove seeded events."""
    PostingEvent = apps.get_model('finance', 'PostingEvent')
    PostingEvent.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0028_migrate_posting_rules_data'),
        ('erp', '0001_initial'),
    ]

    operations = [
        # ── 1. PostingEvent model ──
        migrations.CreateModel(
            name='PostingEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, help_text='Canonical event code, e.g. sales.invoice.receivable', max_length=80, unique=True)),
                ('module', models.CharField(choices=[('sales', 'Sales'), ('purchases', 'Purchases'), ('inventory', 'Inventory'), ('payments', 'Payments'), ('tax', 'Tax Engine'), ('treasury', 'Finance / Treasury'), ('assets', 'Fixed Assets'), ('equity', 'Equity & Capital'), ('adjustment', 'Adjustments')], max_length=20)),
                ('document_type', models.CharField(help_text='Document type within module, e.g. invoice, credit_note, receipt', max_length=30)),
                ('line_role', models.CharField(help_text='Account role in the entry, e.g. receivable, revenue, vat_output', max_length=30)),
                ('normal_balance', models.CharField(choices=[('DEBIT', 'Debit'), ('CREDIT', 'Credit'), ('EITHER', 'Either')], default='DEBIT', max_length=6)),
                ('criticality', models.CharField(choices=[('CRITICAL', 'Critical — blocks posting if missing'), ('STANDARD', 'Standard — needed for full operation'), ('OPTIONAL', 'Optional — nice to have'), ('CONDITIONAL', 'Conditional — depends on module/config')], default='STANDARD', max_length=15)),
                ('description', models.CharField(blank=True, default='', max_length=200)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'finance_posting_event',
                'ordering': ['module', 'document_type', 'line_role'],
            },
        ),

        # ── 2. PostingRuleHistory model ──
        migrations.CreateModel(
            name='PostingRuleHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_code', models.CharField(db_index=True, max_length=80)),
                ('change_type', models.CharField(choices=[('CREATE', 'Created'), ('UPDATE', 'Updated'), ('DELETE', 'Deleted'), ('AUTO', 'Auto-detected')], max_length=10)),
                ('old_account_code', models.CharField(blank=True, default='', max_length=50)),
                ('new_account_code', models.CharField(blank=True, default='', max_length=50)),
                ('source', models.CharField(blank=True, default='', max_length=20)),
                ('reason', models.CharField(blank=True, default='', max_length=200)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('old_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='finance.chartofaccount')),
                ('new_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='finance.chartofaccount')),
                ('changed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='erp.user')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='erp.organization')),
            ],
            options={
                'db_table': 'finance_posting_rule_history',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='postingrulehistory',
            index=models.Index(fields=['organization', 'event_code'], name='prh_org_event_idx'),
        ),
        migrations.AddIndex(
            model_name='postingrulehistory',
            index=models.Index(fields=['organization', 'timestamp'], name='prh_org_time_idx'),
        ),

        # ── 3. Widen PostingRule.event_code to 80 chars ──
        migrations.AlterField(
            model_name='postingrule',
            name='event_code',
            field=models.CharField(db_index=True, help_text='Dotted event code, e.g. sales.invoice.receivable', max_length=80),
        ),

        # ── 4. Expand system_role choices on ChartOfAccount ──
        migrations.AlterField(
            model_name='chartofaccount',
            name='system_role',
            field=models.CharField(
                blank=True, null=True, max_length=30,
                help_text='Enterprise role for programmatic engine lookups',
                choices=[
                    ('AR_CONTROL', 'Accounts Receivable Control'), ('AP_CONTROL', 'Accounts Payable Control'),
                    ('CASH_ACCOUNT', 'Cash Account'), ('BANK_ACCOUNT', 'Bank Account'),
                    ('REVENUE_CONTROL', 'Revenue Account'), ('COGS_CONTROL', 'Cost of Goods Sold Account'),
                    ('INVENTORY_ASSET', 'Inventory Asset'), ('TAX_PAYABLE', 'Tax Payable'),
                    ('TAX_RECEIVABLE', 'Tax Receivable'), ('RETAINED_EARNINGS', 'Retained Earnings'),
                    ('P_L_SUMMARY', 'Current Year Profit/Loss'), ('OPENING_BALANCE_OFFSET', 'Opening Balance Offset'),
                    ('ROUNDING_DIFF', 'Rounding Difference'), ('EXCHANGE_DIFF', 'Exchange Difference'),
                    ('SUSPENSE', 'Suspense/Clearing Account'),
                    ('RECEIVABLE', 'Accounts Receivable'), ('PAYABLE', 'Accounts Payable'),
                    ('VAT_INPUT', 'VAT Deductible / Input'), ('VAT_OUTPUT', 'VAT Collected / Output'),
                    ('REVENUE', 'Revenue / Sales Income'), ('COGS', 'Cost of Goods Sold'),
                    ('INVENTORY', 'Inventory / Stock'), ('EXPENSE', 'General Expense'),
                    ('DISCOUNT_GIVEN', 'Discount Given / Allowed'), ('DISCOUNT_RECEIVED', 'Discount Received / Earned'),
                    ('FX_GAIN', 'Foreign Exchange Gain'), ('FX_LOSS', 'Foreign Exchange Loss'),
                    ('WIP', 'Work In Progress'), ('DELIVERY_FEES', 'Freight / Delivery Fees'),
                    ('CAPITAL', 'Owner Capital / Equity'), ('WITHDRAWAL', 'Owner Withdrawals / Draws'),
                    ('DEPRECIATION_EXP', 'Depreciation Expense'), ('ACCUM_DEPRECIATION', 'Accumulated Depreciation'),
                    ('LOAN', 'Loans / Borrowings'), ('WITHHOLDING', 'Withholding Tax / AIRSI'),
                    ('BAD_DEBT', 'Bad Debt Expense'), ('GRNI', 'Goods Received Not Invoiced'),
                ],
            ),
        ),

        # ── 5. Add posting_snapshot to JournalEntry ──
        migrations.AddField(
            model_name='journalentry',
            name='posting_snapshot',
            field=models.JSONField(
                blank=True, null=True,
                help_text='Frozen snapshot of resolved posting rules at posting time. Records: event_code, account_id, account_code, account_name, rule_source.'
            ),
        ),

        # ── 6. Seed event catalog ──
        migrations.RunPython(seed_posting_events, reverse_code=reverse_seed),
    ]
