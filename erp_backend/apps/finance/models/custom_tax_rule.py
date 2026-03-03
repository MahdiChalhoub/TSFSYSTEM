from django.db import models
from erp.models import TenantModel
from decimal import Decimal

class CustomTaxRule(TenantModel):
    """
    User-defined generic taxes that run AFTER the core tax engine (VAT, AIRSI).
    Allows organizations to create bespoke taxes (e.g. Eco Tax, Tourism Levy) 
    without hardcoding them into the main engine.
    """

    TRANSACTION_TYPES = [
        ('PURCHASE', 'Purchase Only'),
        ('SALE', 'Sale Only'),
        ('BOTH', 'Purchases & Sales'),
    ]

    MATH_BEHAVIORS = [
        ('ADDED_TO_TTC', 'Add to Invoice (like Sales Tax)'),
        ('WITHHELD_FROM_AP', 'Withhold from Counterparty (like AIRSI)'),
    ]

    COST_TREATMENTS = [
        ('CAPITALIZE', 'Add to Inventory Base Cost'),
        ('EXPENSE', 'Expense immediately to P&L'),
    ]

    name = models.CharField(max_length=150, help_text='Name of the custom tax (e.g., Eco Tax)')
    rate = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal('0.0000'))
    
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='BOTH')
    math_behavior = models.CharField(max_length=20, choices=MATH_BEHAVIORS, default='ADDED_TO_TTC')
    purchase_cost_treatment = models.CharField(max_length=20, choices=COST_TREATMENTS, default='EXPENSE')
    
    # Ledger Routing
    liability_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='custom_tax_liabilities',
        help_text='COA to credit when collecting tax on sales or withholding it on purchases.'
    )
    expense_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='custom_tax_expenses',
        help_text='COA to debit if purchase_cost_treatment = EXPENSE.'
    )
    
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_customtaxrule'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.rate})"
