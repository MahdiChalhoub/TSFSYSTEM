"""
Adds CurrencyRatePolicy.sync_frequency — controls how often the cron / on-demand
sync engine refreshes the rate. ON_TRANSACTION lets the policy be pulled
just-in-time when an FX-using transaction is about to post; DAILY / WEEKLY /
MONTHLY skip the cron run when the last sync is fresher than the interval.

Default 'DAILY' preserves the prior behavior so existing policies don't change
their cadence.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0071_currencyratepolicy'),
    ]

    operations = [
        migrations.AddField(
            model_name='currencyratepolicy',
            name='sync_frequency',
            field=models.CharField(
                max_length=20,
                default='DAILY',
                choices=[
                    ('ON_TRANSACTION', 'Per transaction (sync just-in-time before posting)'),
                    ('DAILY', 'Daily (refresh once per day)'),
                    ('WEEKLY', 'Weekly (refresh every 7 days)'),
                    ('MONTHLY', 'Monthly (refresh every 30 days)'),
                ],
                help_text=(
                    'How often the cron / on-demand sync engine refreshes this '
                    'policy. ON_TRANSACTION means rates are pulled the moment '
                    'an FX-using transaction is about to post. DAILY / WEEKLY / '
                    'MONTHLY skip the cron run if the last sync is fresher than '
                    'the configured interval.'
                ),
            ),
        ),
    ]
