# Generated manually for Phase 3: Add PARTIALLY_INVOICED + invoice_policy

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0046_phase2_supplier_declared_qty'),
    ]

    operations = [
        # 1. Update PurchaseOrder.status choices to include PARTIALLY_INVOICED
        migrations.AlterField(
            model_name='purchaseorder',
            name='status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('SUBMITTED', 'Submitted for Approval'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('SENT', 'Sent to Supplier'),
                    ('CONFIRMED', 'Confirmed by Supplier'),
                    ('IN_TRANSIT', 'In Transit / Dispatched'),
                    ('PARTIALLY_RECEIVED', 'Partially Received'),
                    ('RECEIVED', 'Fully Received'),
                    ('PARTIALLY_INVOICED', 'Partially Invoiced'),
                    ('INVOICED', 'Invoiced'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='DRAFT',
                max_length=25,
            ),
        ),
        # 2. Add invoice_policy field
        migrations.AddField(
            model_name='purchaseorder',
            name='invoice_policy',
            field=models.CharField(
                choices=[
                    ('RECEIVED_QTY', 'Received Quantity (default — 3-way match)'),
                    ('ORDERED_QTY', 'Ordered Quantity (2-way match)'),
                ],
                default='RECEIVED_QTY',
                help_text='Which qty the invoice is validated against',
                max_length=15,
            ),
        ),
    ]
