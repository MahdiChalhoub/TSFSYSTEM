from django.db import models
from decimal import Decimal
from erp.models import TenantModel


# ═══════════════════════════════════════════════════════════════════
# Normal Balance Matrix (SAP/Odoo/Oracle standard)
# ═══════════════════════════════════════════════════════════════════
NORMAL_BALANCE_MAP = {
    'ASSET': 'DEBIT',
    'EXPENSE': 'DEBIT',
    'LIABILITY': 'CREDIT',
    'EQUITY': 'CREDIT',
    'INCOME': 'CREDIT',
}

# Universal Account Class Codes (independent of any one standard)
ACCOUNT_CLASS_MAP = {
    'ASSET': '1',
    'LIABILITY': '2',
    'EQUITY': '3',
    'INCOME': '4',
    'EXPENSE': '5',
}

ACCOUNT_CLASS_NAMES = {
    '1': 'Assets',
    '2': 'Liabilities',
    '3': 'Equity',
    '4': 'Revenue',
    '5': 'Cost & Expenses',
    '6': 'Operating Expenses',
    '7': 'Other Income/Expense',
    '8': 'Tax & Government',
    '9': 'System & Clearing',
}


class ChartOfAccount(TenantModel):
    """
    Enterprise-grade Chart of Accounts with SAP/Odoo/Oracle behavioral fields.
    Every field follows the architecture in .ai/docs/financial-engine-architecture.md
    """

    # ── Identity ───────────────────────────────────────────────────
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # ── Classification ─────────────────────────────────────────────
    ACCOUNT_TYPES = [
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    ]
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    sub_type = models.CharField(max_length=50, null=True, blank=True)

    # Universal class — fast reporting (WHERE class_code='1' vs WHERE type IN (...))
    class_code = models.CharField(
        max_length=5, null=True, blank=True, db_index=True,
        help_text='Universal account class: 1=Asset, 2=Liability, 3=Equity, 4=Revenue, 5=Expense, 6-9=Extended'
    )
    class_name = models.CharField(max_length=50, null=True, blank=True)

    # ── Behavioral Rules (the biggest gap, now closed) ─────────────
    NORMAL_BALANCE_CHOICES = [('DEBIT', 'Debit'), ('CREDIT', 'Credit')]
    normal_balance = models.CharField(
        max_length=6, choices=NORMAL_BALANCE_CHOICES, null=True, blank=True,
        help_text='Debit or Credit — auto-resolved from type if blank'
    )
    allow_posting = models.BooleanField(
        default=True,
        help_text='If False, this is a header/parent account — no direct journal entries'
    )
    allow_reconciliation = models.BooleanField(
        default=False,
        help_text='If True, this account supports line-level reconciliation (AR/AP/Bank)'
    )
    is_control_account = models.BooleanField(
        default=False,
        help_text='AR/AP control accounts — posting only via subledger'
    )

    # ── Subledger Linking ──────────────────────────────────────────
    SUBLEDGER_TYPES = [
        ('CUSTOMER', 'Customer'),
        ('SUPPLIER', 'Supplier'),
        ('EMPLOYEE', 'Employee'),
        ('BANK', 'Bank'),
    ]
    subledger_type = models.CharField(
        max_length=20, choices=SUBLEDGER_TYPES, null=True, blank=True,
        help_text='Links to CRM contacts, employees, or bank accounts'
    )

    # ── Enterprise Metadata (v2.2 Architecture) ─────────────────────
    SYSTEM_ROLE_CHOICES = [
        # ── Core Control Accounts ──
        ('AR_CONTROL', 'Accounts Receivable Control'),
        ('AP_CONTROL', 'Accounts Payable Control'),
        ('CASH_ACCOUNT', 'Cash Account'),
        ('BANK_ACCOUNT', 'Bank Account'),
        ('REVENUE_CONTROL', 'Revenue Account'),
        ('COGS_CONTROL', 'Cost of Goods Sold Account'),
        ('INVENTORY_ASSET', 'Inventory Asset'),
        ('TAX_PAYABLE', 'Tax Payable'),
        ('TAX_RECEIVABLE', 'Tax Receivable'),
        ('RETAINED_EARNINGS', 'Retained Earnings'),
        ('P_L_SUMMARY', 'Current Year Profit/Loss'),
        ('OPENING_BALANCE_OFFSET', 'Opening Balance Offset'),
        ('ROUNDING_DIFF', 'Rounding Difference'),
        ('EXCHANGE_DIFF', 'Exchange Difference'),
        ('SUSPENSE', 'Suspense/Clearing Account'),
        # ── Posting-Specific Roles (Phase A) ──
        ('RECEIVABLE', 'Accounts Receivable'),
        ('PAYABLE', 'Accounts Payable'),
        ('VAT_INPUT', 'VAT Deductible / Input'),
        ('VAT_OUTPUT', 'VAT Collected / Output'),
        ('REVENUE', 'Revenue / Sales Income'),
        ('COGS', 'Cost of Goods Sold'),
        ('INVENTORY', 'Inventory / Stock'),
        ('EXPENSE', 'General Expense'),
        ('DISCOUNT_GIVEN', 'Discount Given / Allowed'),
        ('DISCOUNT_RECEIVED', 'Discount Received / Earned'),
        ('FX_GAIN', 'Foreign Exchange Gain'),
        ('FX_LOSS', 'Foreign Exchange Loss'),
        ('WIP', 'Work In Progress'),
        ('DELIVERY_FEES', 'Freight / Delivery Fees'),
        ('CAPITAL', 'Owner Capital / Equity'),
        ('WITHDRAWAL', 'Owner Withdrawals / Draws'),
        ('DEPRECIATION_EXP', 'Depreciation Expense'),
        ('ACCUM_DEPRECIATION', 'Accumulated Depreciation'),
        ('LOAN', 'Loans / Borrowings'),
        ('WITHHOLDING', 'Withholding Tax / AIRSI'),
        ('BAD_DEBT', 'Bad Debt Expense'),
        ('GRNI', 'Goods Received Not Invoiced'),
    ]
    system_role = models.CharField(
        max_length=30, choices=SYSTEM_ROLE_CHOICES, null=True, blank=True,
        help_text='Enterprise role for programmatic engine lookups'
    )

    SECTION_CHOICES = [
        ('BS_ASSET', 'Balance Sheet: Assets'),
        ('BS_LIABILITY', 'Balance Sheet: Liabilities'),
        ('BS_EQUITY', 'Balance Sheet: Equity'),
        ('IS_REVENUE', 'Income Statement: Revenue'),
        ('IS_EXPENSE', 'Income Statement: Expense'),
    ]
    financial_section = models.CharField(
        max_length=20, choices=SECTION_CHOICES, null=True, blank=True,
        help_text='Auto-mapping for financial statements'
    )

    template_origin = models.CharField(max_length=50, null=True, blank=True, help_text='Original template key (e.g., IFRS_COA)')
    template_version = models.CharField(max_length=20, null=True, blank=True, help_text='Template version string')

    is_structure_locked = models.BooleanField(
        default=False,
        help_text='Once locked, this account cannot be deleted or moved in the hierarchy'
    )

    # ── Multi-Currency ─────────────────────────────────────────────
    currency = models.CharField(
        max_length=10, null=True, blank=True,
        help_text='Restrict this account to a specific currency (null = org default)'
    )
    allow_multi_currency = models.BooleanField(
        default=False,
        help_text='If True, multiple currencies can post to this account'
    )
    revaluation_required = models.BooleanField(
        default=False,
        help_text='If True, this account needs FX revaluation at period end'
    )

    # ── Hierarchy ──────────────────────────────────────────────────
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    path = models.CharField(
        max_length=500, null=True, blank=True, db_index=True,
        help_text='Materialized path (e.g., "1000.1100.1110") — for fast tree queries'
    )

    # ── Balances ───────────────────────────────────────────────────
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance_official = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # ── Flags ──────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_system_only = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    requires_zero_balance = models.BooleanField(default=False)

    # ── Cross-Standard References ──────────────────────────────────
    syscohada_code = models.CharField(max_length=20, null=True, blank=True)
    syscohada_class = models.CharField(max_length=10, null=True, blank=True)

    # ── Audit Fields (compliance) ──────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_coa_accounts'
    )
    updated_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_coa_accounts'
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='locked_coa_accounts'
    )

    class Meta:
        db_table = 'chartofaccount'
        unique_together = ('code', 'organization')
        indexes = [
            models.Index(fields=['organization', 'class_code']),
            models.Index(fields=['organization', 'type']),
            models.Index(fields=['organization', 'is_active']),
            models.Index(fields=['organization', 'system_role']),
            models.Index(fields=['path']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        # ── Enterprise Structural Lock ──
        if self.pk:
            # Check if this is a hierarchy change
            original = ChartOfAccount.objects.filter(pk=self.pk).first()
            if original and original.parent_id != self.parent_id:
                if self.organization.finance_setup_completed:
                    from django.core.exceptions import ValidationError
                    raise ValidationError("Chart of Accounts structure is locked. Cannot move accounts across the hierarchy after setup is completed.")

        # ── Auto-resolve normal_balance from type ──────────────────
        if not self.normal_balance and self.type:
            self.normal_balance = NORMAL_BALANCE_MAP.get(self.type)

        # ── Auto-resolve class_code from type ──────────────────────
        if not self.class_code and self.type:
            self.class_code = ACCOUNT_CLASS_MAP.get(self.type)
        if self.class_code and not self.class_name:
            self.class_name = ACCOUNT_CLASS_NAMES.get(self.class_code)

        # ── Auto-build materialized path ───────────────────────────
        if self.parent_id:
            parent_path = self.parent.path or self.parent.code
            self.path = f"{parent_path}.{self.code}"
        else:
            self.path = self.code

        # ── Auto-detect control account + reconciliation ───────────
        if self.sub_type in ('RECEIVABLE', 'PAYABLE') and not self.pk:
            self.is_control_account = True
            self.allow_reconciliation = True
        if self.sub_type in ('BANK', 'CASH') and not self.pk:
            self.allow_reconciliation = True

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.organization.finance_setup_completed:
            from django.core.exceptions import ValidationError
            raise ValidationError("Chart of Accounts is locked. Accounts can only be deactivated, not deleted, after setup is completed.")
        super().delete(*args, **kwargs)

    @property
    def effective_normal_balance(self):
        """Always returns the correct normal balance, even if the field is blank."""
        return self.normal_balance or NORMAL_BALANCE_MAP.get(self.type, 'DEBIT')

    @property
    def is_debit_normal(self):
        return self.effective_normal_balance == 'DEBIT'


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

