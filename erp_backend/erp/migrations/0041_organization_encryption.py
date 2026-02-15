"""
Migration: Add AES-256 encryption fields to Organization.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0040_add_scope_pins_to_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='encryption_key',
            field=models.CharField(
                blank=True,
                help_text='Base64-encoded AES-256 key (per-org)',
                max_length=64,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='encryption_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Whether field-level encryption is active',
            ),
        ),
    ]
