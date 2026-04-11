"""
COATemplate, COATemplateAccount, COATemplatePostingRule & COATemplateMigrationMap Models
========================================================================================
Database-backed COA templates with normalized accounts, embedded posting rules,
and cross-template migration mappings with match metadata.

Architecture layers:
  Layer 1 — Template Library (COATemplate + COATemplateAccount)
  Layer 2 — Semantic Mapping Library (COATemplateMigrationMap)
"""
import logging
import unicodedata
import re
from django.db import models
from django.conf import settings
from erp.models import TenantModel

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
#  System Role Catalogue
# ═══════════════════════════════════════════════════════════════

SYSTEM_ROLE_CHOICES = [
    # ── Treasury & Cash ──
    ('CASH_ACCOUNT', 'Cash in Hand / Petty Cash'),
    ('BANK_ACCOUNT', 'Bank Accounts'),
    ('CASH_OVER_SHORT', 'Cash Over/Short'),
    # ── Receivables ──
    ('RECEIVABLE', 'Accounts Receivable'),
    ('CUSTOMER_ADVANCE', 'Customer Advances / Prepayments'),
    # ── Inventory ──
    ('INVENTORY', 'Finished Goods / Merchandise'),
    ('GOODS_IN_TRANSIT', 'Goods in Transit'),
    ('INVENTORY_VARIANCE', 'Inventory Count Variance'),
    ('GRNI', 'Goods Received Not Invoiced'),
    # ── Prepayments & Accruals ──
    ('PREPAID_EXPENSES', 'Prepaid Expenses'),
    ('ACCRUED_EXPENSES', 'Accrued Expenses'),
    # ── Fixed Assets ──
    ('DEPRECIATION', 'Accumulated Depreciation'),
    # ── Tax ──
    ('VAT_INPUT', 'VAT Deductible (Input)'),
    ('VAT_OUTPUT', 'VAT Collected (Output)'),
    ('VAT_RECEIVABLE', 'VAT Refundable'),
    ('VAT_PAYABLE', 'VAT Due to State'),
    ('WHT_PAYABLE', 'Withholding Tax Payable'),
    ('AIRSI_PAYABLE', 'AIRSI Tax Payable'),
    ('TAX_EXPENSE', 'Income Tax Expense'),
    ('PAYROLL_TAX', 'Payroll Tax Payable'),
    ('SOCIAL_SECURITY', 'Social Security Payable'),
    # ── Payables ──
    ('PAYABLE', 'Accounts Payable'),
    ('SUPPLIER_ADVANCE', 'Supplier Advances / Prepayments'),
    ('SALARY_PAYABLE', 'Salaries Payable'),
    ('DEFERRED_REVENUE', 'Deferred / Unearned Revenue'),
    # ── Loans ──
    ('LOAN_SHORT', 'Short-term Loans Payable'),
    ('LOAN_LONG', 'Long-term Loans Payable'),
    # ── Intercompany ──
    ('INTERCO_DUE_FROM', 'Intercompany Due From'),
    ('INTERCO_DUE_TO', 'Intercompany Due To'),
    # ── Equity ──
    ('RETAINED_EARNINGS', 'Retained Earnings'),
    ('P_L_SUMMARY', 'Current Year Profit/Loss'),
    ('WITHDRAWAL', 'Owner Withdrawals'),
    ('OWNER_CURRENT', 'Owner Current Account'),
    # ── Revenue ──
    ('REVENUE', 'Main Sales Revenue'),
    ('SALES_RETURNS', 'Sales Returns & Allowances'),
    ('SALES_DISCOUNT', 'Sales Discounts'),
    ('DISCOUNT_GRANTED', 'Discounts Granted'),
    ('DISCOUNT_RECEIVED', 'Discounts Received'),
    ('FX_GAIN', 'Foreign Exchange Gains'),
    # ── Cost & Expense ──
    ('COGS', 'Cost of Goods Sold'),
    ('PURCHASE_RETURNS', 'Purchase Returns'),
    ('PURCHASE_DISCOUNT', 'Purchase Discounts'),
    ('INVENTORY_ADJ', 'Inventory Adjustments'),
    ('SALARY_EXPENSE', 'Salary Expense'),
    ('DEPRECIATION_EXP', 'Depreciation Expense'),
    ('BAD_DEBT', 'Bad Debt Expense'),
    ('FX_LOSS', 'Foreign Exchange Losses'),
    # ── System / Clearing ──
    ('SUSPENSE', 'Suspense / Clearing'),
    ('INTER_BRANCH', 'Inter-branch Clearing'),
    ('ROUNDING', 'Rounding Adjustments'),
    ('OPENING_BALANCE', 'Opening Balance Equity'),
    ('POS_CLEARING', 'POS Cash Clearing'),
    ('STOCK_RECEIVED_NOT_BILLED', 'Stock Received Not Billed'),
]

