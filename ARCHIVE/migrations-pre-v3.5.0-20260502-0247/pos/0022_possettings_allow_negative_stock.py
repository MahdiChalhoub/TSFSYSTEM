from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0021_alter_registersession_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='possettings',
            name='allow_negative_stock',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'When enabled: cashiers can add out-of-stock items freely '
                    '(negative inventory allowed). When disabled: out-of-stock items are '
                    'blocked; overselling shows a warning toast.'
                ),
            ),
        ),
    ]
