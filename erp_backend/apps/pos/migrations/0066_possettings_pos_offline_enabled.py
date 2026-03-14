"""
Add pos_offline_enabled field to POSSettings.

When True (default): POS can queue orders offline and sync later.
When False: POS requires active internet — all operations blocked if offline.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0065_remove_disputecase_pos_dc_ts_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='possettings',
            name='pos_offline_enabled',
            field=models.BooleanField(
                default=True,
                help_text=(
                    'When enabled: POS can queue orders offline and sync when connection returns. '
                    'When disabled: POS requires active internet — all operations blocked if offline.'
                ),
            ),
        ),
    ]