ACCOUNT_TYPE_CHOICES = [
    ('ASSET', 'Asset'),
    ('LIABILITY', 'Liability'),
    ('EQUITY', 'Equity'),
    ('INCOME', 'Income'),
    ('EXPENSE', 'Expense'),
]

NORMAL_BALANCE_CHOICES = [
    ('DEBIT', 'Debit'),
    ('CREDIT', 'Credit'),
]

POSTING_PURPOSE_CHOICES = [
    ('CONTROL', 'Control Account'),
    ('DETAIL', 'Detail / Transactional'),
    ('SUMMARY', 'Summary / Group'),
    ('SYSTEM', 'System / Internal'),
]

BUSINESS_DOMAIN_CHOICES = [
    ('AR', 'Accounts Receivable'),
    ('AP', 'Accounts Payable'),
    ('TAX', 'Tax'),
    ('INVENTORY', 'Inventory'),
    ('TREASURY', 'Treasury'),
    ('PAYROLL', 'Payroll'),
    ('FIXED_ASSETS', 'Fixed Assets'),
    ('EQUITY', 'Equity'),
    ('REVENUE', 'Revenue'),
    ('EXPENSE', 'Expense'),
    ('SYSTEM', 'System / Clearing'),
    ('INTERCO', 'Intercompany'),
    ('OTHER', 'Other'),
]

SEMANTIC_GROUP_CHOICES = [
    # Treasury
    ('CASH_ON_HAND', 'Cash on Hand'),
    ('BANK_CURRENT', 'Bank Current Account'),
    ('BANK_SAVINGS', 'Bank Savings Account'),
    ('BANK_FOREIGN', 'Foreign Currency Bank Account'),
    # Tax
    ('VAT_STANDARD', 'VAT Standard Rate'),
    ('VAT_REDUCED', 'VAT Reduced Rate'),
    ('VAT_ZERO', 'VAT Zero Rate / Exempt'),
    ('VAT_IMPORT', 'VAT on Imports'),
    ('WHT_SERVICES', 'WHT on Services'),
    ('WHT_SALARY', 'WHT on Salary'),
    # Receivables
    ('RECEIVABLE_TRADE', 'Trade Receivables'),
    ('RECEIVABLE_OTHER', 'Other Receivables'),
    ('RECEIVABLE_RELATED', 'Related Party Receivables'),
    # Payables
    ('PAYABLE_TRADE', 'Trade Payables'),
    ('PAYABLE_OTHER', 'Other Payables'),
    ('PAYABLE_RELATED', 'Related Party Payables'),
    # Revenue
    ('REVENUE_GOODS', 'Revenue from Goods'),
    ('REVENUE_SERVICES', 'Revenue from Services'),
    ('REVENUE_OTHER', 'Other Operating Revenue'),
    # COGS / Cost
    ('COGS_MATERIALS', 'Cost of Materials'),
    ('COGS_DIRECT_LABOR', 'Direct Labor Costs'),
    ('COGS_OVERHEAD', 'Manufacturing Overhead'),
    # Expense
    ('EXPENSE_OPERATING', 'Operating Expenses'),
    ('EXPENSE_ADMIN', 'Administrative Expenses'),
    ('EXPENSE_SELLING', 'Selling & Distribution'),
    ('EXPENSE_FINANCIAL', 'Financial Expenses'),
    # Inventory
    ('INVENTORY_RAW', 'Raw Materials'),
    ('INVENTORY_WIP', 'Work in Progress'),
    ('INVENTORY_FINISHED', 'Finished Goods'),
    ('INVENTORY_MERCHANDISE', 'Merchandise'),
]

