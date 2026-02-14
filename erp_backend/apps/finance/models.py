"""
Finance Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/finance/models.py)
All models retain their original db_table, so no database migration is needed.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, Organization, Site, Country


# =============================================================================
# CHART OF ACCOUNTS & GENERAL LEDGER
# =============================================================================

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
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, null=True, blank=True)
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    linked_coa = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, db_column='ledger_account_id')

    class Meta:
        db_table = 'financialaccount'

    def __str__(self):
        return self.name


# =============================================================================
# FISCAL YEARS & PERIODS
# =============================================================================

class FiscalYear(TenantModel):
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    is_hard_locked = models.BooleanField(default=False)

    class Meta:
        db_table = 'fiscalyear'
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name


class FiscalPeriod(TenantModel):
    PERIOD_STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
        ('FUTURE', 'Future'),
    ]
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=100)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=PERIOD_STATUS_CHOICES, default='OPEN')

    class Meta:
        db_table = 'fiscalperiod'
        unique_together = ('name', 'fiscal_year')
        ordering = ['start_date']


# =============================================================================
# JOURNAL ENTRIES (DOUBLE-ENTRY BOOKKEEPING)
# =============================================================================

class JournalEntry(TenantModel):
    transaction_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField()
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT, null=True, blank=True)
    fiscal_period = models.ForeignKey(FiscalPeriod, on_delete=models.PROTECT, null=True, blank=True, related_name='journal_entries')
    status = models.CharField(max_length=20, default='DRAFT')
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'journalentry'
        indexes = [
            models.Index(fields=['organization', 'transaction_date']),
            models.Index(fields=['organization', 'scope']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['reference']),
        ]

    def __str__(self):
        return f"JE-{self.id}: {self.description[:50]}"


class JournalEntryLine(TenantModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')
    employee = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')

    class Meta:
        db_table = 'journalentryline'
        indexes = [
            models.Index(fields=['organization', 'account']),
            models.Index(fields=['journal_entry']),
            models.Index(fields=['organization', 'debit', 'credit']),
        ]


# =============================================================================
# TRANSACTIONS (CASH REGISTER / FINANCIAL ACCOUNT MOVEMENTS)
# =============================================================================

class Transaction(TenantModel):
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    description = models.CharField(max_length=255, null=True, blank=True)
    reference = models.CharField(max_length=100, null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'transaction'


class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50)
    prefix = models.CharField(max_length=20, null=True, blank=True)
    suffix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)
    padding = models.IntegerField(default=6)

    class Meta:
        db_table = 'transactionsequence'
        unique_together = ('type', 'organization')


# =============================================================================
# BARCODE SETTINGS
# =============================================================================

class BarcodeSettings(TenantModel):
    prefix = models.CharField(max_length=10, default="200")
    next_sequence = models.IntegerField(default=1000)
    format = models.CharField(max_length=20, default='EAN13')
    is_enabled = models.BooleanField(default=True)
    length = models.IntegerField(default=13)

    class Meta:
        db_table = 'barcodesettings'


# =============================================================================
# LOANS
# =============================================================================

class Loan(TenantModel):
    contract_number = models.CharField(max_length=100, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.PROTECT, related_name='loans')
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    interest_type = models.CharField(max_length=50, default='SIMPLE')
    term_months = models.IntegerField(default=12)
    start_date = models.DateField(null=True, blank=True)
    payment_frequency = models.CharField(max_length=50, default='MONTHLY')
    status = models.CharField(max_length=20, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'loan'


class LoanInstallment(TenantModel):
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='installments')
    due_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    is_paid = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='PENDING')
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'loaninstallment'


# =============================================================================
# FINANCIAL EVENTS
# =============================================================================

class FinancialEvent(TenantModel):
    EVENT_TYPES = (
        ('PARTNER_WITHDRAWAL', 'Partner Withdrawal'),
        ('PARTNER_INJECTION', 'Partner Injection'),
        ('LOAN_DISBURSEMENT', 'Loan Disbursement'),
        ('LOAN_REPAYMENT', 'Loan Repayment'),
        ('EXPENSE', 'Expense'),
        ('SALARY_PAYMENT', 'Salary Payment'),
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    loan = models.ForeignKey(Loan, on_delete=models.SET_NULL, null=True, blank=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    date = models.DateTimeField(null=True, blank=True)
    reference = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='PENDING')
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'financialevent'
