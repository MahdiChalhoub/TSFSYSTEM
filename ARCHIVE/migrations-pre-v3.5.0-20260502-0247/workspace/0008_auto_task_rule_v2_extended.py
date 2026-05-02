# Migration 0008: AutoTaskRule v2 extended fields (Gap 1C.10)
#
# The physical database table has a subset of the expected columns.
# Migrations 0003-0006 were recorded as "applied" but some SQL never executed.
# This migration:
#   1. Adds missing columns with IF NOT EXISTS (idempotent)
#   2. Restores `organization` to Django's migration state
#   3. Syncs field definitions in state
#   4. Adds the unique constraint

from django.db import migrations, models
import django.db.models.deletion


ADD_MISSING_COLUMNS = """
-- Fields from migration 0003 that never physically ran
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS rule_type VARCHAR(15) DEFAULT 'EVENT';
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'MEDIUM';
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS recurrence_interval VARCHAR(15);
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS recurrence_time TIME;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS last_fired_at TIMESTAMPTZ;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS chain_parent_id BIGINT;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS chain_delay_minutes INTEGER DEFAULT 0;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS broadcast_to_role BOOLEAN DEFAULT FALSE;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS stale_threshold_days INTEGER DEFAULT 0;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT FALSE;

-- Fields from base model that may be missing
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS custom_event_code VARCHAR(100);
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS template_id BIGINT;
ALTER TABLE workspace_auto_task_rule ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}';

-- Self-referential FK for chain_parent (may already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'workspace_atr_chain_parent_fk'
    ) THEN
        ALTER TABLE workspace_auto_task_rule
            ADD CONSTRAINT workspace_atr_chain_parent_fk
            FOREIGN KEY (chain_parent_id) REFERENCES workspace_auto_task_rule(id)
            ON DELETE SET NULL;
    END IF;
END $$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('erp', '0012_transactionstatuslog_meta_transactiontype_and_more'),
        ('workspace', '0007_create_missing_tables'),
    ]

    operations = [
        # 1. Add all missing columns via raw SQL (idempotent)
        migrations.RunSQL(
            sql=ADD_MISSING_COLUMNS,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # 2. Re-add organization to Django state ONLY (tenant_id column exists)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='autotaskrule',
                    name='organization',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='%(app_label)s_%(class)s_set',
                        to='erp.organization',
                        db_column='tenant_id',
                    ),
                ),
            ],
            database_operations=[],
        ),

        # 3. Sync field definitions in state — no SQL needed
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='code',
                    field=models.CharField(
                        max_length=20, null=True, blank=True,
                        help_text='Unique rule identifier per org, e.g. INV-01, PUR-07',
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='module',
                    field=models.CharField(
                        max_length=30, null=True, blank=True,
                        help_text='Originating module: inventory, purchasing, finance, crm, sales, hr, system',
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='rule_type',
                    field=models.CharField(
                        max_length=15,
                        choices=[('EVENT', 'Event-triggered (one-shot)'), ('RECURRING', 'Recurring (scheduled)')],
                        default='EVENT',
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='priority',
                    field=models.CharField(
                        max_length=10,
                        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')],
                        default='MEDIUM',
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='chain_parent',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.SET_NULL,
                        null=True, blank=True,
                        related_name='chain_children',
                        to='workspace.autotaskrule',
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='recurrence_interval',
                    field=models.CharField(
                        max_length=15,
                        choices=[('DAILY', 'Daily'), ('WEEKLY', 'Weekly'), ('MONTHLY', 'Monthly'), ('QUARTERLY', 'Quarterly')],
                        null=True, blank=True,
                    ),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='stale_threshold_days',
                    field=models.IntegerField(default=0),
                ),
                migrations.AlterField(
                    model_name='autotaskrule',
                    name='is_system_default',
                    field=models.BooleanField(default=False),
                ),
            ],
            database_operations=[],
        ),

        # 4. Expand trigger_event choices
        migrations.AlterField(
            model_name='autotaskrule',
            name='trigger_event',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('PRICE_CHANGE', 'Product Price Changed'),
                    ('LOW_STOCK', 'Low Stock Alert'),
                    ('NEGATIVE_STOCK', 'Negative Stock Detected'),
                    ('NEW_INVOICE', 'New Invoice Received'),
                    ('EXPIRY_APPROACHING', 'Product Expiry Approaching'),
                    ('PRODUCT_EXPIRED', 'Product Expired'),
                    ('PRODUCT_CREATED', 'New Product Created'),
                    ('PO_APPROVED', 'Purchase Order Approved'),
                    ('CLIENT_COMPLAINT', 'Client Complaint Filed'),
                    ('NEW_SUPPLIER', 'New Supplier Onboarded'),
                    ('NEW_CLIENT', 'New Client Registered'),
                    ('DELIVERY_COMPLETED', 'Delivery Completed'),
                    ('ORDER_COMPLETED', 'Order Completed'),
                    ('INVENTORY_COUNT', 'Inventory Count Needed'),
                    ('STOCK_ADJUSTMENT', 'Stock Adjustment Made'),
                    ('BARCODE_MISSING_PURCHASE', 'Barcode Missing on Purchase'),
                    ('BARCODE_MISSING_TRANSFER', 'Barcode Missing on Transfer'),
                    ('BARCODE_DAILY_CHECK', 'Daily Barcode Check'),
                    ('PURCHASE_ENTERED', 'Purchase Entered'),
                    ('PURCHASE_NO_ATTACHMENT', 'Purchase Without Attachment'),
                    ('RECEIPT_VOUCHER', 'Receipt Voucher Arrived'),
                    ('PROFORMA_RECEIVED', 'Proforma Received'),
                    ('TRANSFER_CREATED', 'Transfer Order Created'),
                    ('ORDER_STALE', 'Order Stale / Untreated'),
                    ('CREDIT_SALE', 'Credit Sale Made'),
                    ('HIGH_VALUE_SALE', 'High-Value Sale'),
                    ('OVERDUE_INVOICE', 'Invoice Overdue'),
                    ('PAYMENT_DUE_SUPPLIER', 'Supplier Payment Due'),
                    ('POS_RETURN', 'POS Return Processed'),
                    ('CASHIER_DISCOUNT', 'Cashier Applied Discount'),
                    ('DAILY_SUMMARY', 'End-of-Day Summary'),
                    ('BANK_STATEMENT', 'Bank Statement Received'),
                    ('MONTH_END', 'Month-End Close'),
                    ('LATE_PAYMENT', 'Late Payment Detected'),
                    ('CLIENT_FOLLOWUP_DUE', 'Client Follow-Up Due'),
                    ('SUPPLIER_FOLLOWUP_DUE', 'Supplier Follow-Up Due'),
                    ('CLIENT_INACTIVE', 'Client Inactive'),
                    ('ADDRESS_BOOK_VERIFY', 'Address Book Verification'),
                    ('USER_REGISTRATION', 'New User Registration'),
                    ('REPORT_NEEDS_REVIEW', 'Report Needs Review'),
                    ('APPROVAL_PENDING', 'Approval Pending'),
                    ('EMPLOYEE_ONBOARD', 'Employee Onboarding'),
                    ('LEAVE_REQUEST', 'Leave Request'),
                    ('ATTENDANCE_ANOMALY', 'Attendance Anomaly'),
                    ('CUSTOM', 'Custom Event'),
                ],
            ),
        ),

        # 5. Add unique constraint
        migrations.AddConstraint(
            model_name='autotaskrule',
            constraint=models.UniqueConstraint(
                fields=['organization', 'code'],
                name='unique_auto_task_rule_code_per_org',
                condition=models.Q(code__isnull=False),
            ),
        ),
    ]
