from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0056_tax_rate_category'),
    ]

    operations = [
        migrations.AlterField(
            model_name='fiscalyear',
            name='closing_journal_entry',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    'The year-end closing JE that transfers P&L into retained earnings. '
                    'PROTECT prevents accidental deletion that would break the audit trail.'
                ),
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name='closed_fiscal_year',
                to='finance.journalentry',
            ),
        ),
    ]
