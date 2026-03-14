# Generated manually for performance optimization - 2026-03-12

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0023_rename_account_bal_organiz_54abac_idx_account_bal_organization__c281f2_idx_and_more'),
    ]

    operations = [
        # ─── INVOICE PERFORMANCE INDEXES ────────────────────────────────

        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['organization', 'transaction_date', 'status'],
                name='invoice_org_date_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['organization', 'contact', 'status'],
                name='invoice_org_contact_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['organization', 'due_date', 'status'],
                name='invoice_org_due_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(
                fields=['organization', 'invoice_type', 'status'],
                name='invoice_org_type_status_idx'
            ),
        ),

        # ─── PAYMENT PERFORMANCE INDEXES ────────────────────────────────

        migrations.AddIndex(
            model_name='payment',
            index=models.Index(
                fields=['organization', 'payment_date', 'status'],
                name='payment_org_date_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(
                fields=['organization', 'contact', 'status'],
                name='payment_org_contact_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='payment',
            index=models.Index(
                fields=['organization', 'payment_type', 'status'],
                name='payment_org_type_status_idx'
            ),
        ),

        # ─── JOURNAL ENTRY PERFORMANCE INDEXES ──────────────────────────

        migrations.AddIndex(
            model_name='journalentry',
            index=models.Index(
                fields=['organization', 'transaction_date', 'status'],
                name='journal_org_date_status_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='journalentry',
            index=models.Index(
                fields=['organization', 'fiscal_year', 'fiscal_period'],
                name='journal_org_fiscal_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='journalentry',
            index=models.Index(
                fields=['organization', 'status', 'transaction_date'],
                name='journal_org_status_date_idx'
            ),
        ),

        # ─── CHART OF ACCOUNTS PERFORMANCE INDEXES ──────────────────────

        migrations.AddIndex(
            model_name='chartofaccount',
            index=models.Index(
                fields=['organization', 'account_type', 'is_active'],
                name='coa_org_type_active_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='chartofaccount',
            index=models.Index(
                fields=['organization', 'code'],
                name='coa_org_code_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='chartofaccount',
            index=models.Index(
                fields=['organization', 'parent', 'is_active'],
                name='coa_org_parent_active_idx'
            ),
        ),

        # ─── PAYMENT ALLOCATION PERFORMANCE INDEXES ─────────────────────

        migrations.AddIndex(
            model_name='paymentallocation',
            index=models.Index(
                fields=['organization', 'invoice', 'payment'],
                name='payment_alloc_org_inv_pay_idx'
            ),
        ),

        # ─── INVOICE LINE PERFORMANCE INDEXES ───────────────────────────

        migrations.AddIndex(
            model_name='invoiceline',
            index=models.Index(
                fields=['organization', 'invoice'],
                name='invoice_line_org_inv_idx'
            ),
        ),
    ]
