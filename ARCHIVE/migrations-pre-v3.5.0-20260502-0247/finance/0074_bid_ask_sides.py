"""
Adds Bid/Ask side semantics to ExchangeRate + spread fields to
CurrencyRatePolicy.

ExchangeRate gets a new `rate_side` ∈ {MID, BID, ASK}, default 'MID' so all
existing rows keep the prior behavior. The unique-together is extended to
include rate_side, so the same (date, pair, rate_type) can carry three rows.

CurrencyRatePolicy gets `bid_spread_pct` / `ask_spread_pct`, both default 0
— meaning no extra BID/ASK rows are written until the operator opts in.
"""
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0073_currencyratepolicy_more_providers'),
    ]

    operations = [
        # 1. Drop the old uniqueness so we can add rate_side then re-pin it.
        migrations.AlterUniqueTogether(
            name='exchangerate',
            unique_together=set(),
        ),
        # 2. Add rate_side with MID default — all current rows are MID.
        migrations.AddField(
            model_name='exchangerate',
            name='rate_side',
            field=models.CharField(
                max_length=4,
                default='MID',
                choices=[
                    ('MID', 'Mid-market'),
                    ('BID', 'Bid (operator buys)'),
                    ('ASK', 'Ask (operator sells)'),
                ],
                help_text='MID = mid-market; BID/ASK = the buy/sell sides of a quote.',
            ),
        ),
        # 3. Re-add the uniqueness, now including rate_side.
        migrations.AlterUniqueTogether(
            name='exchangerate',
            unique_together={('organization', 'from_currency', 'to_currency', 'effective_date', 'rate_type', 'rate_side')},
        ),
        # 4. Spread fields on the policy.
        migrations.AddField(
            model_name='currencyratepolicy',
            name='bid_spread_pct',
            field=models.DecimalField(
                max_digits=6, decimal_places=4, default=Decimal('0.0000'),
                help_text='BID-side spread % below mid. 0 = no separate BID row.',
            ),
        ),
        migrations.AddField(
            model_name='currencyratepolicy',
            name='ask_spread_pct',
            field=models.DecimalField(
                max_digits=6, decimal_places=4, default=Decimal('0.0000'),
                help_text='ASK-side spread % above mid. 0 = no separate ASK row.',
            ),
        ),
    ]
