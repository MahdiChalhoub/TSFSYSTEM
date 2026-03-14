"""
TaxAccountMapping Model
========================
Row-based replacement for the 7 FK columns on OrgTaxPolicy.
Each row maps ONE tax_type to ONE GL account within a policy.

Benefits vs FK columns:
- Extensible: new tax types don't require schema migrations
- Queryable: easy to find "which policies use account 4457?"
- Auditable: standard Django model lifecycle (signals, history)
- Mergeable: conceptually aligns with CustomTaxRule

Replaces:
    OrgTaxPolicy.vat_collected_account_id       → TaxAccountMapping(tax_type='VAT_OUTPUT')
    OrgTaxPolicy.vat_recoverable_account_id     → TaxAccountMapping(tax_type='VAT_INPUT')
    OrgTaxPolicy.vat_payable_account_id          → TaxAccountMapping(tax_type='VAT_PAYABLE')
    OrgTaxPolicy.vat_refund_receivable_account_id → TaxAccountMapping(tax_type='VAT_REFUND')
    OrgTaxPolicy.vat_suspense_account_id         → TaxAccountMapping(tax_type='VAT_SUSPENSE')
    OrgTaxPolicy.airsi_account_id                → TaxAccountMapping(tax_type='AIRSI')
    OrgTaxPolicy.reverse_charge_account_id       → TaxAccountMapping(tax_type='REVERSE_CHARGE')
"""
from django.db import models
from erp.models import TenantModel


class TaxAccountMapping(TenantModel):
    """
    Maps a tax type to a GL account within a tax policy.
    """

    TAX_TYPE_CHOICES = [
        # Core VAT
        ('VAT_OUTPUT', 'VAT Output (Collected)'),
        ('VAT_INPUT', 'VAT Input (Recoverable)'),
        ('VAT_PAYABLE', 'VAT Payable (Settlement)'),
        ('VAT_REFUND', 'VAT Refund Receivable'),
        ('VAT_SUSPENSE', 'VAT Suspense (Cash-Basis)'),
        # Withholding
        ('AIRSI', 'AIRSI / Withholding Tax'),
        ('REVERSE_CHARGE', 'Reverse Charge / Auto-liquidation'),
        # Extensible
        ('WHT_SALES', 'Withholding Tax on Sales'),
        ('WHT_PURCHASES', 'Withholding Tax on Purchases'),
        ('WHT_PAYABLE', 'Withholding Tax Payable'),
        ('PURCHASE_TAX', 'Purchase Tax'),
        ('SALES_TAX', 'Periodic Sales Tax'),
        ('PROFIT_TAX', 'Profit Tax'),
        ('CUSTOM', 'Custom Tax Type'),
    ]

    policy = models.ForeignKey(
        'finance.OrgTaxPolicy', on_delete=models.CASCADE,
        related_name='account_mappings',
        help_text='Tax policy this mapping belongs to',
    )
    tax_type = models.CharField(
        max_length=30, choices=TAX_TYPE_CHOICES,
        help_text='Tax type identifier',
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tax_account_mappings',
        help_text='GL account for this tax type',
    )
    description = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Human-readable note',
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_tax_account_mapping'
        unique_together = ('policy', 'tax_type')
        ordering = ['policy', 'tax_type']

    def __str__(self):
        acc_code = self.account.code if self.account else '(none)'
        return f"{self.policy.name} / {self.get_tax_type_display()} → {acc_code}"
