"""
Migration 0031 — SalesAuditLog
================================
Gap 8 (ERP Roadmap): Adds sales_audit_log table.
Append-only, immutable diff log per sales Order.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0030_order_workflow_status_axes'),
        ('erp', '0004_user_pos_pin'),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesAuditLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sales_audit_logs',
                    to='erp.organization',
                )),
                ('order', models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_logs',
                    to='pos.order',
                )),
                ('actor', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sales_audit_actions',
                    to='erp.user',
                )),
                ('actor_name', models.CharField(
                    blank=True, max_length=150,
                    help_text='Denormalised actor name for display after user deletion',
                )),
                ('action_type', models.CharField(
                    db_index=True,
                    max_length=30,
                    choices=[
                        ('ORDER_CONFIRMED',    'Order Confirmed'),
                        ('ORDER_PROCESSING',   'Order In Processing'),
                        ('ORDER_CLOSED',       'Order Closed'),
                        ('ORDER_CANCELLED',    'Order Cancelled'),
                        ('DELIVERY_PARTIAL',   'Partial Delivery'),
                        ('DELIVERY_DELIVERED', 'Delivered'),
                        ('DELIVERY_RETURNED',  'Returned'),
                        ('DELIVERY_NA',        'Delivery N/A'),
                        ('PAYMENT_PARTIAL',    'Partial Payment'),
                        ('PAYMENT_PAID',       'Paid in Full'),
                        ('PAYMENT_WRITTEN_OFF','Written Off'),
                        ('PAYMENT_OVERPAID',   'Overpaid'),
                        ('INVOICE_GENERATED',  'Invoice Generated'),
                        ('INVOICE_SENT',       'Invoice Sent'),
                        ('INVOICE_DISPUTED',   'Invoice Disputed'),
                        ('STOCK_RESERVED',     'Stock Reserved'),
                        ('STOCK_RELEASED',     'Stock Released'),
                        ('STOCK_DEDUCTED',     'Stock Deducted on Delivery'),
                        ('FIELD_CHANGE',       'Field Changed'),
                        ('WORKFLOW_TRANSITION','Workflow Transition'),
                        ('NOTE',               'Manual Note'),
                    ],
                )),
                ('summary', models.CharField(
                    max_length=255,
                    help_text='One-line human-readable summary',
                )),
                ('diff', models.JSONField(
                    blank=True, default=dict,
                    help_text='{"field": {"before": ..., "after": ...}, ...}',
                )),
                ('order_status_snap',    models.CharField(blank=True, max_length=20)),
                ('delivery_status_snap', models.CharField(blank=True, max_length=20)),
                ('payment_status_snap',  models.CharField(blank=True, max_length=20)),
                ('invoice_status_snap',  models.CharField(blank=True, max_length=20)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('extra', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'db_table': 'sales_audit_log',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(
                        fields=['organization', 'order', 'created_at'],
                        name='sal_org_order_idx',
                    ),
                    models.Index(
                        fields=['organization', 'action_type', 'created_at'],
                        name='sal_org_action_idx',
                    ),
                ],
            },
        ),
    ]
