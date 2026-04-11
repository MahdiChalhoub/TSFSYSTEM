from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User
from apps.finance.models.coa_models import FinancialAccount
from apps.finance.models.ledger_models import JournalEntry
from apps.finance.models.transaction_models import Transaction

class Loan(TenantModel):
    AMORTIZATION_METHODS = (
        ('REDUCING_BALANCE', 'Reducing Balance'),
        ('FLAT_RATE', 'Flat Rate'),
        ('BALLOON', 'Balloon Payment'),
        ('INTEREST_ONLY', 'Interest Only'),
    )
    contract_number = models.CharField(max_length=100, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.PROTECT, related_name='loans')
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    interest_type = models.CharField(max_length=50, default='SIMPLE')
    amortization_method = models.CharField(max_length=50, choices=AMORTIZATION_METHODS, default='REDUCING_BALANCE')
    term_months = models.IntegerField(default=12)
    start_date = models.DateField(null=True, blank=True)
    disbursement_date = models.DateField(null=True, blank=True)
    payment_frequency = models.CharField(max_length=50, default='MONTHLY')
    status = models.CharField(max_length=20, default='DRAFT')
    scope = models.CharField(max_length=20, default='OFFICIAL')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_loans')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    class Meta:
        db_table = 'loan'

class LoanInstallment(TenantModel):
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='installments')
    installment_number = models.IntegerField(default=1)
    due_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance_after = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    is_paid = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='PENDING')
    paid_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'loaninstallment'

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
    financial_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
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
