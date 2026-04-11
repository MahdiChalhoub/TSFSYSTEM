"""
Add global balance barcode configuration to POSSettings.
Balance config moves from per-unit to org-level global settings.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0070_packaging_snapshot_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='possettings',
            name='balance_item_digits',
            field=models.IntegerField(
                default=6,
                help_text='Number of digits for item/PLU code in balance barcode',
            ),
        ),
        migrations.AddField(
            model_name='possettings',
            name='balance_weight_int_digits',
            field=models.IntegerField(
                default=3,
                help_text='Number of digits for integer part of weight',
            ),
        ),
        migrations.AddField(
            model_name='possettings',
            name='balance_weight_dec_digits',
            field=models.IntegerField(
                default=3,
                help_text='Number of digits for decimal part of weight',
            ),
        ),
    ]