# ── Roles that MUST exist exactly once per template ──
REQUIRED_SYSTEM_ROLES = [
    'CASH_ACCOUNT',
    'BANK_ACCOUNT',
    'RECEIVABLE',
    'PAYABLE',
    'REVENUE',
    'COGS',
    'RETAINED_EARNINGS',
    'VAT_INPUT',
    'VAT_OUTPUT',
    'INVENTORY',
    'P_L_SUMMARY',
]


def normalize_account_name(name: str) -> str:
    """Strip accents, lowercase, remove punctuation for matching."""
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9 ]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


# ═══════════════════════════════════════════════════════════════
#  Layer 1: Template Library
# ═══════════════════════════════════════════════════════════════

class COATemplate(models.Model):
    """
    A Chart of Accounts template (system or custom) with its account tree.

    System templates (is_system=True) are seeded from the hardcoded templates
    and cannot be deleted by users. Custom templates (is_custom=True) are
    created per-organization and fully editable.

    The accounts JSON field is kept for backward compatibility and seed
    import/export. The normalized COATemplateAccount rows are the source
    of truth for queries and mapping.
    """

    key = models.CharField(
        max_length=40, db_index=True,
        help_text='Unique identifier, e.g. IFRS_COA'
    )
    name = models.CharField(max_length=100, help_text='Display name')
    region = models.CharField(max_length=50, default='International')
    description = models.TextField(blank=True, default='')
    icon = models.CharField(
        max_length=30, default='Globe',
        help_text='Lucide icon name for the frontend'
    )
    accent_color = models.CharField(
        max_length=50, default='var(--app-info)',
        help_text='CSS color for the template card accent'
    )

    # ── Versioning ──
    version = models.CharField(
        max_length=20, default='2025',
        help_text='Template version identifier, e.g. 2023, 2025, 2025.1'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Only active templates appear in selection UIs'
    )
    superseded_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='supersedes',
        help_text='Points to the newer version of this template'
    )

    is_system = models.BooleanField(
        default=False,
        help_text='System templates are seeded and cannot be deleted'
    )
    is_custom = models.BooleanField(
        default=False,
        help_text='Custom templates are user-created and per-organization'
    )

    # For custom templates — scoped to an organization
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='coa_templates',
        help_text='Only set for custom (per-org) templates; NULL for system templates'
    )

    # ── Tenant Customization ──
    base_template = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='derived_templates',
        help_text='For custom templates: the system template this was forked from'
    )

    # Kept for backward compat / seed import-export
    accounts = models.JSONField(
        default=list,
        help_text='Full nested account tree as JSON array (legacy, use template_accounts for queries)'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_coa_template'
        ordering = ['is_custom', 'name']
        indexes = [
            models.Index(fields=['key', 'organization'], name='coatpl_key_org_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['key', 'version', 'organization'],
                name='unique_template_key_version_org'
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.key} v{self.version})"

    @property
    def account_count(self):
        """Count accounts from normalized model, fallback to JSON."""
        count = self.template_accounts.count()
        if count > 0:
            return count
        # Fallback to JSON
        def count_json(items):
            total = 0
            for item in (items or []):
                total += 1
                total += count_json(item.get('children', []))
            return total
        return count_json(self.accounts)


class COATemplateAccount(models.Model):
    """
    Normalized account within a COA template.

    This is the relational source of truth — replaces the JSON accounts array
    for queries, matching, validation, and governance. Each account carries
    semantic metadata (system_role, normal_balance, business_domain, semantic_group)
    that powers the 4-level smart matching algorithm.
    """

    template = models.ForeignKey(
        COATemplate, on_delete=models.CASCADE,
        related_name='template_accounts',
        help_text='Parent template'
    )
    code = models.CharField(max_length=20, help_text='Account code within this template')
    name = models.CharField(max_length=200, help_text='Display name')
    normalized_name = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Lowered, accent-stripped, normalized name for matching'
    )
    aliases = models.JSONField(
        default=list, blank=True,
        help_text='Multilingual labels / synonyms for matching'
    )

    # ── Classification ──
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, help_text='ASSET, LIABILITY, EQUITY, INCOME, EXPENSE')
    sub_type = models.CharField(max_length=50, blank=True, default='', help_text='Sub-classification')
    system_role = models.CharField(
        max_length=50, blank=True, null=True,
        choices=SYSTEM_ROLE_CHOICES,
        help_text='Universal semantic role (primary matching key)'
    )
    semantic_group = models.CharField(
        max_length=30, blank=True, null=True,
        choices=SEMANTIC_GROUP_CHOICES,
        help_text='Fine-grained semantic sub-classification for Level 4+ matching'
    )

    # ── Hierarchy ──
    parent_code = models.CharField(max_length=20, blank=True, null=True, help_text='Parent account code for tree structure')

    # ── Semantic Attributes ──
    normal_balance = models.CharField(
        max_length=6, choices=NORMAL_BALANCE_CHOICES, default='DEBIT',
        help_text='Expected normal balance direction'
    )
    posting_purpose = models.CharField(
        max_length=20, choices=POSTING_PURPOSE_CHOICES, default='DETAIL',
        help_text='CONTROL, DETAIL, SUMMARY, SYSTEM'
    )
    business_domain = models.CharField(
        max_length=20, choices=BUSINESS_DOMAIN_CHOICES, default='OTHER',
        help_text='Functional business area'
    )

    # ── Flags ──
    is_reconcilable = models.BooleanField(default=False)
    is_bank_account = models.BooleanField(default=False)
    is_tax_account = models.BooleanField(default=False)
    is_control_account = models.BooleanField(default=False)

    # ── Incremental Tracking ──
    is_dirty = models.BooleanField(
        default=True,
        help_text='True when account changed since last mapping rebuild'
    )
    last_mapped_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When this account was last included in a mapping rebuild'
    )

    class Meta:
        db_table = 'finance_coa_template_account'
        unique_together = [('template', 'code')]
        ordering = ['code']
        indexes = [
            models.Index(fields=['template', 'system_role'], name='coatplacct_role_idx'),
            models.Index(fields=['template', 'type', 'sub_type'], name='coatplacct_type_idx'),
            models.Index(fields=['template', 'business_domain'], name='coatplacct_domain_idx'),
            models.Index(fields=['template', 'semantic_group'], name='coatplacct_semgrp_idx'),
            models.Index(fields=['template', 'is_dirty'], name='coatplacct_dirty_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['template', 'system_role'],
                condition=models.Q(system_role__isnull=False),
                name='unique_role_per_template'
            ),
        ]

    def __str__(self):
        return f"{self.template.key}:{self.code} {self.name}"

    def save(self, *args, **kwargs):
        # Auto-compute normalized_name
        if self.name:
            self.normalized_name = normalize_account_name(self.name)
        # Auto-infer normal_balance from type
        if not self.normal_balance or self.normal_balance == 'DEBIT':
            if self.type in ('LIABILITY', 'EQUITY', 'INCOME'):
                self.normal_balance = 'CREDIT'
            else:
                self.normal_balance = 'DEBIT'
        # Auto-infer is_tax_account from system_role
        if self.system_role and 'VAT' in self.system_role or self.system_role in ('WHT_PAYABLE', 'AIRSI_PAYABLE', 'TAX_EXPENSE', 'PAYROLL_TAX'):
            self.is_tax_account = True
        # Auto-infer is_bank_account
        if self.system_role == 'BANK_ACCOUNT':
            self.is_bank_account = True
        # Auto-infer is_control_account
        if self.posting_purpose == 'CONTROL':
            self.is_control_account = True
        # Mark dirty on any change (skip on initial create)
        if self.pk:
            self.is_dirty = True
        super().save(*args, **kwargs)

    @classmethod
    def validate_required_roles(cls, template_id):
        """
        Validate that all REQUIRED_SYSTEM_ROLES exist exactly once in this template.
        Returns dict: { 'valid': bool, 'missing': [...], 'duplicates': [...] }
        """
        from django.db.models import Count

        existing_roles = (
            cls.objects
            .filter(template_id=template_id, system_role__isnull=False)
            .values('system_role')
            .annotate(cnt=Count('id'))
        )
        role_counts = {r['system_role']: r['cnt'] for r in existing_roles}

        missing = [r for r in REQUIRED_SYSTEM_ROLES if r not in role_counts]
        duplicates = [r for r, c in role_counts.items() if c > 1]

        return {
            'valid': len(missing) == 0 and len(duplicates) == 0,
            'missing': missing,
            'duplicates': duplicates,
            'role_counts': role_counts,
        }


