"""
Add verification fields to Invoice model
=========================================
Fields added:
  - verified_by: User who verified the invoice
  - verified_at: Timestamp of verification
  - rejected_by: User who rejected the invoice
  - rejected_at: Timestamp of rejection
  - document_url: URL to scanned invoice document
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0042_financial_account_category'),
        ('erp', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='verified_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='verified_invoices',
                to='erp.User',
                help_text='User who verified this invoice'
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='verified_at',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text='Timestamp when invoice was verified'
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='rejected_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='rejected_invoices',
                to='erp.User',
                help_text='User who rejected this invoice'
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='rejected_at',
            field=models.DateTimeField(
                null=True,
                blank=True,
                help_text='Timestamp when invoice was rejected'
            ),
        ),
        migrations.AddField(
            model_name='invoice',
            name='document_url',
            field=models.CharField(
                max_length=500,
                null=True,
                blank=True,
                help_text='URL to scanned invoice document (PDF, image, etc.)'
            ),
        ),
    ]
