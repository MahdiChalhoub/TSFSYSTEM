from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0005_contact_whatsapp_group_id'),
    ]

    operations = [
        migrations.AddField(
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
                help_text='B2B clients can receive an official TVA invoice. B2C clients get a plain receipt.',
                max_length=10,
                null=True,
            ),
        ),
    ]
