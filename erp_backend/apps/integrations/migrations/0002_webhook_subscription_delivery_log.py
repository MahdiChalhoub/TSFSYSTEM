# Generated manually — eCommerce Phase 2 Domain Event System
# Creates webhook_subscription and webhook_delivery_log tables

from django.db import migrations, models
import django.db.models.deletion


SUPPORTED_EVENTS = [
    ('order.placed',      'Order Placed'),
    ('order.confirmed',   'Order Confirmed'),
    ('order.shipped',     'Order Shipped'),
    ('order.delivered',   'Order Delivered'),
    ('order.cancelled',   'Order Cancelled'),
    ('order.returned',    'Order Returned'),
    ('payment.confirmed', 'Payment Confirmed'),
]


class Migration(migrations.Migration):

    dependencies = [
        # integrations app initial state — adjust if a 0001_initial already exists
        ('integrations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WebhookSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='+',
                    to='erp.organization',
                )),
                ('event_type', models.CharField(choices=SUPPORTED_EVENTS, max_length=50)),
                ('target_url', models.URLField()),
                ('secret', models.CharField(blank=True, default='', max_length=255)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'webhook_subscription', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='WebhookDeliveryLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='+',
                    to='erp.organization',
                )),
                ('subscription', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='delivery_logs',
                    to='integrations.webhooksubscription',
                )),
                ('event_type', models.CharField(max_length=50)),
                ('payload', models.JSONField()),
                ('response_status', models.IntegerField(blank=True, null=True)),
                ('response_body', models.TextField(blank=True, default='')),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('failed', models.BooleanField(default=False)),
                ('error_message', models.TextField(blank=True, default='')),
                ('retry_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'webhook_delivery_log', 'ordering': ['-created_at']},
        ),
    ]
