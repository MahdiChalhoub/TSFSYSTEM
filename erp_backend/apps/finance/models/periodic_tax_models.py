"""
PeriodicTaxAccrual
==================
Stores the result of a period-close tax accrual computation.

Types: TURNOVER (percentage of revenue), PROFIT (percentage of gross profit),
       FORFAIT (fixed periodic amount).

Created via PeriodicTaxAccrualService.run() — NOT on individual order lines.
"""
from decimal import Decimal
from django.db import models
from erp.models import TenantModel


class PeriodicTaxAccrual(TenantModel):

    TAX_TYPE = (
        ('TURNOVER', 'Turnover / Sales Tax (% of revenue)'),
        ('PROFIT',   'Profit Tax (% of gross profit)'),
        ('FORFAIT',  'Fixed Forfait / Minimum'),
    )

    STATUS = (
        ('DRAFT',   'Draft — not yet posted'),
        ('POSTED',  'Posted — journal entry created'),
        ('REVERSED','Reversed'),
    )

    # ── Period ────────────────────────────────────────────────────────
    period_start = models.DateField()
    period_end   = models.DateField()

    # ── Tax definition ─────────────────────────────────────────────────
    tax_type     = models.CharField(max_length=10, choices=TAX_TYPE)
    base_amount  = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                       help_text='Revenue or Profit base used for calculation')
    rate         = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal('0.0000'),
                                       help_text='Rate applied (0 for FORFAIT)')
    accrual_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # ── Journal entry ──────────────────────────────────────────────────
    journal_entry_id = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default='DRAFT')

    # ── Policy snapshot ────────────────────────────────────────────────
    policy_name = models.CharField(max_length=150, null=True, blank=True,
                                   help_text='Name of OrgTaxPolicy at accrual time')

    # ── Audit ──────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    created_by_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'periodic_tax_accrual'
        ordering = ['-period_end', 'tax_type']
        unique_together = ('organization', 'period_start', 'period_end', 'tax_type')

    def __str__(self):
        return f"{self.tax_type} {self.period_start}→{self.period_end}: {self.accrual_amount}"
