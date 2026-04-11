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

    TAX_BASE_MODES = [
        ('HT', 'Calculate on HT (pre-tax amount)'),
        ('TTC', 'Calculate on running gross (HT + all prior taxes in calculation_order)'),
        ('PREVIOUS_TAX', 'Calculate on a specific prior tax amount'),
    ]

    name = models.CharField(max_length=150, help_text='Name of the custom tax (e.g., Eco Tax)')
    rate = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal('0.0000'))
    
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='BOTH')
    math_behavior = models.CharField(max_length=20, choices=MATH_BEHAVIORS, default='ADDED_TO_TTC')
    purchase_cost_treatment = models.CharField(max_length=20, choices=COST_TREATMENTS, default='EXPENSE')

    # ── Compound Tax Support ──────────────────────────────────────────
    tax_base_mode = models.CharField(
        max_length=20, choices=TAX_BASE_MODES, default='HT',
        help_text='What base to calculate this tax on (HT, TTC, or a prior tax amount)'
    )
    base_tax_type = models.CharField(
        max_length=30, null=True, blank=True,
        help_text='If PREVIOUS_TAX: which tax_type to use as base (e.g. VAT, AIRSI, PURCHASE_TAX, CUSTOM)'
    )
    calculation_order = models.IntegerField(
        default=100,
        help_text='Deterministic priority (lower = earlier). Core taxes: VAT=10, AIRSI=20, PURCHASE_TAX=30. Custom default=100.'
    )
    compound_group = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Group tag for chained taxes (e.g. "brazil_composite", "india_gst")'
    )

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
