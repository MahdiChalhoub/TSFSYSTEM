"""Data migration — backfill monetary_classification on existing COA rows.

The 0075 schema migration added the column with a hard default of MONETARY.
That's correct for cash/AR/AP, but wrong for income/expense and equity rows.
This migration walks every account and applies the same heuristics as
`account_views._smart_default_for` so the UI's "Smart classify" button is
not the only path to a sensible state.

Reversible — the inverse just resets every value to MONETARY (the schema
default), preserving the column itself.
"""
from django.db import migrations


# Mirror of _smart_default_for(acc) in apps/finance/views/account_views.py.
# Kept inline so this migration doesn't import live view code (which can
# drift). If the heuristic evolves, update the runtime helper AND the
# bulk-classify endpoint AND this backfill on the next run.
NON_MON_ROLES = {
    'INVENTORY', 'INVENTORY_ASSET', 'WIP',
    'ACCUM_DEPRECIATION',
}
MON_SUB_TYPES = {'CASH', 'BANK', 'RECEIVABLE', 'PAYABLE'}


def _classify(t, role, sub):
    role = role or ''
    sub = (sub or '').upper()
    if t in ('INCOME', 'EXPENSE'):
        return 'INCOME_EXPENSE'
    if t == 'EQUITY':
        return 'NON_MONETARY'
    if role in NON_MON_ROLES:
        return 'NON_MONETARY'
    if sub in MON_SUB_TYPES:
        return 'MONETARY'
    if t in ('ASSET', 'LIABILITY'):
        return 'MONETARY'
    return 'MONETARY'


def forward(apps, schema_editor):
    ChartOfAccount = apps.get_model('finance', 'ChartOfAccount')
    # Only update rows still on the default — preserves any operator overrides
    # already made through the COA editor or bulk-classify endpoint.
    qs = ChartOfAccount.objects.filter(monetary_classification='MONETARY')
    updates = []
    for acc in qs:
        new_class = _classify(acc.type, acc.system_role, acc.sub_type)
        if new_class != 'MONETARY':
            acc.monetary_classification = new_class
            updates.append(acc)
    # Bulk write in chunks of 500 to avoid hitting parameter limits on PG.
    for i in range(0, len(updates), 500):
        ChartOfAccount.objects.bulk_update(
            updates[i:i + 500], ['monetary_classification'],
        )


def backward(apps, schema_editor):
    """Reset every row to MONETARY (the schema default)."""
    ChartOfAccount = apps.get_model('finance', 'ChartOfAccount')
    ChartOfAccount.objects.exclude(monetary_classification='MONETARY').update(
        monetary_classification='MONETARY',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0075_revaluation_overhaul'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
