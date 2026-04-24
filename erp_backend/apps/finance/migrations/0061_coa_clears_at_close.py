"""
ChartOfAccount.clears_at_close — contra-equity temporary account marker.

Schema:
  - Adds BooleanField `clears_at_close` (default False) to ChartOfAccount.

Data backfill:
  - Any account flagged `system_role='WITHDRAWAL'` gets `clears_at_close=True`
    (safe default — withdrawals are by definition contra-equity accounts
    that should close to RE alongside INCOME/EXPENSE).
  - Any account flagged `system_role='WITHDRAWAL'` whose `normal_balance`
    is NULL or 'CREDIT' is corrected to 'DEBIT'. A draws account has DR
    normal balance (it reduces equity); CR was a mis-tag from the
    auto-resolver inheriting from type=EQUITY.

Reverse:
  Drop the column only. Metadata corrections on normal_balance aren't
  reverted (they were bug fixes, not intentional data).
"""
from django.db import migrations, models


def forwards(apps, schema_editor):
    COA = apps.get_model('finance', 'ChartOfAccount')
    # Withdrawal accounts → clears at close + DR normal balance
    COA.objects.filter(system_role='WITHDRAWAL').update(clears_at_close=True)
    COA.objects.filter(system_role='WITHDRAWAL').filter(
        models.Q(normal_balance__isnull=True) | models.Q(normal_balance='CREDIT')
    ).update(normal_balance='DEBIT')


def backwards(apps, schema_editor):
    # Nothing to reverse in data — schema drop handles the flag removal.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0060_journalentry_supersede_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='chartofaccount',
            name='clears_at_close',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'If True, this account is swept into Retained Earnings at fiscal '
                    'year-end alongside INCOME/EXPENSE. Typical for Owner Draws, '
                    'Dividends Declared, Treasury Stock — contra-equity "temporary" '
                    'accounts. Leave False for Capital and Retained Earnings themselves.'
                ),
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
