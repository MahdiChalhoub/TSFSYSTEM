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
    # Contra-equity "temporary equity" marker — Owner Draws / Treasury Stock /
    # Dividends Declared. These accounts collect activity during the year
    # like P&L accounts, but live in the equity section of the BS. At
    # year-end close they must sweep into Retained Earnings alongside
    # INCOME/EXPENSE — otherwise equity fragments indefinitely (lifetime
    # draws accumulate as a free-standing DR row next to Capital and RE).
    # Independent of `type` on purpose: real equity accounts (Capital, RE)
    # MUST NOT close, so type=EQUITY alone is not a safe signal.
    clears_at_close = models.BooleanField(
        default=False,
        help_text=(
            'If True, this account is swept into Retained Earnings at fiscal '
            'year-end alongside INCOME/EXPENSE. Typical for Owner Draws, '
            'Dividends Declared, Treasury Stock — contra-equity "temporary" '
            'accounts. Leave False for Capital and Retained Earnings themselves.'
        ),
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
    # Drives which rate type the revaluation engine uses for this account.
    # Aligns with IAS 21 / ASC 830:
    #   MONETARY      → closing rate at period end (cash, AR, AP, FC loans)
    #   NON_MONETARY  → historical rate (no revaluation; PPE, prepaid expenses)
    #   INCOME_EXPENSE → average rate for the period (P&L items)
    # Service ignores revaluation_required for NON_MONETARY (historical cost
    # is the truth) and uses AVERAGE rate for INCOME_EXPENSE accounts.
    MONETARY_CLASSIFICATION_CHOICES = [
        ('MONETARY',       'Monetary (closing rate)'),
        ('NON_MONETARY',   'Non-monetary (historical, no revaluation)'),
        ('INCOME_EXPENSE', 'Income/Expense (average rate)'),
    ]
    monetary_classification = models.CharField(
        max_length=20, choices=MONETARY_CLASSIFICATION_CHOICES,
        default='MONETARY',
        help_text='IAS 21 / ASC 830 classification — drives rate type used at revaluation.',
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
    # When True, account is excluded from OFFICIAL view (internal-only).
    # Default False → all existing accounts remain visible in both views.
    is_internal = models.BooleanField(default=False, db_index=True)
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

    # ─────────────────────────────────────────────────────────────────
    # Branch-scope behavior (derived, not stored)
    # ─────────────────────────────────────────────────────────────────
    # Categorizes how an account's balance behaves under a branch filter.
    # Some accounts (AR, AP, Bank, Equity) are intrinsically tenant-wide:
    # filtering by branch produces the SAME balance because the account
    # represents an obligation/right of the company-as-a-whole. Others
    # (Sales, COGS, Operating Expense) accumulate per-branch — Branch A's
    # sales for the period really are a different number than Branch B's.
    # Inventory and WIP are branch-LOCATED: stock physically lives in one
    # warehouse / branch.
    #
    # The UI uses this to render twin "Branch / Total" columns honestly:
    #   - tenant_wide  → both columns equal (no real per-branch number)
    #   - branch_split → Branch column = filtered sum
    #   - branch_located → Branch column = filtered to that branch's
    #     warehouses; Total = tenant-wide.
    SCOPE_TENANT_WIDE = 'tenant_wide'
    SCOPE_BRANCH_SPLIT = 'branch_split'
    SCOPE_BRANCH_LOCATED = 'branch_located'

    @property
    def scope_mode(self) -> str:
        """Derive scope behavior from system_role + type.

        Order of resolution:
          1. Explicit system_role wins (most specific signal we have)
          2. Fallback to type-based classification (Income/Expense → split)

        This is a read-only derivation — change account_type or system_role
        on the record itself if you need to alter the behavior.
        """
        # 1) System-role overrides — most precise.
        role = (self.system_role or '').upper()
        if role in {'INVENTORY', 'INVENTORY_ASSET', 'WIP'}:
            return self.SCOPE_BRANCH_LOCATED
        if role in {
            'AR_CONTROL', 'AP_CONTROL', 'CASH_ACCOUNT', 'BANK_ACCOUNT',
            'TAX_PAYABLE', 'TAX_RECEIVABLE',
            'RETAINED_EARNINGS', 'P_L_SUMMARY', 'OPENING_BALANCE_OFFSET',
            'RECEIVABLE', 'PAYABLE', 'CAPITAL', 'WITHDRAWAL',
            'LOAN', 'WITHHOLDING', 'ACCUM_DEPRECIATION',
        }:
            return self.SCOPE_TENANT_WIDE
        if role in {
            'REVENUE', 'REVENUE_CONTROL', 'COGS', 'COGS_CONTROL',
            'EXPENSE', 'DISCOUNT_GIVEN', 'DISCOUNT_RECEIVED',
            'FX_GAIN', 'FX_LOSS', 'DEPRECIATION_EXP',
            'BAD_DEBT', 'DELIVERY_FEES', 'VAT_INPUT', 'VAT_OUTPUT',
            'GRNI',
        }:
            return self.SCOPE_BRANCH_SPLIT

        # 2) SYSCOHADA class signal — class 3 is stocks (inventory),
        # class 6 = charges, class 7 = produits. Catches inventory accounts
        # that admins haven't tagged with a system_role yet.
        sysco = (getattr(self, 'syscohada_code', None) or '').strip()
        if sysco:
            first = sysco[0]
            if first == '3':
                return self.SCOPE_BRANCH_LOCATED
            if first in ('6', '7'):
                return self.SCOPE_BRANCH_SPLIT

        # 3) Code prefix fallback — SYSCOHADA-styled codes even when
        # syscohada_code wasn't separately filled.
        code = (self.code or '').strip()
        if self.type == 'ASSET' and code and code[:2].isdigit() and code.startswith('3'):
            return self.SCOPE_BRANCH_LOCATED

        # 4) Name-keyword sniff for inventory-shaped accounts.
        name = (self.name or '').lower()
        if self.type == 'ASSET':
            for kw in ('stock', 'inventory', 'inventaire', 'marchandise',
                       'matiere', 'matière', 'wip', 'work in progress', 'en cours'):
                if kw in name:
                    return self.SCOPE_BRANCH_LOCATED

        # 5) Type-based fallback for accounts without a system_role.
        if self.type in ('INCOME', 'EXPENSE'):
            return self.SCOPE_BRANCH_SPLIT
        if self.type in ('LIABILITY', 'EQUITY'):
            return self.SCOPE_TENANT_WIDE
        # ASSET without any of the above signals — default tenant-wide
        # (covers AR/AP/Bank/Receivable/Cash). Admins override via system_role.
        return self.SCOPE_TENANT_WIDE

    def save(self, *args, **kwargs):
        # ── Enterprise Structural Lock ──
        if self.pk:
            # Check if this is a hierarchy change
            original = ChartOfAccount.objects.filter(pk=self.pk).first()
            if original and original.parent_id != self.parent_id:
                if self.organization.finance_setup_completed:
                    from django.core.exceptions import ValidationError
                    raise ValidationError("Chart of Accounts structure is locked. Cannot move accounts across the hierarchy after setup is completed.")

            # ── Invariant: cannot deactivate an account with a non-zero balance ──
            # Reclass the balance to another account first (manual JE).
            if original and original.is_active and not self.is_active:
                from decimal import Decimal
                if abs(self.balance_official or Decimal('0.00')) > Decimal('0.005') or \
                   abs(self.balance or Decimal('0.00')) > Decimal('0.005'):
                    from django.core.exceptions import ValidationError
                    raise ValidationError(
                        f"Cannot deactivate account {self.code} - {self.name}: "
                        f"balance is {self.balance_official} (official) / {self.balance} (internal). "
                        f"Reclass the balance to another account first."
                    )

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

        # ── Auto-maintain header flag on the parent ──
        # When an ACTIVE child is saved under a parent, that parent
        # becomes (or remains) a header node — its own balance is the
        # sum of its descendants and must never accept direct postings.
        # Inactive/archived children don't count: a parent whose only
        # children are ghosts (e.g. from an unused template import)
        # acts as a functional leaf and should remain postable.
        #
        # If we're saving an INACTIVE child AND the parent has no
        # other active children, flip the parent's allow_posting BACK
        # to True so it recovers leaf semantics.
        if self.parent_id:
            if self.is_active:
                ChartOfAccount.objects.filter(
                    id=self.parent_id, allow_posting=True,
                ).update(allow_posting=False)
            else:
                # Only restore if no active siblings remain
                siblings_active = ChartOfAccount.objects.filter(
                    parent_id=self.parent_id, is_active=True,
                ).exclude(pk=self.pk).exists()
                if not siblings_active:
                    ChartOfAccount.objects.filter(
                        id=self.parent_id, allow_posting=False,
                    ).update(allow_posting=True)

        # ── Forensic audit for structural / classification changes ──
        # COA mutations are rare but high-impact — a wrong type flip,
        # accidental parent re-link, or is_active toggle rewrites the
        # balance sheet everywhere. Log every save with the delta so
        # reviewers can reconstruct "who changed what when" without
        # needing database binlog access.
        try:
            from apps.finance.services.audit_service import ForensicAuditService
            changes = {
                'code': self.code, 'name': self.name,
                'type': self.type, 'parent_id': self.parent_id,
                'is_active': self.is_active,
                'allow_posting': self.allow_posting,
                'clears_at_close': getattr(self, 'clears_at_close', None),
                'system_role': self.system_role,
            }
            ForensicAuditService.log_mutation(
                organization=self.organization, user=getattr(self, 'updated_by', None),
                model_name='ChartOfAccount', object_id=self.pk,
                change_type='UPDATE' if self.pk else 'CREATE',
                payload=changes,
            )
        except Exception:
            pass

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


class FinancialAccountCategory(TenantModel):
    """
    Dynamic category for grouping financial accounts.
    Each category maps to a parent COA account so new financial accounts
    auto-create sub-accounts under the right branch.

    Category-level defaults are inherited by new child accounts.
    Digital categories enable payment gateway integration on child accounts.
    """
    name = models.CharField(max_length=100, help_text='Friendly name (e.g. "Cash Drawers", "Electronic Money")')
    code = models.CharField(max_length=30, help_text='Machine code (e.g. "CASH", "MOBILE")')
    icon = models.CharField(max_length=50, blank=True, default='wallet', help_text='Lucide icon name')
    color = models.CharField(max_length=20, blank=True, default='#6366f1', help_text='Hex color')
    description = models.TextField(blank=True, default='')
    coa_parent = models.ForeignKey(
        ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='financial_account_categories',
        help_text='Parent COA account — new financial accounts become sub-accounts of this'
    )
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # ── Category-Level Defaults (inherited by NEW child accounts) ──
    default_pos_enabled = models.BooleanField(
        default=False,
        help_text='New child accounts inherit this POS visibility setting'
    )
    default_has_account_book = models.BooleanField(
        default=False,
        help_text='New child accounts inherit this account book setting'
    )

    # ── Digital Account Classification ──
    is_digital = models.BooleanField(
        default=False,
        help_text='If true, child accounts can define payment gateway integrations'
    )
    digital_gateway = models.ForeignKey(
        'reference.OrgPaymentGateway', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='account_categories',
        help_text='Default payment gateway for child accounts (from org\'s activated gateways)'
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'financial_account_category'
        ordering = ['sort_order', 'name']
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.name} ({self.code})"


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
    category = models.ForeignKey(
        FinancialAccountCategory, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='accounts',
        help_text='Dynamic category (replaces hardcoded type field)'
    )
    currency = models.CharField(max_length=10, default='USD')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    description = models.TextField(null=True, blank=True)
    is_pos_enabled = models.BooleanField(default=False, help_text='Whether this account is available for POS transactions')
    has_account_book = models.BooleanField(default=False, help_text='Whether this account has a dedicated ledger book')
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    ledger_account = models.ForeignKey(ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True, db_column='ledger_account_id')
    is_active = models.BooleanField(default=True, help_text='Inactive accounts cannot be used in new transactions')

    # ── Digital Integration (per-account) ──
    digital_gateway = models.ForeignKey(
        'reference.OrgPaymentGateway', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='financial_accounts',
        help_text='Payment gateway (inherited from category or overridden)'
    )
    digital_config = models.JSONField(
        default=dict, blank=True,
        help_text='Provider-specific config: api_key, webhook_url, merchant_id, etc.'
    )

    class Meta:
        db_table = 'financialaccount'

    def __str__(self):
        return self.name

