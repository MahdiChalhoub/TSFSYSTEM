from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0021_alter_registersession_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='possettings',
            name='restrict_unique_cash_account',
            field=models.BooleanField(
                default=True,
                help_text=(
                    'When enabled: each register must have its own unique cash account. '
                    'A new cash account is auto-created under RegisterCash in the COA when creating a register. '
                    'Prevents two registers from sharing the same cash ledger account.'
                )
            ),
        ),
    ]
