# Generated manually for FNE API integration fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0051_einvoice_standard'),
    ]

    operations = [
        # Add fne_balance_sticker to Invoice
        migrations.AddField(
            model_name='invoice',
            name='fne_balance_sticker',
            field=models.IntegerField(
                blank=True, null=True,
                help_text='Remaining FNE sticker balance at time of certification',
            ),
        ),
        # Add fne_item_id to InvoiceLine
        migrations.AddField(
            model_name='invoiceline',
            name='fne_item_id',
            field=models.CharField(
                blank=True, max_length=255, null=True,
                help_text='FNE platform item UUID (needed for refund/avoir endpoint)',
            ),
        ),
        # Update fne_status help_text
        migrations.AlterField(
            model_name='invoice',
            name='fne_status',
            field=models.CharField(
                choices=[
                    ('NONE', 'Not Certified'),
                    ('PENDING', 'Pending Certification'),
                    ('CERTIFIED', 'Certified'),
                    ('FAILED', 'Certification Failed'),
                    ('REFUNDED', 'Refunded / Reversed'),
                ],
                default='NONE', max_length=20,
                help_text="DGI Côte d'Ivoire FNE / Saudi ZATCA certification status",
            ),
        ),
    ]
