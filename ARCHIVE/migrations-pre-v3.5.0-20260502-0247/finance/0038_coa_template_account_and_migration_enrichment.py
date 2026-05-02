"""
Phase 1: Add COATemplateAccount normalized model + enrich COATemplateMigrationMap
"""
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0037_coa_template_migration_map'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ═══════════════════════════════════════════════════
        # 1. Create COATemplateAccount table
        # ═══════════════════════════════════════════════════
        migrations.CreateModel(
            name='COATemplateAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(help_text='Account code within this template', max_length=20)),
                ('name', models.CharField(help_text='Display name', max_length=200)),
                ('normalized_name', models.CharField(blank=True, default='', help_text='Lowered, accent-stripped, normalized name for matching', max_length=200)),
                ('aliases', models.JSONField(blank=True, default=list, help_text='Multilingual labels / synonyms for matching')),
                ('type', models.CharField(choices=[('ASSET', 'Asset'), ('LIABILITY', 'Liability'), ('EQUITY', 'Equity'), ('INCOME', 'Income'), ('EXPENSE', 'Expense')], help_text='ASSET, LIABILITY, EQUITY, INCOME, EXPENSE', max_length=20)),
                ('sub_type', models.CharField(blank=True, default='', help_text='Sub-classification', max_length=50)),
                ('system_role', models.CharField(blank=True, choices=[('CASH_ACCOUNT', 'Cash in Hand / Petty Cash'), ('BANK_ACCOUNT', 'Bank Accounts'), ('CASH_OVER_SHORT', 'Cash Over/Short'), ('RECEIVABLE', 'Accounts Receivable'), ('CUSTOMER_ADVANCE', 'Customer Advances / Prepayments'), ('INVENTORY', 'Finished Goods / Merchandise'), ('GOODS_IN_TRANSIT', 'Goods in Transit'), ('INVENTORY_VARIANCE', 'Inventory Count Variance'), ('GRNI', 'Goods Received Not Invoiced'), ('PREPAID_EXPENSES', 'Prepaid Expenses'), ('ACCRUED_EXPENSES', 'Accrued Expenses'), ('DEPRECIATION', 'Accumulated Depreciation'), ('VAT_INPUT', 'VAT Deductible (Input)'), ('VAT_OUTPUT', 'VAT Collected (Output)'), ('VAT_RECEIVABLE', 'VAT Refundable'), ('VAT_PAYABLE', 'VAT Due to State'), ('WHT_PAYABLE', 'Withholding Tax Payable'), ('AIRSI_PAYABLE', 'AIRSI Tax Payable'), ('TAX_EXPENSE', 'Income Tax Expense'), ('PAYROLL_TAX', 'Payroll Tax Payable'), ('SOCIAL_SECURITY', 'Social Security Payable'), ('PAYABLE', 'Accounts Payable'), ('SUPPLIER_ADVANCE', 'Supplier Advances / Prepayments'), ('SALARY_PAYABLE', 'Salaries Payable'), ('DEFERRED_REVENUE', 'Deferred / Unearned Revenue'), ('LOAN_SHORT', 'Short-term Loans Payable'), ('LOAN_LONG', 'Long-term Loans Payable'), ('INTERCO_DUE_FROM', 'Intercompany Due From'), ('INTERCO_DUE_TO', 'Intercompany Due To'), ('RETAINED_EARNINGS', 'Retained Earnings'), ('P_L_SUMMARY', 'Current Year Profit/Loss'), ('WITHDRAWAL', 'Owner Withdrawals'), ('OWNER_CURRENT', 'Owner Current Account'), ('REVENUE', 'Main Sales Revenue'), ('SALES_RETURNS', 'Sales Returns & Allowances'), ('SALES_DISCOUNT', 'Sales Discounts'), ('DISCOUNT_GRANTED', 'Discounts Granted'), ('DISCOUNT_RECEIVED', 'Discounts Received'), ('FX_GAIN', 'Foreign Exchange Gains'), ('COGS', 'Cost of Goods Sold'), ('PURCHASE_RETURNS', 'Purchase Returns'), ('PURCHASE_DISCOUNT', 'Purchase Discounts'), ('INVENTORY_ADJ', 'Inventory Adjustments'), ('SALARY_EXPENSE', 'Salary Expense'), ('DEPRECIATION_EXP', 'Depreciation Expense'), ('BAD_DEBT', 'Bad Debt Expense'), ('FX_LOSS', 'Foreign Exchange Losses'), ('SUSPENSE', 'Suspense / Clearing'), ('INTER_BRANCH', 'Inter-branch Clearing'), ('ROUNDING', 'Rounding Adjustments'), ('OPENING_BALANCE', 'Opening Balance Equity'), ('POS_CLEARING', 'POS Cash Clearing'), ('STOCK_RECEIVED_NOT_BILLED', 'Stock Received Not Billed')], help_text='Universal semantic role (primary matching key)', max_length=50, null=True)),
                ('parent_code', models.CharField(blank=True, help_text='Parent account code for tree structure', max_length=20, null=True)),
                ('normal_balance', models.CharField(choices=[('DEBIT', 'Debit'), ('CREDIT', 'Credit')], default='DEBIT', help_text='Expected normal balance direction', max_length=6)),
                ('posting_purpose', models.CharField(choices=[('CONTROL', 'Control Account'), ('DETAIL', 'Detail / Transactional'), ('SUMMARY', 'Summary / Group'), ('SYSTEM', 'System / Internal')], default='DETAIL', help_text='CONTROL, DETAIL, SUMMARY, SYSTEM', max_length=20)),
                ('business_domain', models.CharField(choices=[('AR', 'Accounts Receivable'), ('AP', 'Accounts Payable'), ('TAX', 'Tax'), ('INVENTORY', 'Inventory'), ('TREASURY', 'Treasury'), ('PAYROLL', 'Payroll'), ('FIXED_ASSETS', 'Fixed Assets'), ('EQUITY', 'Equity'), ('REVENUE', 'Revenue'), ('EXPENSE', 'Expense'), ('SYSTEM', 'System / Clearing'), ('INTERCO', 'Intercompany'), ('OTHER', 'Other')], default='OTHER', help_text='Functional business area', max_length=20)),
                ('is_reconcilable', models.BooleanField(default=False)),
                ('is_bank_account', models.BooleanField(default=False)),
                ('is_tax_account', models.BooleanField(default=False)),
                ('is_control_account', models.BooleanField(default=False)),
                ('template', models.ForeignKey(help_text='Parent template', on_delete=django.db.models.deletion.CASCADE, related_name='template_accounts', to='finance.coatemplate')),
            ],
            options={
                'db_table': 'finance_coa_template_account',
                'ordering': ['code'],
                'unique_together': {('template', 'code')},
                'indexes': [
                    models.Index(fields=['template', 'system_role'], name='coatplacct_role_idx'),
                    models.Index(fields=['template', 'type', 'sub_type'], name='coatplacct_type_idx'),
                    models.Index(fields=['template', 'business_domain'], name='coatplacct_domain_idx'),
                ],
            },
        ),

        # ═══════════════════════════════════════════════════
        # 2. Enrich COATemplateMigrationMap with new fields
        # ═══════════════════════════════════════════════════
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='match_level',
            field=models.CharField(choices=[('ROLE', 'System Role Match'), ('CODE', 'Code + Type Match'), ('NAME', 'Normalized Name Match'), ('TYPE_SUBTYPE', 'Type/SubType Fallback'), ('MANUAL', 'Manual Assignment'), ('UNMAPPED', 'Unmapped')], default='UNMAPPED', help_text='How this mapping was determined', max_length=20),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='confidence_score',
            field=models.DecimalField(decimal_places=2, default=0.0, help_text='Match confidence (0.00 = unmapped, 1.00 = exact role match)', max_digits=3),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='status',
            field=models.CharField(choices=[('AUTO_MATCHED', 'Auto-Matched'), ('REVIEWED', 'Reviewed'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('UNMAPPED_REQUIRED', 'Unmapped — Required'), ('UNMAPPED_OPTIONAL', 'Unmapped — Optional'), ('LOSSY_MATCH', 'Lossy Match'), ('MANUAL_REVIEW', 'Manual Review Required')], default='AUTO_MATCHED', help_text='Current workflow status', max_length=20),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='is_manual_override',
            field=models.BooleanField(default=False, help_text='True if a human has manually edited this mapping'),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='mapping_type',
            field=models.CharField(choices=[('ONE_TO_ONE', 'One to One'), ('ONE_TO_MANY', 'One to Many'), ('MANY_TO_ONE', 'Many to One'), ('NO_DIRECT_MATCH', 'No Direct Match')], default='ONE_TO_ONE', help_text='Mapping cardinality', max_length=20),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='mapping_reason',
            field=models.TextField(blank=True, default='', help_text='Detailed explanation of why this mapping was chosen'),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='group_key',
            field=models.CharField(blank=True, default='', help_text='Links related rows for ONE_TO_MANY / MANY_TO_ONE splits', max_length=50),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='allocation_percent',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='For splits: percentage allocated to this target', max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='source_account_snapshot',
            field=models.JSONField(blank=True, help_text='Frozen source account data at mapping time', null=True),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='target_account_snapshot',
            field=models.JSONField(blank=True, help_text='Frozen target account data at mapping time', null=True),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='version',
            field=models.IntegerField(default=1, help_text='Mapping version number'),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='created_by',
            field=models.ForeignKey(blank=True, help_text='User who created this mapping', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='updated_by',
            field=models.ForeignKey(blank=True, help_text='User who last updated this mapping', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default='2026-01-01'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='coatemplatemigrationmap',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        # Allow target_account_code to be blank (for unmapped entries)
        migrations.AlterField(
            model_name='coatemplatemigrationmap',
            name='target_account_code',
            field=models.CharField(blank=True, default='', help_text='Mapped account code in the target template', max_length=20),
        ),
    ]
