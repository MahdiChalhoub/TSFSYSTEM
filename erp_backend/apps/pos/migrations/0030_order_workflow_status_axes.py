"""
Migration: 0030 — Order Workflow Status Axes + OrderLine Tax/COGS Fields
=========================================================================
Gap 1: Adds order_status, delivery_status, payment_status, invoice_status
        + workflow timestamps (confirmed_at, delivered_at, invoiced_at, closed_at)
Gap 2: Adds unit_cost_ht, effective_cost, price_override_detected, total to OrderLine
Gap 6: Adds tax_amount_ht, tax_amount_vat, tax_amount_ttc, airsi_withheld, is_tax_exempt to OrderLine

All new fields have safe defaults so existing rows are unaffected.
"""
from django.db import migrations, models
import decimal


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0029_order_is_export_invoice_type_expanded'),
    ]

    operations = [

        # ── Order: 4-Axis Status Fields ──────────────────────────────────
        migrations.AddField(
            model_name='order',
            name='order_status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'), ('CONFIRMED', 'Confirmed'),
                    ('PROCESSING', 'Processing'), ('CLOSED', 'Closed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='CONFIRMED',
                max_length=20,
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'), ('PARTIAL', 'Partially Delivered'),
                    ('DELIVERED', 'Delivered'), ('RETURNED', 'Returned'),
                    ('NA', 'Not Applicable'),
                ],
                default='PENDING',
                max_length=20,
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('UNPAID', 'Unpaid'), ('PARTIAL', 'Partially Paid'),
                    ('PAID', 'Paid'), ('OVERPAID', 'Overpaid'),
                    ('WRITTEN_OFF', 'Written Off'),
                ],
                default='UNPAID',
                max_length=20,
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='invoice_status',
            field=models.CharField(
                choices=[
                    ('NOT_GENERATED', 'Not Generated'), ('GENERATED', 'Generated'),
                    ('SENT', 'Sent to Client'), ('DISPUTED', 'Disputed'),
                ],
                default='NOT_GENERATED',
                max_length=20,
            ),
        ),

        # ── Order: Workflow Timestamps ───────────────────────────────────
        migrations.AddField(
            model_name='order',
            name='confirmed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='delivered_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='invoiced_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='closed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # ── OrderLine: total field ───────────────────────────────────────
        migrations.AddField(
            model_name='orderline',
            name='total',
            field=models.DecimalField(
                decimal_places=2, default=decimal.Decimal('0.00'),
                max_digits=15,
            ),
        ),

        # ── OrderLine: Tax-Split Fields (Gap 6) ─────────────────────────
        migrations.AddField(
            model_name='orderline',
            name='tax_amount_ht',
            field=models.DecimalField(
                decimal_places=2, default=decimal.Decimal('0.00'),
                help_text='Line amount excluding VAT (HT)', max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='tax_amount_vat',
            field=models.DecimalField(
                decimal_places=2, default=decimal.Decimal('0.00'),
                help_text='VAT portion on this line', max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='tax_amount_ttc',
            field=models.DecimalField(
                decimal_places=2, default=decimal.Decimal('0.00'),
                help_text='Total including VAT (TTC)', max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='airsi_withheld',
            field=models.DecimalField(
                decimal_places=2, default=decimal.Decimal('0.00'),
                help_text='AIRSI withholding on this line', max_digits=15,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='is_tax_exempt',
            field=models.BooleanField(
                default=False, help_text='True = line is VAT-exempt',
            ),
        ),

        # ── OrderLine: COGS Fields (Gap 2) ───────────────────────────────
        migrations.AddField(
            model_name='orderline',
            name='unit_cost_ht',
            field=models.DecimalField(
                decimal_places=4, default=decimal.Decimal('0.0000'),
                help_text='Average Moving Cost at time of sale', max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='effective_cost',
            field=models.DecimalField(
                decimal_places=4, default=decimal.Decimal('0.0000'),
                help_text='Effective cost used for COGS posting', max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name='orderline',
            name='price_override_detected',
            field=models.BooleanField(
                default=False,
                help_text='True if unit_price deviated >5% below base selling price',
            ),
        ),
    ]
