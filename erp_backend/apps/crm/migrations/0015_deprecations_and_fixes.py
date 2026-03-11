"""
CRM Enterprise Hardening v1.2.1 — Deprecation & Fixes
- country_code: max_length 3 → 2 (ISO 3166-1 alpha-2)
- client_type: updated help_text with deprecation notice
- customer_type: updated help_text with deprecation notice
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0014_enterprise_hardening_v1_2'),
    ]

    operations = [
        # Fix country_code field width: max_length=3 → max_length=2
        migrations.AlterField(
            model_name='contact',
            name='country_code',
            field=models.CharField(
                blank=True,
                help_text='ISO 3166-1 alpha-2 country code (e.g. FR, US, CI)',
                max_length=2,
                null=True,
            ),
        ),
        # Deprecation notice on client_type
        migrations.AlterField(
            model_name='contact',
            name='client_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('B2B', 'Business (B2B) — Can receive TVA invoices'),
                    ('B2C', 'Individual (B2C) — Receives simple receipts only'),
                    ('UNKNOWN', 'Unknown — Not yet classified'),
                ],
                default='UNKNOWN',
                help_text=(
                    'DEPRECATED v1.2.0: Use tax_profile_id + commercial_category instead. '
                    'This field will be removed in v2.0.'
                ),
                max_length=10,
                null=True,
            ),
        ),
        # Deprecation notice on customer_type
        migrations.AlterField(
            model_name='contact',
            name='customer_type',
            field=models.CharField(
                blank=True,
                help_text='DEPRECATED: Legacy field. Use customer_tier instead.',
                max_length=50,
                null=True,
            ),
        ),
    ]