# ═══════════════════════════════════════════════════════════════
#  Posting Rules
# ═══════════════════════════════════════════════════════════════

class COATemplatePostingRule(models.Model):
    """
    Default posting rule associated with a COA template.

    When a template is imported, these rules are applied to map posting
    events to accounts. This allows users to preview rules BEFORE import.
    """

    template = models.ForeignKey(
        COATemplate, on_delete=models.CASCADE,
        related_name='posting_rules',
        help_text='Parent template'
    )
    event_code = models.CharField(
        max_length=80, db_index=True,
        help_text='Posting event code, e.g. sales.invoice.receivable'
    )
    account_code = models.CharField(
        max_length=20,
        help_text='Target account code within this template'
    )
    module = models.CharField(
        max_length=20, default='',
        help_text='Module derived from event_code prefix'
    )
    description = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Human-readable description'
    )

    class Meta:
        db_table = 'finance_coa_template_posting_rule'
        unique_together = ('template', 'event_code')
        ordering = ['module', 'event_code']

    def __str__(self):
        return f"{self.template.key}: {self.event_code} → {self.account_code}"

    def save(self, *args, **kwargs):
        if self.event_code and '.' in self.event_code:
            self.module = self.event_code.split('.', 1)[0]
        super().save(*args, **kwargs)


