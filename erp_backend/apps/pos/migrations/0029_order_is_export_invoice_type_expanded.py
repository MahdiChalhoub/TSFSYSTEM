from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0028_order_line_tax_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='is_export',
            field=models.BooleanField(
                default=False,
                help_text='True = export sale - VAT rate overridden to 0'
            ),
        ),
    ]
