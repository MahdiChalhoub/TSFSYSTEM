"""
Consolidation Models — Multi-entity financial consolidation.

Used for:
  - Group financial statements
  - Intercompany elimination
  - Currency translation for foreign subsidiaries
  - Consolidation adjustments
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class ConsolidationGroup(TenantModel):
    """
    A consolidation group — aggregates multiple organizations.
    The reporting entity (parent) creates this to produce group statements.
    """
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    base_currency = models.CharField(
        max_length=10, default='XOF',
        help_text='Reporting currency of the consolidated group'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_consolidation_group'
        ordering = ['name']

    def __str__(self):
        return self.name


class ConsolidationEntity(TenantModel):
    """
    An entity (subsidiary) within a consolidation group.
    """
    CONSOLIDATION_METHODS = [
        ('FULL', 'Full Consolidation'),
        ('PROPORTIONAL', 'Proportional Consolidation'),
        ('EQUITY', 'Equity Method'),
        ('EXCLUDED', 'Excluded'),
    ]

    group = models.ForeignKey(
        ConsolidationGroup, on_delete=models.CASCADE, related_name='entities'
    )
    entity_organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        related_name='consolidation_memberships',
        help_text='The subsidiary organization'
    )
    ownership_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('100.00'),
        help_text='Parent ownership percentage (0-100)'
    )
    method = models.CharField(
        max_length=20, choices=CONSOLIDATION_METHODS, default='FULL'
    )
    functional_currency = models.CharField(
        max_length=10, null=True, blank=True,
        help_text='Functional currency of this entity'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_consolidation_entity'
        unique_together = ('group', 'entity_organization')

    def __str__(self):
        return f"{self.entity_organization} ({self.ownership_percentage}%)"


class IntercompanyRule(TenantModel):
    """
    Rules for eliminating intercompany transactions during consolidation.
    """
    ELIMINATION_TYPES = [
        ('REVENUE_EXPENSE', 'Revenue & Expense Elimination'),
        ('RECEIVABLE_PAYABLE', 'Receivable & Payable Elimination'),
        ('INVESTMENT_EQUITY', 'Investment & Equity Elimination'),
        ('DIVIDEND', 'Dividend Elimination'),
        ('UNREALIZED_PROFIT', 'Unrealized Profit Elimination'),
    ]

    group = models.ForeignKey(
        ConsolidationGroup, on_delete=models.CASCADE, related_name='intercompany_rules'
    )
    elimination_type = models.CharField(
        max_length=30, choices=ELIMINATION_TYPES
    )
    entity_a = models.ForeignKey(
        ConsolidationEntity, on_delete=models.CASCADE, related_name='ic_rules_as_a',
        help_text='First entity in the intercompany pair'
    )
    entity_b = models.ForeignKey(
        ConsolidationEntity, on_delete=models.CASCADE, related_name='ic_rules_as_b',
        help_text='Second entity in the intercompany pair'
    )
    account_a = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='ic_elimination_a',
        help_text='Account to eliminate in entity A'
    )
    account_b = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='ic_elimination_b',
        help_text='Offsetting account in entity B'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'finance_intercompany_rule'
        indexes = [
            models.Index(fields=['group', 'elimination_type']),
        ]

    def __str__(self):
        return f"IC: {self.elimination_type} ({self.entity_a} ↔ {self.entity_b})"


class ConsolidationRun(TenantModel):
    """
    A consolidation execution. Produces a consolidated trial balance.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]

    group = models.ForeignKey(
        ConsolidationGroup, on_delete=models.CASCADE, related_name='runs'
    )
    fiscal_period = models.ForeignKey(
        'finance.FiscalPeriod', on_delete=models.PROTECT
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Results
    entities_processed = models.PositiveIntegerField(default=0)
    eliminations_applied = models.PositiveIntegerField(default=0)
    fx_adjustments_applied = models.PositiveIntegerField(default=0)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='consolidation_runs_created'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'finance_consolidation_run'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['group', 'fiscal_period']),
        ]

    def __str__(self):
        return f"Consolidation: {self.group.name} — {self.fiscal_period.name}"


class ConsolidationLine(TenantModel):
    """
    Result line of a consolidation run.
    """
    LINE_TYPES = [
        ('ENTITY', 'Entity Balance'),
        ('ELIMINATION', 'IC Elimination'),
        ('FX_TRANSLATION', 'Currency Translation'),
        ('ADJUSTMENT', 'Manual Adjustment'),
    ]

    run = models.ForeignKey(
        ConsolidationRun, on_delete=models.CASCADE, related_name='lines'
    )
    entity = models.ForeignKey(
        ConsolidationEntity, on_delete=models.CASCADE,
        null=True, blank=True
    )
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT
    )
    line_type = models.CharField(max_length=20, choices=LINE_TYPES, default='ENTITY')

    # Amounts
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    debit_base = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Debit in group reporting currency'
    )
    credit_base = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Credit in group reporting currency'
    )
    exchange_rate = models.DecimalField(
        max_digits=18, decimal_places=10, null=True, blank=True,
        help_text='Rate used for currency translation'
    )
    description = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'finance_consolidation_line'
        indexes = [
            models.Index(fields=['run', 'account']),
            models.Index(fields=['run', 'entity']),
        ]

    def __str__(self):
        return f"{self.line_type}: {self.account.code} Dr={self.debit_base} Cr={self.credit_base}"
