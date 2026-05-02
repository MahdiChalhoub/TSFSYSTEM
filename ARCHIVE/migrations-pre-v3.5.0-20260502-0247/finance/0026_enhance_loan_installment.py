# Generated migration to enhance loan installment model

from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0025_bank_reconciliation_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='loan',
            name='disbursement_date',
            field=models.DateField(blank=True, null=True, help_text='Date when loan was disbursed'),
        ),
        migrations.AddField(
            model_name='loan',
            name='amortization_method',
            field=models.CharField(
                max_length=30,
                default='REDUCING_BALANCE',
                choices=[
                    ('REDUCING_BALANCE', 'Reducing Balance'),
                    ('FLAT_RATE', 'Flat Rate'),
                    ('BALLOON', 'Balloon Payment'),
                    ('INTEREST_ONLY', 'Interest Only'),
                ],
                help_text='Amortization calculation method'
            ),
        ),
        migrations.AddField(
            model_name='loaninstallment',
            name='installment_number',
            field=models.IntegerField(default=0, help_text='Installment sequence number'),
        ),
        migrations.AddField(
            model_name='loaninstallment',
            name='balance_after',
            field=models.DecimalField(
                max_digits=15,
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Remaining principal balance after this payment'
            ),
        ),
        # Add index for performance
        migrations.AddIndex(
            model_name='loaninstallment',
            index=models.Index(
                fields=['organization', 'loan', 'is_paid'],
                name='loan_inst_org_loan_paid_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='loaninstallment',
            index=models.Index(
                fields=['organization', 'due_date', 'status'],
                name='loan_inst_org_date_status_idx'
            ),
        ),
    ]
