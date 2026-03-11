from django.db import models
from erp.models import TenantModel


class FiscalYear(TenantModel):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
        ('FINALIZED', 'Finalized'),
    ]
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    is_hard_locked = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')

    # Closing audit
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_fiscal_years'
    )
    closing_journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_fiscal_year',
        help_text='The year-end closing JE that transfers P&L into retained earnings'
    )

    class Meta:
        db_table = 'fiscalyear'
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name

    @property
    def is_posting_allowed(self):
        """Quick check: can any posting happen in this year?"""
        return not self.is_closed and not self.is_hard_locked


class FiscalPeriod(TenantModel):
    PERIOD_STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('SOFT_LOCKED', 'Soft Locked'),
        ('HARD_LOCKED', 'Hard Locked'),
        ('CLOSED', 'Closed'),
        ('FUTURE', 'Future'),
    ]
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=PERIOD_STATUS_CHOICES, default='OPEN')
    is_adjustment_period = models.BooleanField(
        default=False,
        help_text='13th period for year-end audit adjustments'
    )

    # Closing audit
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_fiscal_periods'
    )

    class Meta:
        db_table = 'fiscalperiod'
        unique_together = ('name', 'fiscal_year')
        ordering = ['start_date']

    def __str__(self):
        return f"{self.name} ({self.fiscal_year.name})"

    @property
    def is_posting_allowed(self):
        """OPEN → yes, SOFT_LOCKED → supervisor only, everything else → no."""
        return self.status == 'OPEN'

    @property
    def is_supervisor_posting_allowed(self):
        """OPEN or SOFT_LOCKED → yes for supervisors."""
        return self.status in ('OPEN', 'SOFT_LOCKED')

