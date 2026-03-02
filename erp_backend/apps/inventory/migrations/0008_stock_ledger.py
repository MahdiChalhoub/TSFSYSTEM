"""
Migration: 0008 — StockLedger (reservation-aware stock tracking)
=================================================================
Gap 3 (ERP Roadmap): Adds the stock_ledger table for tracking
reservation movements independently from raw on-hand quantity.

Safe: no existing table is altered.
"""
from django.db import migrations, models
import django.db.models.deletion
import decimal


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_add_product_packaging'),
        ('pos', '0030_order_workflow_status_axes'),
        ('erp', '0004_user_pos_pin'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockLedger',
            fields=[
                # TenantModel base fields (id, organization)
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                    related_name='stock_ledger_entries_org',
                )),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='stock_ledger',
                    to='inventory.product',
                )),
                ('warehouse', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='stock_ledger',
                    to='inventory.warehouse',
                )),
                ('order', models.ForeignKey(
                    blank=True,
                    help_text='Source order for this movement',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='stock_ledger_entries',
                    to='pos.order',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='erp.user',
                )),
                ('movement_type', models.CharField(
                    choices=[
                        ('RESERVATION',         'Reservation — stock committed on confirm'),
                        ('RESERVATION_RELEASE', 'Reservation Release — order cancelled'),
                        ('DELIVERY_DEDUCTION',  'Delivery Deduction — stock physically removed'),
                        ('RETURN',              'Return — stock returned to warehouse'),
                        ('ADJUSTMENT',          'Manual Adjustment'),
                    ],
                    db_index=True,
                    max_length=30,
                )),
                ('reserved_delta', models.DecimalField(
                    decimal_places=3,
                    default=decimal.Decimal('0.000'),
                    help_text='Change to reserved qty (+reserve / -release)',
                    max_digits=15,
                )),
                ('on_hand_delta', models.DecimalField(
                    decimal_places=3,
                    default=decimal.Decimal('0.000'),
                    help_text='Change to physical on-hand qty',
                    max_digits=15,
                )),
                ('running_on_hand', models.DecimalField(
                    decimal_places=3,
                    default=decimal.Decimal('0.000'),
                    max_digits=15,
                )),
                ('running_reserved', models.DecimalField(
                    decimal_places=3,
                    default=decimal.Decimal('0.000'),
                    max_digits=15,
                )),
                ('reference', models.CharField(
                    blank=True, max_length=200, null=True,
                    help_text='Human-readable reference, e.g. WF-RESERVE-42',
                )),
                ('note', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'db_table': 'stock_ledger',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(
                        fields=['organization', 'product', 'warehouse', 'created_at'],
                        name='sl_org_prod_wh_idx',
                    ),
                    models.Index(
                        fields=['order', 'movement_type'],
                        name='sl_order_type_idx',
                    ),
                ],
            },
        ),
    ]
