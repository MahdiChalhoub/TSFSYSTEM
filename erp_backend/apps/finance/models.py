"""
Finance Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/finance/models.py)
All models retain their original db_table, so no database migration is needed.
"""
from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, VerifiableModel, Organization, Site, Country


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
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_journal_entries')
    posted_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_journal_entries')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    
    # Quantum Audit: Cryptographic Chaining
    entry_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, null=True, blank=True)

    def calculate_hash(self):
        """Calculates SHA-256 hash for this entry using metadata and lines."""
        from apps.finance.cryptography import LedgerCryptography
        lines_data = []
        for line in self.lines.all():
            lines_data.append({
                "account_id": str(line.account_id),
                "debit": str(line.debit),
                "credit": str(line.credit)
            })
        
        entry_meta = {
            "id": self.id,
            "organization_id": str(self.organization_id),
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "reference": self.reference,
            "lines": lines_data
        }
        return LedgerCryptography.calculate_entry_hash(entry_meta, self.previous_hash)

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        # Quantum Audit: Immutability Guard
        if self.pk:
            original = JournalEntry.objects.get(pk=self.pk)
            if original.status == 'POSTED' and self.status == 'POSTED':
                # Allow only 'is_locked' or 'is_verified' updates by system if needed
                # For now, block everything to be safe.
                # If we need to update 'posted_at' or 'posted_by' during POSTING,
                # the service layer should use .update() or we can add a bypass flag.
                if not bypass:
                    raise ValidationError("Immutable Ledger: 'POSTED' entries cannot be modified. Use reversals instead.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Quantum Audit: Deletion Guard
        if self.status == 'POSTED':
            raise ValidationError("Immutable Ledger: 'POSTED' entries cannot be deleted.")
        super().delete(*args, **kwargs)

    class Meta:
        db_table = 'journalentry'
        unique_together = ('reference', 'organization')
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

    @classmethod
    def next_value(cls, organization, seq_type):
        """
        Atomically retrieves and increments the sequence counter.
        Returns a formatted reference like 'ADJ-000001'.
        Creates the sequence if it doesn't exist.
        """
        from django.db.models import F
        seq, created = cls.objects.get_or_create(
            organization=organization,
            type=seq_type,
            defaults={'prefix': seq_type[:3].upper() + '-', 'next_number': 1, 'padding': 6}
        )
        current = seq.next_number
        cls.objects.filter(id=seq.id).update(next_number=F('next_number') + 1)
        prefix = seq.prefix or ''
        suffix = seq.suffix or ''
        return f"{prefix}{str(current).zfill(seq.padding)}{suffix}"


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
    scope = models.CharField(max_length=20, default='OFFICIAL')
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_loans')
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
        ('CAPITAL_INJECTION', 'Capital Injection'),
        ('PARTNER_LOAN', 'Partner Loan'),
        ('LOAN_DISBURSEMENT', 'Loan Disbursement'),
        ('LOAN_REPAYMENT', 'Loan Repayment'),
        ('EXPENSE', 'Expense'),
        ('SALARY_PAYMENT', 'Salary Payment'),
        ('DEFERRED_EXPENSE_CREATION', 'Deferred Expense Creation'),
        ('DEFERRED_EXPENSE_RECOGNITION', 'Deferred Expense Recognition'),
        ('ASSET_ACQUISITION', 'Asset Acquisition'),
        ('ASSET_DEPRECIATION', 'Asset Depreciation'),
        ('ASSET_DISPOSAL', 'Asset Disposal'),
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    loan = models.ForeignKey(Loan, on_delete=models.SET_NULL, null=True, blank=True)
    financial_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_events')
    date = models.DateTimeField(null=True, blank=True)
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='PENDING')
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'financialevent'


# =============================================================================
# DEFERRED EXPENSES (Long Expense Plans)
# =============================================================================

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
    source_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_sources')
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


# =============================================================================
# DIRECT EXPENSES (Immediate One-Time Expenses)
# =============================================================================

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
    source_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_expenses')
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


# =============================================================================
# ASSETS & AMORTIZATION
# =============================================================================

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
    source_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_purchases')
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


# =============================================================================
# VOUCHERS
# =============================================================================

class Voucher(VerifiableModel):
    """
    Financial voucher with lifecycle verification.
    Flow: OPEN → LOCKED → VERIFIED → CONFIRMED → Posted
    """
    VOUCHER_TYPES = (
        ('TRANSFER', 'Transfer Voucher'),
        ('RECEIPT', 'Receipt Voucher'),
        ('PAYMENT', 'Payment Voucher'),
    )
    voucher_type = models.CharField(max_length=20, choices=VOUCHER_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateField()
    reference = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    source_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers_out')
    destination_account = models.ForeignKey('FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers_in')
    financial_event = models.ForeignKey(FinancialEvent, on_delete=models.SET_NULL, null=True, blank=True, related_name='vouchers')
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    is_posted = models.BooleanField(default=False, help_text='Whether the voucher has been posted to the ledger')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'voucher'

    def clean(self):
        # Validation: RECEIPT and PAYMENT require a financial event
        if self.voucher_type in ('RECEIPT', 'PAYMENT') and not self.financial_event_id:
            raise ValidationError('Receipt and Payment vouchers must be linked to a financial event.')
        # Validation: TRANSFER must have both source and destination
        if self.voucher_type == 'TRANSFER' and (not self.source_account_id or not self.destination_account_id):
            raise ValidationError('Transfer vouchers require both source and destination accounts.')


# =============================================================================
# PROFIT DISTRIBUTION
# =============================================================================

class ProfitDistribution(TenantModel):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('APPROVED', 'Approved'),
        ('POSTED', 'Posted'),
    )
    fiscal_year = models.ForeignKey('FiscalYear', on_delete=models.CASCADE, related_name='profit_distributions')
    net_profit = models.DecimalField(max_digits=15, decimal_places=2)
    distribution_date = models.DateField()
    allocations = models.JSONField(default=dict)
    notes = models.TextField(null=True, blank=True)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'profitdistribution'

class ForensicAuditLog(TenantModel):
    CHANGE_TYPES = (
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('POST', 'Post'),
        ('REVERSE', 'Reverse'),
    )
    actor = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPES)
    payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'forensicauditlog'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['organization', 'model_name', 'object_id']),
            models.Index(fields=['organization', 'timestamp']),
        ]


# =============================================================================
# TAX GROUPS
# =============================================================================

class TaxGroup(TenantModel):
    """
    Named tax rate groups that can be linked to products.
    E.g., "Standard VAT 11%", "Reduced VAT 5.5%", "Zero-rated"
    """
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=5, decimal_places=2, help_text='Tax rate as percentage, e.g. 11.00 for 11%')
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'taxgroup'
        unique_together = ('name', 'organization')
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} ({self.rate}%)"


# Import models from sub-files so Django discovers them for migrations
from apps.finance.payment_models import Payment, CustomerBalance, SupplierBalance  # noqa: E402, F401
from apps.finance.invoice_models import Invoice, InvoiceLine  # noqa: E402, F401
from apps.finance.zatca_config import ZATCAConfig  # noqa: E402, F401
