from django.db import models
from decimal import Decimal
from erp.models import TenantModel

class ChartOfAccount(TenantModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    type = models.CharField(max_length=20)
    sub_type = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance_official = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)
    is_system_only = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    requires_zero_balance = models.BooleanField(default=False)
    syscohada_code = models.CharField(max_length=20, null=True, blank=True)
    syscohada_class = models.CharField(max_length=10, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'chartofaccount'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.code} - {self.name}"

class FinancialAccount(TenantModel):
    ACCOUNT_TYPES = (
        ('CASH', 'Cash Drawer'),
        ('BANK', 'Bank Account'),
        ('MOBILE', 'Mobile Wallet'),
        ('PETTY_CASH', 'Petty Cash'),
        ('SAVINGS', 'Savings Account'),
        ('FOREIGN', 'Foreign Currency Account'),
        ('ESCROW', 'Escrow Account'),
        ('INVESTMENT', 'Investment Account'),
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=ACCOUNT_TYPES, null=True, blank=True)
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    description = models.TextField(null=True, blank=True)
    is_pos_enabled = models.BooleanField(default=False, help_text='Whether this account is available for POS transactions')
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    ledger_account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, db_column='ledger_account_id')

    class Meta:
        db_table = 'financialaccount'

    def __str__(self):
        return self.name

