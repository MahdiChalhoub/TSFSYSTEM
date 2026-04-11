# Generated manually to link InvoiceLine to PurchaseOrderLine

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0012_phase6_invoice_dispute_fields'),
        ('pos', '0047_phase3_partial_invoiced_policy'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoiceline',
            name='purchase_order_line',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='invoice_lines',
                to='pos.purchaseorderline',
            ),
        ),
    ]
