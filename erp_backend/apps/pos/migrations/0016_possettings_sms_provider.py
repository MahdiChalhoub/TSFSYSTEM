from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds SMS provider configuration fields to POSSettings.
    All fields are nullable/optional — existing rows continue to work unchanged.
    """

    dependencies = [
        ('pos', '0015_delivery_dual_code_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='possettings',
            name='sms_delivery_code_enabled',
            field=models.BooleanField(
                default=False,
                help_text='Send client_delivery_code to client via SMS when a delivery is created.',
            ),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_provider',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('none',            'Disabled'),
                    ('twilio',          'Twilio'),
                    ('africas_talking', "Africa's Talking"),
                    ('infobip',         'Infobip'),
                    ('webhook',         'Generic Webhook / Custom'),
                ],
                default='none',
                help_text='SMS gateway provider.',
            ),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_account_sid',
            field=models.CharField(max_length=200, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_api_key',
            field=models.CharField(max_length=500, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_sender_id',
            field=models.CharField(max_length=100, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_webhook_url',
            field=models.CharField(max_length=500, null=True, blank=True),
        ),
    ]
