"""
Add tax account FK fields to OrgTaxPolicy.
These fields link the Tax Engine directly to GL accounts in ChartOfAccount.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0033_tax_account_mapping'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='vat_collected_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_vat_collected', to='finance.chartofaccount',
                help_text='Output VAT liability on sales invoices'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='vat_recoverable_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_vat_recoverable', to='finance.chartofaccount',
                help_text='Input VAT asset on purchases'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='vat_payable_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_vat_payable', to='finance.chartofaccount',
                help_text='Net VAT due clearing account for settlement'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='vat_refund_receivable_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_vat_refund', to='finance.chartofaccount',
                help_text='VAT credit receivable when input > output'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='vat_suspense_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_vat_suspense', to='finance.chartofaccount',
                help_text='VAT suspense for cash-basis accounting'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='airsi_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_airsi', to='finance.chartofaccount',
                help_text='AIRSI withholding account'),
        ),
        migrations.AddField(
            model_name='orgtaxpolicy',
            name='reverse_charge_account',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='tax_policy_reverse_charge', to='finance.chartofaccount',
                help_text='Reverse charge / autoliquidation VAT account'),
        ),
    ]
