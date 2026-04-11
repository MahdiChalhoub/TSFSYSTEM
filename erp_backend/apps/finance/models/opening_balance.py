"""
Opening Balance Model — Separated from migration journal entries.
Per SAP/Odoo/Oracle standard: opening balances are a distinct entity
that auditors can verify independently from operational journal entries.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class OpeningBalance(TenantModel):
    """
    Stores opening balances per account per fiscal year.
    These are NOT journal entries — they are the starting point
    for each fiscal year, generated from:
      - TRANSFER: year-end close carry-forward
      - MANUAL: user-entered opening balances
      - MIGRATION: data migration from external system
    """
    SOURCE_CHOICES = [
        ('TRANSFER', 'Year-End Transfer'),
        ('MANUAL', 'Manual Entry'),
        ('MIGRATION', 'Data Migration'),
    ]
    SCOPE_CHOICES = [
        ('OFFICIAL', 'Official'),
        ('INTERNAL', 'Internal'),
    ]

    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='opening_balances'
    )
    fiscal_year = models.ForeignKey(
        'finance.FiscalYear', on_delete=models.PROTECT,
        related_name='opening_balances'
    )
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='OFFICIAL')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')

    # Currency support
    currency = models.CharField(max_length=10, null=True, blank=True)
    amount_currency = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Balance in foreign currency (if multi-currency account)'
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_opening_balances'
    )
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'opening_balance'
        unique_together = ('account', 'fiscal_year', 'scope', 'organization')
        indexes = [
            models.Index(fields=['organization', 'fiscal_year']),
        ]

    def __str__(self):
        net = self.debit_amount - self.credit_amount
        return f"OB: {self.account.code} / {self.fiscal_year.name} = {net}"

    @property
    def net_balance(self):
        return self.debit_amount - self.credit_amount
