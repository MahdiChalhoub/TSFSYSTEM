import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0010_checklistinstance_organization_and_more'),
        ('erp', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('leader', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='led_user_groups', to=settings.AUTH_USER_MODEL,
                )),
                ('members', models.ManyToManyField(
                    blank=True, related_name='user_groups', to=settings.AUTH_USER_MODEL,
                )),
                ('organization', models.ForeignKey(
                    db_column='tenant_id',
                    on_delete=django.db.models.deletion.CASCADE, to='erp.organization',
                )),
            ],
            options={
                'db_table': 'workspace_user_group',
            },
        ),
        migrations.AddConstraint(
            model_name='usergroup',
            constraint=models.UniqueConstraint(
                fields=('organization', 'name'),
                name='unique_user_group_name_per_org',
            ),
        ),
        migrations.AddField(
            model_name='autotaskrule',
            name='assign_to_user_group',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='auto_task_rules_assigned', to='workspace.usergroup',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='assigned_to_user_group',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tasks_received', to='workspace.usergroup',
            ),
        ),
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
                    ('PERIOD_CLOSING_SOON', 'Fiscal Period Closing Soon'),
                    ('PERIOD_STARTING_SOON', 'Next Fiscal Period Starting Soon'),
                    ('PERIOD_REOPEN_REQUEST', 'Fiscal Period Reopen Requested'),
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
    ]
