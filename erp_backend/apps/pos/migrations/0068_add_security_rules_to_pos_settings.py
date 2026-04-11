"""
Add security rules, delivery code config, and SMS trigger fields to POSSettings.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0067_order_destination_fields'),
    ]

    operations = [
        # ── Authentication Rules ──
        migrations.AddField(
            model_name='possettings',
            name='require_pin_for_login',
            field=models.BooleanField(default=True, help_text='Users must enter PIN to access POS.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='allow_cashier_switch',
            field=models.BooleanField(default=True, help_text='Allow switching cashier without closing register.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='auto_lock_idle_minutes',
            field=models.IntegerField(default=15, help_text='Auto-lock POS after this many idle minutes.'),
        ),
        # ── Manager Override Rules ──
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_void',
            field=models.BooleanField(default=True, help_text='Require manager PIN to void/cancel an order.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_discount',
            field=models.BooleanField(default=False, help_text='Require manager PIN to apply any discount.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_price_override',
            field=models.BooleanField(default=True, help_text='Require manager PIN to override item price.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_refund',
            field=models.BooleanField(default=True, help_text='Require manager PIN for refunds.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_clear_cart',
            field=models.BooleanField(default=False, help_text='Require manager PIN to clear the cart.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_manager_for_delete_item',
            field=models.BooleanField(default=False, help_text='Require manager PIN to delete a line item.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='max_discount_percent',
            field=models.IntegerField(default=20, help_text='Max discount percentage allowed without manager approval.'),
        ),
        # ── Register Close Rules ──
        migrations.AddField(
            model_name='possettings',
            name='lock_register_on_close',
            field=models.BooleanField(default=False, help_text='Lock register after closing, preventing re-open.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='print_receipt_on_close',
            field=models.BooleanField(default=True, help_text='Auto-print Z-Report on session close.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_count_on_close',
            field=models.BooleanField(default=True, help_text='Require physical cash count on close.'),
        ),
        # ── Reconciliation Rules ──
        migrations.AddField(
            model_name='possettings',
            name='enable_reconciliation',
            field=models.BooleanField(default=True, help_text='Enable full reconciliation process on close.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='controlled_accounts_are_truth',
            field=models.BooleanField(default=True, help_text='Wave/OM/Bank statement amounts are the source of truth.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='auto_calibrate_to_close',
            field=models.BooleanField(default=True, help_text='Auto-calibrate mismatches to cash account.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='require_statement_on_close',
            field=models.BooleanField(default=True, help_text='Cashier must enter provider statement amounts on close.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='enable_account_book',
            field=models.BooleanField(default=True, help_text='Enable the Livre de Caisse (cashier daily ledger).'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='auto_transfer_excess_to_reserve',
            field=models.BooleanField(default=False, help_text='Auto-transfer cash surplus to reserve account on close.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='auto_deduct_shortage_from_cashier',
            field=models.BooleanField(default=False, help_text='Auto-debit cashier for cash shortage on close.'),
        ),
        # ── Delivery Code Configuration ──
        migrations.AddField(
            model_name='possettings',
            name='delivery_code_mode',
            field=models.CharField(default='auto', help_text='Delivery code generation mode: auto, manual, or disabled.', max_length=20),
        ),
        migrations.AddField(
            model_name='possettings',
            name='delivery_code_digits',
            field=models.IntegerField(default=6, help_text='Number of digits in auto-generated delivery codes.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='delivery_code_expiry_hours',
            field=models.IntegerField(default=72, help_text='Hours before a delivery code expires.'),
        ),
        # ── SMS Notification Triggers ──
        migrations.AddField(
            model_name='possettings',
            name='sms_on_order_confirm',
            field=models.BooleanField(default=False, help_text='Send SMS to client when order is confirmed.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_on_delivery_assign',
            field=models.BooleanField(default=False, help_text='Send SMS to client when delivery is assigned.'),
        ),
        migrations.AddField(
            model_name='possettings',
            name='sms_on_delivery_complete',
            field=models.BooleanField(default=False, help_text='Send SMS to client when delivery is completed.'),
        ),
    ]
