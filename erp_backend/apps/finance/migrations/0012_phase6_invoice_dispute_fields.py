# Generated manually for Phase 6: Add dispute fields to Invoice

from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0011_add_internal_sales_vat_mode'),
    ]

    operations = [
        # 1. Add DISPUTED to Invoice STATUS_CHOICES
        migrations.AlterField(
            model_name='invoice',
            name='status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('SENT', 'Sent'),
                    ('POSTED', 'Posted (GL Recorded)'),
                    ('DISPUTED', 'Disputed'),
                    ('PARTIAL_PAID', 'Partially Paid'),
                    ('PAID', 'Paid'),
                    ('OVERDUE', 'Overdue'),
                    ('CANCELLED', 'Cancelled'),
                    ('WRITTEN_OFF', 'Written Off'),
                ],
                default='DRAFT',
                max_length=20,
            ),
        ),
        # 2. Add payment_blocked field
        migrations.AddField(
            model_name='invoice',
            name='payment_blocked',
            field=models.BooleanField(
                default=False,
                help_text='Blocked by 3-way match failure — cannot process payment',
            ),
        ),
        # 3. Add dispute_reason field
        migrations.AddField(
            model_name='invoice',
            name='dispute_reason',
            field=models.TextField(
                blank=True,
                help_text='Auto-generated reason from 3-way match validation',
                null=True,
            ),
        ),
        # 4. Add disputed_lines_count
        migrations.AddField(
            model_name='invoice',
            name='disputed_lines_count',
            field=models.IntegerField(
                default=0,
                help_text='Number of lines that failed 3-way match',
            ),
        ),
        # 5. Add disputed_amount_delta
        migrations.AddField(
            model_name='invoice',
            name='disputed_amount_delta',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Total excess amount (sum of excess × unit_price)',
                max_digits=15,
            ),
        ),
    ]
