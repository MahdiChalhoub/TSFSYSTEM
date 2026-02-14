# Hand-written migration: only SubscriptionPayment changes
# Auto-generated migration tried to delete business models that were moved to module apps.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0035_systemmodule_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionpayment',
            name='notes',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='previous_plan',
            field=models.ForeignKey(
                blank=True,
                help_text='Plan before the switch (for audit)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='upgrade_payments',
                to='erp.subscriptionplan',
            ),
        ),
        migrations.AddField(
            model_name='subscriptionpayment',
            name='type',
            field=models.CharField(
                choices=[
                    ('PURCHASE', 'Purchase Invoice'),
                    ('CREDIT_NOTE', 'Credit Note'),
                    ('RENEWAL', 'Renewal'),
                ],
                default='PURCHASE',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='subscriptionpayment',
            name='plan',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='payments',
                to='erp.subscriptionplan',
            ),
        ),
    ]
