from django.db import models
from decimal import Decimal
from erp.models import TenantModel
from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount
from apps.finance.models.ledger_models import JournalEntry

class Asset(TenantModel):
    CATEGORIES = (
        ('VEHICLE', 'Vehicle'),
        ('EQUIPMENT', 'Equipment'),
        ('IT', 'IT Equipment'),
        ('FURNITURE', 'Furniture'),
        ('BUILDING', 'Building'),
        ('LAND', 'Land'),
        ('OTHER', 'Other'),
    )
    DEPRECIATION_METHODS = (
        ('LINEAR', 'Straight Line'),
        ('DECLINING', 'Declining Balance'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('DISPOSED', 'Disposed'),
        ('WRITTEN_OFF', 'Written Off'),
        ('FULLY_DEPRECIATED', 'Fully Depreciated'),
    )
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORIES, default='OTHER')
    purchase_value = models.DecimalField(max_digits=15, decimal_places=2)
    purchase_date = models.DateField()
    useful_life_years = models.PositiveIntegerField(default=5)
    residual_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    depreciation_method = models.CharField(max_length=20, choices=DEPRECIATION_METHODS, default='LINEAR')
    accumulated_depreciation = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    book_value = models.DecimalField(max_digits=15, decimal_places=2)
    asset_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    depreciation_expense_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='depreciation_expenses')
    accumulated_depreciation_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='accumulated_depreciations')
    source_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_purchases')
    scope = models.CharField(max_length=20, default='OFFICIAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'asset'
    def save(self, *args, **kwargs):
        if not self.book_value:
            self.book_value = self.purchase_value - self.accumulated_depreciation
        super().save(*args, **kwargs)

class AmortizationSchedule(TenantModel):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='amortization_lines')
    period_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    is_posted = models.BooleanField(default=False)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    class Meta:
        db_table = 'amortizationschedule'
        ordering = ['period_date']
