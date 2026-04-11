"""
Recurring Journal Models — Automated journal entry generation.

Used for:
  - Monthly depreciation entries
  - Rent / lease payments
  - Insurance amortization
  - Accruals (salary, interest)
  - Any repeating accounting event
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class RecurringJournalTemplate(TenantModel):
    """
    Template for automatically generated journal entries.
    The scheduler creates draft JEs from this template at each interval.
    """
    FREQUENCY_CHOICES = [
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('SEMI_ANNUAL', 'Semi-Annual'),
        ('ANNUAL', 'Annual'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('PAUSED', 'Paused'),
        ('EXPIRED', 'Expired'),
        ('COMPLETED', 'Completed'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    journal_type = models.CharField(max_length=20, default='GENERAL')
    scope = models.CharField(max_length=20, default='OFFICIAL')
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='MONTHLY')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    # Schedule
    start_date = models.DateField(help_text='First occurrence date')
    end_date = models.DateField(null=True, blank=True, help_text='Last occurrence (null = no end)')
    next_run_date = models.DateField(null=True, blank=True, help_text='Next scheduled generation')
    total_occurrences = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Max occurrences (null = unlimited until end_date)'
    )
    occurrences_created = models.PositiveIntegerField(default=0)

    # Behavior
    auto_post = models.BooleanField(
        default=False,
        help_text='If True, generated entries are posted immediately (no DRAFT stage)'
    )
    notify_on_creation = models.BooleanField(
        default=True,
        help_text='Send notification when a recurring entry is generated'
    )

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='recurring_journals_created'
    )
    last_generated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'finance_recurring_journal_template'
        ordering = ['next_run_date']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['next_run_date']),
        ]

    def __str__(self):
        return f"{self.name} ({self.frequency})"

    @property
    def is_expired(self):
        if self.end_date and self.next_run_date and self.next_run_date > self.end_date:
            return True
        if self.total_occurrences and self.occurrences_created >= self.total_occurrences:
            return True
        return False


class RecurringJournalLine(TenantModel):
    """Template lines for a recurring journal."""
    template = models.ForeignKey(
        RecurringJournalTemplate, on_delete=models.CASCADE, related_name='lines'
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT
    )
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, null=True, blank=True)
    partner_type = models.CharField(max_length=20, null=True, blank=True)
    partner_id = models.IntegerField(null=True, blank=True)
    cost_center = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'finance_recurring_journal_line'

    def __str__(self):
        return f"{self.account.code}: Dr {self.debit} / Cr {self.credit}"


class RecurringJournalExecution(TenantModel):
    """Log of each execution of a recurring template."""
    template = models.ForeignKey(
        RecurringJournalTemplate, on_delete=models.CASCADE, related_name='executions'
    )
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='recurring_source'
    )
    execution_date = models.DateField()
    occurrence_number = models.PositiveIntegerField()
    status = models.CharField(max_length=20, default='SUCCESS')
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_recurring_journal_execution'
        ordering = ['-execution_date']
        indexes = [
            models.Index(fields=['template', 'execution_date']),
        ]

    def __str__(self):
        return f"Exec #{self.occurrence_number} of {self.template.name}"