# ═══════════════════════════════════════════════════════════════
#  Layer 2: Semantic Mapping Library
# ═══════════════════════════════════════════════════════════════

MATCH_LEVEL_CHOICES = [
    ('ROLE', 'System Role Match'),
    ('CODE', 'Code + Type Match'),
    ('NAME', 'Normalized Name Match'),
    ('TYPE_SUBTYPE', 'Type/SubType Fallback'),
    ('MANUAL', 'Manual Assignment'),
    ('UNMAPPED', 'Unmapped'),
]

MAPPING_STATUS_CHOICES = [
    ('AUTO_MATCHED', 'Auto-Matched'),
    ('REVIEWED', 'Reviewed'),
    ('APPROVED', 'Approved'),
    ('REJECTED', 'Rejected'),
    ('UNMAPPED_REQUIRED', 'Unmapped — Required'),
    ('UNMAPPED_OPTIONAL', 'Unmapped — Optional'),
    ('LOSSY_MATCH', 'Lossy Match'),
    ('MANUAL_REVIEW', 'Manual Review Required'),
]

MAPPING_TYPE_CHOICES = [
    ('ONE_TO_ONE', 'One to One'),
    ('ONE_TO_MANY', 'One to Many'),
    ('MANY_TO_ONE', 'Many to One'),
    ('NO_DIRECT_MATCH', 'No Direct Match'),
]


