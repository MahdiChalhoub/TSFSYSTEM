from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Replaces the single-code confirmation design (from 0014)
    with the dual-code design:
      - pos_return_code      / require_pos_return_code      (Register ↔ Driver)
      - client_delivery_code / require_client_delivery_code (Driver ↔ Client)

    Also updates pos_settings to have the two separate toggle fields
    instead of the single delivery_confirmation_enabled.
    """

    dependencies = [
        ('pos', '0014_deliveryorder_confirmation_code_and_more'),
    ]

    operations = [
        # ─── DeliveryOrder: replace old fields ───
        migrations.RemoveField(model_name='deliveryorder', name='confirmation_code'),
        migrations.RemoveField(model_name='deliveryorder', name='confirmation_required'),

        # Code 1: Register ↔ Driver
        migrations.AddField(
            model_name='deliveryorder',
            name='require_pos_return_code',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='pos_return_code',
            field=models.CharField(max_length=10, null=True, blank=True),
        ),

        # Code 2: Driver ↔ Client
        migrations.AddField(
            model_name='deliveryorder',
            name='require_client_delivery_code',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='client_delivery_code',
            field=models.CharField(max_length=10, null=True, blank=True),
        ),

        # ─── POSSettings: replace old field ───
        migrations.RemoveField(model_name='possettings', name='delivery_confirmation_enabled'),

        migrations.AddField(
            model_name='possettings',
            name='require_driver_pos_code',
            field=models.BooleanField(
                default=False,
                help_text='When enabled, the driver must show a code to the cashier when returning cash. '
                          'The code is displayed on the driver mobile page.',
            ),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_client_delivery_code',
            field=models.BooleanField(
                default=False,
                help_text='When enabled, the client receives a code at time of order. '
                          'The driver must ask the client for this code and enter it on their mobile page to confirm delivery.',
            ),
        ),
    ]
