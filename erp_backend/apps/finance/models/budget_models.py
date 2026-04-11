"""
Budget Models — Budget vs. Actual analysis engine.

Supports:
  - Annual and periodic budgets per account
  - Budget versions (original, revised, forecast)
  - Variance tracking (amount + percentage)
  - Cost center / department budgeting
  - Budget locking for approval
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class Budget(TenantModel):
    """
    A budget header — one per fiscal year + version.
    Multiple versions allow original vs. revised tracking.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('LOCKED', 'Locked'),
        ('REJECTED', 'Rejected'),
    ]
    VERSION_TYPES = [
        ('ORIGINAL', 'Original Budget'),
        ('REVISED', 'Revised Budget'),
        ('FORECAST', 'Forecast'),
    ]

    name = models.CharField(max_length=200)
    fiscal_year = models.ForeignKey(
        'finance.FiscalYear', on_delete=models.PROTECT,
        related_name='budgets'
    )
    version = models.CharField(
        max_length=20, choices=VERSION_TYPES, default='ORIGINAL'
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='DRAFT'
    )
    scope = models.CharField(max_length=20, default='OFFICIAL')
    description = models.TextField(null=True, blank=True)

    # Totals (denormalized)
    total_budget = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='budgets_created'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='budgets_approved'
    )

    class Meta:
        db_table = 'finance_budget'
        unique_together = ('organization', 'fiscal_year', 'version')
        ordering = ['-fiscal_year__start_date', 'version']
        indexes = [
            models.Index(fields=['organization', 'fiscal_year', 'status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.version})"


class BudgetLine(TenantModel):
    """
    Budget allocation per account + period.
    Each line represents the budgeted amount for one account in one period.
    """
    budget = models.ForeignKey(
        Budget, on_delete=models.CASCADE, related_name='lines'
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT
    )
    fiscal_period = models.ForeignKey(
        'finance.FiscalPeriod', on_delete=models.PROTECT,
        null=True, blank=True,
        help_text='Null = annual budget (not broken down by period)'
    )
    cost_center = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Optional cost center for departmental budgets'
    )

    # Amounts
    budgeted_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Planned amount for this account/period'
    )

    # Actuals (updated by BalanceService or computed on-demand)
    actual_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Actual amount from posted JEs — refreshed periodically'
    )
    committed_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Committed but not yet posted (POs, requisitions)'
    )

    # Computed (denormalized for performance)
    variance_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Budget - Actual (positive = under budget)'
    )
    variance_percentage = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal('0.00'),
        help_text='Variance as percentage of budget'
    )
    available_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Budget - Actual - Committed'
    )

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'finance_budget_line'
        indexes = [
            models.Index(fields=['budget', 'account']),
            models.Index(fields=['budget', 'fiscal_period']),
            models.Index(fields=['budget', 'cost_center']),
        ]

    def __str__(self):
        period = self.fiscal_period.name if self.fiscal_period else 'Annual'
        return f"{self.account.code} — {period}: {self.budgeted_amount}"

    def recompute_variance(self):
        """Recompute variance fields from actuals."""
        self.variance_amount = self.budgeted_amount - self.actual_amount
        if self.budgeted_amount and self.budgeted_amount != Decimal('0'):
            self.variance_percentage = (
                (self.variance_amount / self.budgeted_amount) * Decimal('100')
            )
        else:
            self.variance_percentage = Decimal('0.00')
        self.available_amount = self.budgeted_amount - self.actual_amount - self.committed_amount
        self.save(update_fields=[
            'variance_amount', 'variance_percentage', 'available_amount',
            'actual_amount', 'committed_amount',
        ])
