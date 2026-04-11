"""
Migration 0034 — SalesPaymentLeg (Gap 5: Payment Reconciliation Layer)

Creates the sales_payment_leg table for per-payment-leg tracking,
enabling reconciliation status management and multi-instrument payment recording.
"""
from decimal import Decimal
import django.db.models.deletion
from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0034_merge_20260302_2042'),
        ('pos', '0034_merge_20260302_2044'),
        ('finance', '0001_initial'),
        ('inventory', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesPaymentLeg',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='erp.organization',
                    db_column='organization_id',
                )),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='payment_legs',
                    to='pos.order',
                )),
                ('payment_method', models.CharField(
                    max_length=20,
                    choices=[
                        ('CASH', 'Cash'),
                        ('WAVE', 'Wave'),
                        ('ORANGE_MONEY', 'Orange Money'),
                        ('MTN_MOBILE', 'MTN Mobile Money'),
                        ('MOBILE', 'Mobile Money (generic)'),
                        ('BANK', 'Bank Transfer'),
                        ('CREDIT', 'Credit / A/R'),
                        ('REWARD_POINTS', 'Loyalty Points'),
                        ('WALLET_DEBIT', 'Wallet Debit'),
                        ('ROUND_OFF', 'Rounding Adjustment'),
                        ('OTHER', 'Other'),
                    ],
                )),
                ('amount', models.DecimalField(max_digits=15, decimal_places=2)),
                ('status', models.CharField(
                    max_length=12, default='POSTED', db_index=True,
                    choices=[
                        ('POSTED', 'Posted — not yet reconciled'),
                        ('RECONCILED', 'Reconciled — matched to statement'),
                        ('WRITTEN_OFF', 'Written Off — approved shortfall'),
                        ('REFUNDED', 'Refunded — money returned to customer'),
                    ],
                )),
                ('reference', models.CharField(max_length=200, null=True, blank=True, db_index=True)),
                ('ledger_account', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='finance.chartofaccount',
                    null=True, blank=True,
                )),
                ('journal_entry', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='finance.journalentry',
                    null=True, blank=True,
                    related_name='payment_legs',
                )),
                ('write_off', models.DecimalField(
                    max_digits=15, decimal_places=2, default=Decimal('0.00'),
                    help_text='Portion written off (approved shortfall)',
                )),
                ('write_off_reason', models.TextField(null=True, blank=True)),
                ('reconciled_at', models.DateTimeField(null=True, blank=True)),
                ('reconciled_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                    null=True, blank=True,
                    related_name='reconciled_payment_legs',
                )),
                ('posted_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                    null=True, blank=True,
                    related_name='posted_payment_legs',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
            ],
            options={
                'db_table': 'sales_payment_leg',
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['order', 'status'], name='spl_order_status_idx'),
                    models.Index(fields=['organization', 'payment_method', 'status'], name='spl_org_method_status_idx'),
                    models.Index(fields=['reference'], name='spl_reference_idx'),
                ],
            },
        ),
    ]
