# Generated manually for delivery payment fields
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0012_posauditevent_posauditrule'),
    ]

    operations = [
        migrations.AddField(
            model_name='deliveryorder',
            name='payment_mode',
            field=models.CharField(
                choices=[
                    ('IMMEDIATE', 'Pay immediately to delivery man'),
                    ('CREDIT', 'Client credit (authority required)'),
                    ('HOLD', 'Hold — delivery man brings cash back'),
                ],
                default='HOLD',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('PAID', 'Paid'),
                    ('CREDITED', 'Credited'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='amount_due',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='amount_collected',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=15),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='confirmed_by_driver',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='confirmed_by_pos',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='deliveryorder',
            name='session',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='delivery_orders',
                to='pos.registersession',
            ),
        ),
    ]
