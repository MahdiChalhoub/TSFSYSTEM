from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('client_portal', '0003_clientportalticketsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientportalconfig',
            name='storefront_theme',
            field=models.CharField(
                default='midnight',
                help_text='Active theme ID for the storefront (e.g. midnight, boutique)',
                max_length=50,
            ),
        ),
    ]