class COATemplateMigrationMap(models.Model):
    """
    Pre-built account mapping between two COA templates.

    Enables guided migration: "Moving from IFRS → Lebanese PCN?
    Here's the pre-built account mapping."

    Each row maps one source_account_code to one (or split) target_account_code
    with full match metadata, confidence scoring, and audit trail.
    """

    source_template = models.ForeignKey(
        COATemplate, on_delete=models.CASCADE,
        related_name='migration_maps_from',
        help_text='Source COA template'
    )
    target_template = models.ForeignKey(
        COATemplate, on_delete=models.CASCADE,
        related_name='migration_maps_to',
        help_text='Target COA template'
    )
    source_account_code = models.CharField(max_length=20, help_text='Account code in the source template')
    target_account_code = models.CharField(max_length=20, blank=True, default='', help_text='Mapped account code in the target template')
    notes = models.CharField(max_length=200, blank=True, default='', help_text='Optional notes')

    # ── Match Metadata (Phase 1 + 2) ──
    match_level = models.CharField(
        max_length=20, choices=MATCH_LEVEL_CHOICES, default='UNMAPPED',
        help_text='How this mapping was determined'
    )
    confidence_score = models.DecimalField(
        max_digits=3, decimal_places=2, default=0.0,
        help_text='Match confidence (0.00 = unmapped, 1.00 = exact role match)'
    )
    status = models.CharField(
        max_length=20, choices=MAPPING_STATUS_CHOICES, default='AUTO_MATCHED',
        help_text='Current workflow status'
    )
    is_manual_override = models.BooleanField(
        default=False,
        help_text='True if a human has manually edited this mapping'
    )
    mapping_type = models.CharField(
        max_length=20, choices=MAPPING_TYPE_CHOICES, default='ONE_TO_ONE',
        help_text='Mapping cardinality'
    )
    mapping_reason = models.TextField(
        blank=True, default='',
        help_text='Detailed explanation of why this mapping was chosen'
    )
    group_key = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Links related rows for ONE_TO_MANY / MANY_TO_ONE splits'
    )
    allocation_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='For splits: percentage allocated to this target'
    )

    # ── Snapshots ──
    source_account_snapshot = models.JSONField(
        null=True, blank=True,
        help_text='Frozen source account data at mapping time'
    )
    target_account_snapshot = models.JSONField(
        null=True, blank=True,
        help_text='Frozen target account data at mapping time'
    )

    # ── Audit trail ──
    version = models.IntegerField(default=1, help_text='Mapping version number')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text='User who created this mapping'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
        help_text='User who last updated this mapping'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_coa_template_migration_map'
        unique_together = ('source_template', 'target_template', 'source_account_code', 'target_account_code')
        ordering = ['source_account_code']

    def __str__(self):
        return f"{self.source_template.key}:{self.source_account_code} → {self.target_template.key}:{self.target_account_code}"


# ═══════════════════════════════════════════════════════════════
#  Layer 3 — Migration Execution Engine
# ═══════════════════════════════════════════════════════════════

SESSION_STATUS_CHOICES = [
    ('DRAFT', 'Draft — plan under construction'),
    ('DRY_RUN', 'Dry-Run — impact report generated'),
    ('APPROVED', 'Approved — awaiting execution'),
    ('EXECUTING', 'Executing — migration in progress'),
    ('COMPLETED', 'Completed — migration successful'),
    ('FAILED', 'Failed — migration aborted with errors'),
    ('ROLLED_BACK', 'Rolled Back — reverted to pre-migration state'),
    ('PARTIAL', 'Partial — Phase A done, Phase B pending/failed'),
]

MIGRATION_MODE_CHOICES = [
    ('RENAME_IN_PLACE', 'Rename In Place — same row, code+name change'),
    ('REPOINT_AND_ARCHIVE', 'Repoint & Archive — remap refs, archive old'),
    ('MERGE_FORWARD', 'Merge Forward — N:1, archive sources'),
    ('SPLIT_BY_OPENING_ENTRY', 'Split by Opening Entry — 1:N, opening JE'),
    ('DELETE_UNUSED', 'Delete Unused — zero journals, safe to remove'),
    ('MANUAL_REVIEW', 'Manual Review — needs human decision'),
]


