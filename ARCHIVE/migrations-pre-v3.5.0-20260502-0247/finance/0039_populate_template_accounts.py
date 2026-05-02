"""
Data migration: Populate COATemplateAccount rows from existing JSON accounts,
and backfill match_level/confidence on existing COATemplateMigrationMap rows.
"""
import unicodedata
import re
from django.db import migrations


def normalize_name(name):
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9 ]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


# Map system_role → business_domain
ROLE_TO_DOMAIN = {
    'CASH_ACCOUNT': 'TREASURY', 'BANK_ACCOUNT': 'TREASURY', 'CASH_OVER_SHORT': 'TREASURY',
    'RECEIVABLE': 'AR', 'CUSTOMER_ADVANCE': 'AR',
    'PAYABLE': 'AP', 'SUPPLIER_ADVANCE': 'AP',
    'INVENTORY': 'INVENTORY', 'GOODS_IN_TRANSIT': 'INVENTORY', 'INVENTORY_VARIANCE': 'INVENTORY',
    'GRNI': 'INVENTORY', 'STOCK_RECEIVED_NOT_BILLED': 'INVENTORY',
    'VAT_INPUT': 'TAX', 'VAT_OUTPUT': 'TAX', 'VAT_RECEIVABLE': 'TAX', 'VAT_PAYABLE': 'TAX',
    'WHT_PAYABLE': 'TAX', 'AIRSI_PAYABLE': 'TAX', 'TAX_EXPENSE': 'TAX',
    'PAYROLL_TAX': 'PAYROLL', 'SOCIAL_SECURITY': 'PAYROLL', 'SALARY_PAYABLE': 'PAYROLL', 'SALARY_EXPENSE': 'PAYROLL',
    'DEPRECIATION': 'FIXED_ASSETS', 'DEPRECIATION_EXP': 'FIXED_ASSETS',
    'RETAINED_EARNINGS': 'EQUITY', 'P_L_SUMMARY': 'EQUITY', 'WITHDRAWAL': 'EQUITY', 'OWNER_CURRENT': 'EQUITY',
    'REVENUE': 'REVENUE', 'SALES_RETURNS': 'REVENUE', 'SALES_DISCOUNT': 'REVENUE',
    'DISCOUNT_GRANTED': 'REVENUE', 'DISCOUNT_RECEIVED': 'REVENUE', 'FX_GAIN': 'REVENUE',
    'COGS': 'EXPENSE', 'PURCHASE_RETURNS': 'EXPENSE', 'PURCHASE_DISCOUNT': 'EXPENSE',
    'INVENTORY_ADJ': 'EXPENSE', 'BAD_DEBT': 'EXPENSE', 'FX_LOSS': 'EXPENSE',
    'SUSPENSE': 'SYSTEM', 'INTER_BRANCH': 'SYSTEM', 'ROUNDING': 'SYSTEM',
    'OPENING_BALANCE': 'SYSTEM', 'POS_CLEARING': 'SYSTEM',
    'INTERCO_DUE_FROM': 'INTERCO', 'INTERCO_DUE_TO': 'INTERCO',
    'PREPAID_EXPENSES': 'EXPENSE', 'ACCRUED_EXPENSES': 'EXPENSE',
    'DEFERRED_REVENUE': 'REVENUE',
    'LOAN_SHORT': 'AP', 'LOAN_LONG': 'AP',
}


def populate_template_accounts(apps, schema_editor):
    """Flatten JSON account trees → COATemplateAccount rows."""
    COATemplate = apps.get_model('finance', 'COATemplate')
    COATemplateAccount = apps.get_model('finance', 'COATemplateAccount')

    for tpl in COATemplate.objects.all():
        accounts = tpl.accounts or []
        if not accounts:
            continue

        rows = []

        def process(items, parent_code=None):
            for acct in items:
                code = acct.get('code', '')
                name = acct.get('name', '')
                acct_type = acct.get('type', 'ASSET')
                sub_type = acct.get('sub_type', '') or ''
                system_role = acct.get('system_role') or None
                p_code = acct.get('parent_code') or parent_code

                # Infer normal_balance
                normal_balance = 'CREDIT' if acct_type in ('LIABILITY', 'EQUITY', 'INCOME') else 'DEBIT'

                # Infer business_domain
                domain = ROLE_TO_DOMAIN.get(system_role, 'OTHER') if system_role else 'OTHER'

                # Infer posting_purpose
                children = acct.get('children', [])
                purpose = 'SUMMARY' if children else 'DETAIL'
                if system_role in ('SUSPENSE', 'INTER_BRANCH', 'ROUNDING', 'OPENING_BALANCE', 'POS_CLEARING'):
                    purpose = 'SYSTEM'

                # Flags
                is_tax = bool(system_role and ('VAT' in system_role or system_role in ('WHT_PAYABLE', 'AIRSI_PAYABLE', 'TAX_EXPENSE', 'PAYROLL_TAX')))
                is_bank = system_role == 'BANK_ACCOUNT'

                rows.append(COATemplateAccount(
                    template=tpl,
                    code=code,
                    name=name,
                    normalized_name=normalize_name(name),
                    type=acct_type,
                    sub_type=sub_type,
                    system_role=system_role,
                    parent_code=p_code,
                    normal_balance=normal_balance,
                    posting_purpose=purpose,
                    business_domain=domain,
                    is_reconcilable=system_role in ('RECEIVABLE', 'PAYABLE', 'BANK_ACCOUNT'),
                    is_bank_account=is_bank,
                    is_tax_account=is_tax,
                    is_control_account=False,
                ))

                if children:
                    process(children, code)

        process(accounts)
        if rows:
            COATemplateAccount.objects.bulk_create(rows, ignore_conflicts=True)
            print(f"  ✅ {tpl.key}: populated {len(rows)} accounts")


def backfill_migration_map_metadata(apps, schema_editor):
    """Set match_level and confidence on existing migration map rows based on notes."""
    COATemplateMigrationMap = apps.get_model('finance', 'COATemplateMigrationMap')

    updated = 0
    for m in COATemplateMigrationMap.objects.all():
        notes = (m.notes or '').lower()
        if 'role' in notes:
            m.match_level = 'ROLE'
            m.confidence_score = 1.0
        elif 'same code' in notes or 'code' in notes:
            m.match_level = 'CODE'
            m.confidence_score = 0.8
        elif 'name' in notes:
            m.match_level = 'NAME'
            m.confidence_score = 0.6
        elif 'type' in notes:
            m.match_level = 'TYPE_SUBTYPE'
            m.confidence_score = 0.4
        elif m.target_account_code:
            m.match_level = 'MANUAL'
            m.confidence_score = 0.5
        else:
            m.match_level = 'UNMAPPED'
            m.confidence_score = 0.0

        m.status = 'AUTO_MATCHED'
        m.mapping_reason = m.notes or ''
        m.save(update_fields=['match_level', 'confidence_score', 'status', 'mapping_reason'])
        updated += 1

    print(f"  ✅ Backfilled {updated} migration map rows with match metadata")


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0038_coa_template_account_and_migration_enrichment'),
    ]

    operations = [
        migrations.RunPython(populate_template_accounts, migrations.RunPython.noop),
        migrations.RunPython(backfill_migration_map_metadata, migrations.RunPython.noop),
    ]
