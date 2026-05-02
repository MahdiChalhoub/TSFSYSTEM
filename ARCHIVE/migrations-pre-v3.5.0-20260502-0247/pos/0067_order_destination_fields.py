# Generated manually for Order destination fields (Phase 2)
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0066_possettings_pos_offline_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='destination_country',
            field=models.CharField(blank=True, help_text='ISO country code of delivery destination', max_length=3, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='destination_region',
            field=models.CharField(blank=True, help_text='State/province/region for sub-national taxes', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='tax_jurisdiction_code',
            field=models.CharField(blank=True, help_text='Resolved jurisdiction code (read-only after calculation)', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='place_of_supply_mode',
            field=models.CharField(
                choices=[('ORIGIN', 'Origin'), ('DESTINATION', 'Destination'), ('REVERSE_CHARGE', 'Reverse Charge')],
                default='ORIGIN', max_length=20,
                help_text='How tax jurisdiction was determined'),
        ),
    ]
