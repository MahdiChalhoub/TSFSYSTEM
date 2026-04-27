"""
Adds FRANKFURTER + EXCHANGERATE_HOST to CurrencyRatePolicy.PROVIDER_CHOICES.

These are both free FX feeds — Frankfurter wraps ECB in JSON (no auth, broader
uptime than the raw ECB XML), and exchangerate.host covers ~170 currencies
including AED/SAR without needing the EUR/USD peg fall-back.

Choices-only change; no DDL required at the DB layer (CharField with new
options). Stored as a no-op AlterField for migration history correctness.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0072_currencyratepolicy_sync_frequency'),
    ]

    operations = [
        migrations.AlterField(
            model_name='currencyratepolicy',
            name='provider',
            field=models.CharField(
                max_length=30,
                default='MANUAL',
                choices=[
                    ('MANUAL', 'Manual entry only'),
                    ('ECB', 'European Central Bank (free, daily, EUR-base)'),
                    ('FRANKFURTER', 'Frankfurter (free, JSON wrapper over ECB)'),
                    ('EXCHANGERATE_HOST', 'exchangerate.host (free tier, 170+ currencies, API key)'),
                    ('FIXER', 'Fixer.io (API key required)'),
                    ('OPENEXCHANGERATES', 'OpenExchangeRates.org (API key required)'),
                ],
            ),
        ),
    ]
