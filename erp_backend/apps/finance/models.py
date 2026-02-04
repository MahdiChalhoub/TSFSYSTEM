from django.db import models
from decimal import Decimal
from erp.models import TenantModel, Site, Contact, User
# NOTE: We import from erp.models temporarily. 
# In a perfect world, modules would depend on a 'core' package.

class ChartOfAccount(TenantModel):
    ACCOUNT_TYPES = (
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    sub_type = models.CharField(max_length=50, null=True, blank=True) # e.g. 'CASH', 'BANK'
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    is_system_only = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_hidden = models.BooleanField(default=False)
    requires_zero_balance = models.BooleanField(default=False)
    
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance_official = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Regulatory Mapping
    syscohada_code = models.CharField(max_length=50, null=True, blank=True)
    syscohada_class = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ChartOfAccount'
        unique_together = ('code', 'organization')

    def __str__(self):
        return f"{self.code} - {self.name}"

class FinancialAccount(TenantModel):
    FINANCIAL_TYPES = (
        ('CASH', 'Cash'),
        ('BANK', 'Bank'),
        ('MOBILE', 'Mobile'),
    )
    site = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=FINANCIAL_TYPES)
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    ledger_account = models.OneToOneField(ChartOfAccount, on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        db_table = 'FinancialAccount'
        unique_together = ('name', 'organization', 'site')

    def __str__(self):
        return self.name

class FiscalYear(TenantModel):
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    is_hard_locked = models.BooleanField(default=False)

    class Meta:
        db_table = 'FiscalYear'
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name

class FiscalPeriod(TenantModel):
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'FiscalPeriod'
        unique_together = ('name', 'fiscal_year')

    def __str__(self):
        return f"{self.fiscal_year.name} - {self.name}"

class JournalEntry(TenantModel):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('REVERSED', 'Reversed'),
        ('VOID', 'Void'),
    )
    SCOPE_CHOICES = (
        ('OFFICIAL', 'Official'),
        ('INTERNAL', 'Internal'),
    )
    transaction_date = models.DateTimeField()
    description = models.TextField()
    reference = models.CharField(max_length=100, unique=True)
    
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT)
    fiscal_period = models.ForeignKey(FiscalPeriod, on_delete=models.PROTECT)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='OFFICIAL')
    
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    
    is_verified = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'JournalEntry'

class JournalEntryLine(TenantModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='journal_lines')
    
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    description = models.TextField(null=True, blank=True)
    
    contact_id = models.IntegerField(null=True, blank=True)
    employee_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'JournalEntryLine'

class Transaction(TenantModel):
    TRANSACTION_TYPES = (
        ('IN', 'Inbound/Deposit'),
        ('OUT', 'Outbound/Withdrawal'),
    )
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    description = models.TextField(null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Transaction'

class Loan(TenantModel):
    INTEREST_TYPES = (
        ('NONE', 'None'),
        ('SIMPLE', 'Simple'),
        ('COMPOUND', 'Compound')
    )
    FREQUENCIES = (
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('YEARLY', 'Yearly')
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('DEFAULTED', 'Defaulted')
    )

    contract_number = models.CharField(max_length=50)
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name='loans')
    
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2) # Annual %
    interest_type = models.CharField(max_length=20, choices=INTEREST_TYPES, default='SIMPLE')
    
    term_months = models.IntegerField()
    start_date = models.DateField()
    payment_frequency = models.CharField(max_length=20, choices=FREQUENCIES, default='MONTHLY')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Loan'
        unique_together = ('contract_number', 'organization')

class LoanInstallment(TenantModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('PARTIAL', 'Partial'),
        ('OVERDUE', 'Overdue')
    )
    
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='installments')
    due_date = models.DateField()
    
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'LoanInstallment'

class FinancialEvent(TenantModel):
    EVENT_TYPES = (
        ('PARTNER_CAPITAL_INJECTION', 'Capital Injection'),
        ('PARTNER_LOAN', 'Partner Loan'),
        ('PARTNER_WITHDRAWAL', 'Partner Withdrawal'),
        ('REFUND_RECEIVED', 'Refund Received'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SETTLED', 'Settled'),
        ('CANCELLED', 'Cancelled')
    )

    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    date = models.DateTimeField()
    
    reference = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name='financial_events')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    loan = models.ForeignKey(Loan, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'FinancialEvent'
