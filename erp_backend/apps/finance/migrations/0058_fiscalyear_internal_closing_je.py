from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0057_protect_closing_journal_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='fiscalyear',
            name='internal_closing_journal_entry',
            field=models.ForeignKey(
                blank=True,
                help_text='INTERNAL-scope year-end closing JE (management book). PROTECT prevents accidental deletion.',
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name='internal_closed_fiscal_year',
                to='finance.journalentry',
            ),
        ),
        migrations.AlterField(
            model_name='fiscalyear',
            name='closing_journal_entry',
            field=models.ForeignKey(
                blank=True,
                help_text='OFFICIAL-scope year-end closing JE (audit-trail anchor). PROTECT prevents accidental deletion.',
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name='closed_fiscal_year',
                to='finance.journalentry',
            ),
        ),
    ]
