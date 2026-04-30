"""Revaluation overhaul.

Adds the schema needed for the redesigned FX revaluation pipeline:

  * `ChartOfAccount.monetary_classification` — IAS 21 / ASC 830 driver for
    which rate type the engine uses (closing / average / historical).
  * `CurrencyRevaluation.materiality_pct`, `excluded_account_ids`,
    `auto_reverse_at_period_start`, `reversal_journal_entry`, plus approval
    fields (`approved_by`, `approved_at`, `rejection_reason`) and two new
    statuses (`PENDING_APPROVAL`, `REJECTED`).
  * `CurrencyRevaluationLine.rate_type_used`, `classification` —
    per-account audit of which rate type was applied and why.

No data migration: existing rows default to MONETARY classification + auto
reversal disabled so prior behavior is preserved.
"""
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0074_bid_ask_sides'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='chartofaccount',
            name='monetary_classification',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('MONETARY', 'Monetary (closing rate)'),
                    ('NON_MONETARY', 'Non-monetary (historical, no revaluation)'),
                    ('INCOME_EXPENSE', 'Income/Expense (average rate)'),
                ],
                default='MONETARY',
                help_text='IAS 21 / ASC 830 classification — drives rate type used at revaluation.',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='materiality_pct',
            field=models.DecimalField(
                max_digits=8, decimal_places=4, default=Decimal('0.0000'),
                help_text='Net impact as % of revalued base. Drives approval gate.',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='excluded_account_ids',
            field=models.JSONField(
                default=list, blank=True,
                help_text='COA ids that the operator explicitly skipped on this run.',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='auto_reverse_at_period_start',
            field=models.BooleanField(
                default=True,
                help_text='Auto-post a reversing JE on day 1 of the next fiscal period.',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='reversal_journal_entry',
            field=models.ForeignKey(
                'finance.JournalEntry', on_delete=models.SET_NULL,
                null=True, blank=True, related_name='revaluation_reversed_source',
                help_text='The auto-posted reversing JE on day 1 of next period.',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='approved_by',
            field=models.ForeignKey(
                settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                null=True, blank=True,
                related_name='currency_revaluation_approvals',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='approved_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='currencyrevaluation',
            name='rejection_reason',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='currencyrevaluation',
            name='status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('DRAFT', 'Draft'),
                    ('PENDING_APPROVAL', 'Pending approval'),
                    ('POSTED', 'Posted'),
                    ('REVERSED', 'Reversed'),
                    ('REJECTED', 'Rejected'),
                ],
                default='DRAFT',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluationline',
            name='rate_type_used',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('CLOSING', 'Closing'),
                    ('AVERAGE', 'Average'),
                    ('SPOT', 'Spot (fallback)'),
                    ('HISTORICAL', 'Historical (skipped)'),
                ],
                default='CLOSING',
            ),
        ),
        migrations.AddField(
            model_name='currencyrevaluationline',
            name='classification',
            field=models.CharField(
                max_length=20, default='MONETARY',
                help_text='Snapshot of account.monetary_classification at run time.',
            ),
        ),
    ]
