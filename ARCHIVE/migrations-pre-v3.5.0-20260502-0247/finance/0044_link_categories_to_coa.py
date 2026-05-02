"""
Migration: Auto-link default FinancialAccountCategory rows to their matching
COA parent nodes using the ChartOfAccount.system_role field.

Category -> system_role mapping:
  CASH, MOBILE, PETTY_CASH -> CASH_ACCOUNT
  BANK, SAVINGS, FOREIGN, ESCROW, INVESTMENT -> BANK_ACCOUNT
"""
from django.db import migrations


# Category code → COA system_role
CATEGORY_TO_ROLE = {
    'CASH': 'CASH_ACCOUNT',
    'MOBILE': 'CASH_ACCOUNT',
    'PETTY_CASH': 'CASH_ACCOUNT',
    'BANK': 'BANK_ACCOUNT',
    'SAVINGS': 'BANK_ACCOUNT',
    'FOREIGN': 'BANK_ACCOUNT',
    'ESCROW': 'BANK_ACCOUNT',
    'INVESTMENT': 'BANK_ACCOUNT',
}


def link_categories_to_coa(apps, schema_editor):
    """For each org, find the COA node matching the system_role and set it as coa_parent."""
    FinancialAccountCategory = apps.get_model('finance', 'FinancialAccountCategory')
    ChartOfAccount = apps.get_model('finance', 'ChartOfAccount')

    # Process each unlinked default category
    for cat in FinancialAccountCategory.objects.filter(coa_parent__isnull=True, code__in=CATEGORY_TO_ROLE.keys()):
        role = CATEGORY_TO_ROLE.get(cat.code)
        if not role:
            continue

        # Find the COA node with this system_role for this org
        coa_node = ChartOfAccount.objects.filter(
            organization=cat.organization,
            system_role=role,
        ).first()

        if coa_node:
            cat.coa_parent = coa_node
            cat.save(update_fields=['coa_parent'])


def reverse_link(apps, schema_editor):
    """Remove the auto-linked coa_parent from default categories."""
    FinancialAccountCategory = apps.get_model('finance', 'FinancialAccountCategory')
    FinancialAccountCategory.objects.filter(
        code__in=CATEGORY_TO_ROLE.keys()
    ).update(coa_parent=None)


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0043_add_invoice_verification_fields'),
    ]

    operations = [
        migrations.RunPython(link_categories_to_coa, reverse_link),
    ]