class COAMigrationSession(TenantModel):
    """
    Top-level migration execution tracker.

    Tracks the entire lifecycle of a COA migration for one organization:
    DRAFT → DRY_RUN → APPROVED → EXECUTING → COMPLETED / FAILED / ROLLED_BACK

    All migration artifacts (journals, renames, archives) reference this session
    for idempotency and audit compliance.
    """

    source_template = models.ForeignKey(
        COATemplate, on_delete=models.PROTECT,
        related_name='migration_sessions_as_source',
        help_text='Template being migrated FROM'
    )
    target_template = models.ForeignKey(
        COATemplate, on_delete=models.PROTECT,
        related_name='migration_sessions_as_target',
        help_text='Template being migrated TO'
    )
    migration_date = models.DateTimeField(
        null=True, blank=True,
        help_text='Cutover datetime — balances computed as of this date'
    )
    status = models.CharField(
        max_length=20, choices=SESSION_STATUS_CHOICES, default='DRAFT',
        help_text='Current lifecycle stage'
    )

    # ── Approval Chain ──
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_coa_migrations'
    )

    # ── Execution Tracking ──
    executed_at = models.DateTimeField(null=True, blank=True)
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='executed_coa_migrations'
    )
    phase_a_completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Structural remap completion timestamp'
    )
    phase_b_completed_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Split journal creation completion timestamp'
    )

    # ── Reports (JSON) ──
    dry_run_report = models.JSONField(
        null=True, blank=True,
        help_text='Full impact analysis: per-account balance, journal count, refs, planned action'
    )
    execution_report = models.JSONField(
        null=True, blank=True,
        help_text='Post-execution summary: accounts renamed, merged, split, deleted'
    )
    error_report = models.JSONField(
        null=True, blank=True,
        help_text='Blocker details if execution failed or was rolled back'
    )
    validation_report = models.JSONField(
        null=True, blank=True,
        help_text='Post-execution: referential, accounting, functional, governance checks'
    )

    # ── Idempotency & Safety ──
    version = models.PositiveIntegerField(
        default=1,
        help_text='Monotonic version — prevents duplicate runs'
    )
    is_locked = models.BooleanField(
        default=False,
        help_text='True during EXECUTING — org finance freeze active'
    )

    # ── Timestamps ──
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_coa_migration_session'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status'], name='coamig_org_status_idx'),
        ]

    def __str__(self):
        return f"Migration {self.id}: {self.source_template.key} → {self.target_template.key} [{self.status}]"


class COAMigrationAccountPlan(models.Model):
    """
    Per-account migration decision within a session.

    Stores the migration_mode (RENAME_IN_PLACE, MERGE_FORWARD, etc.)
    and usage metrics (balance, journal count, etc.) that determine
    whether an account can be safely migrated, archived, or deleted.
    """

    session = models.ForeignKey(
        COAMigrationSession, on_delete=models.CASCADE,
        related_name='account_plans',
        help_text='Parent migration session'
    )
    source_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='migration_plans_as_source',
        help_text='Source COA account being migrated (null for target-only accounts)'
    )
    target_account_code = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Target account code from template mapping'
    )
    target_account_name = models.CharField(
        max_length=200, blank=True, default='',
        help_text='Target account name from template mapping'
    )

    # ── Migration Decision ──
    migration_mode = models.CharField(
        max_length=30, choices=MIGRATION_MODE_CHOICES, default='MANUAL_REVIEW',
        help_text='Engine-assigned or user-overridden migration action'
    )
    is_mode_overridden = models.BooleanField(
        default=False,
        help_text='True if user manually changed the auto-assigned mode'
    )

    # ── Usage Metrics (populated during dry-run) ──
    balance_at_migration = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Net balance as of session.migration_date'
    )
    journal_line_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of JournalEntryLines referencing this account'
    )
    posting_rule_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of PostingRules mapping to this account'
    )
    financial_account_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of FinancialAccounts linked to this account'
    )
    children_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of direct child accounts'
    )

    # ── Safety Flags ──
    historically_locked = models.BooleanField(
        default=False,
        help_text='True if ANY journal line exists — cannot hard-delete'
    )
    has_posting_rules = models.BooleanField(
        default=False,
        help_text='True if PostingRule references exist — must remap first'
    )
    has_financial_accounts = models.BooleanField(
        default=False,
        help_text='True if FinancialAccount references exist — must remap first'
    )

    # ── Split Allocation (for SPLIT_BY_OPENING_ENTRY mode) ──
    allocation_percent = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text='% of source balance allocated to this target (1:N splits)'
    )
    group_key = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Groups related split rows together'
    )

    # ── Execution State ──
    is_executed = models.BooleanField(
        default=False,
        help_text='True after this account has been migrated'
    )
    execution_notes = models.TextField(
        blank=True, default='',
        help_text='Engine notes: rename details, merge target, split JE ref, etc.'
    )

    # ── Timestamps ──
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'finance_coa_migration_account_plan'
        ordering = ['source_account__code']
        indexes = [
            models.Index(fields=['session', 'migration_mode'], name='coamigacct_mode_idx'),
            models.Index(fields=['session', 'is_executed'], name='coamigacct_exec_idx'),
        ]

    def __str__(self):
        src = self.source_account.code if self.source_account else '—'
        return f"{src} → {self.target_account_code} [{self.migration_mode}]"
