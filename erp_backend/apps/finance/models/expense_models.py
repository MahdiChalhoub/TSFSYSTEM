from django.db import models
from decimal import Decimal
from erp.models import TenantModel
from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount
from apps.finance.models.ledger_models import JournalEntry
from apps.finance.models.loan_models import FinancialEvent

class DeferredExpense(TenantModel):
    CATEGORIES = (
        ('SUBSCRIPTION', 'Subscription'),
        ('RENOVATION', 'Renovation'),
        ('ADVERTISING', 'Advertising'),
        ('INSURANCE', 'Insurance'),
        ('RENT_ADVANCE', 'Rent Advance'),
        ('OTHER', 'Other'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORIES, default='OTHER')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    start_date = models.DateField()
    duration_months = models.PositiveIntegerField()
    monthly_amount = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    remaining_amount = models.DecimalField(max_digits=15, decimal_places=2)
    months_recognized = models.PositiveIntegerField(default=0)
    source_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_sources')
    deferred_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_assets')
    expense_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_expenses')
    scope = models.CharField(max_length=20, default='OFFICIAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'deferredexpense'
    def save(self, *args, **kwargs):
        if self.duration_months > 0:
            self.monthly_amount = (self.total_amount / self.duration_months).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

class DirectExpense(TenantModel):
    CATEGORIES = (
        ('RENT', 'Rent'),
        ('UTILITIES', 'Utilities'),
        ('OFFICE_SUPPLIES', 'Office Supplies'),
        ('SALARIES', 'Salaries'),
        ('MAINTENANCE', 'Maintenance'),
        ('TRANSPORT', 'Transport'),
        ('TELECOM', 'Telecom'),
        ('PROFESSIONAL_FEES', 'Professional Fees'),
        ('TAXES_FEES', 'Taxes & Fees'),
        ('MARKETING', 'Marketing'),
        ('OTHER', 'Other'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('CANCELLED', 'Cancelled'),
    )
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORIES, default='OTHER')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateField()
    reference = models.CharField(max_length=100, null=True, blank=True)
    source_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_expenses')
    expense_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_expenses')
    financial_event = models.ForeignKey(FinancialEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_expenses')
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_expenses')
    scope = models.CharField(max_length=20, default='OFFICIAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'directexpense'
        ordering = ['-date', '-created_at']
    def __str__(self):
        return f"{self.name} — {self.amount}"
