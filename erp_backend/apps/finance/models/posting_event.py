"""
PostingEvent — Governed Enterprise Event Catalog
=================================================
Formally registers every financial event the system can process.
PostingRule.event_code references these events (validated, not FK for flexibility).

~150 canonical events covering:
  Sales, Purchases, Inventory, Payments, Tax, Treasury, Assets, Equity, Adjustments
"""
from django.db import models
from erp.models import TenantModel


class PostingEvent(models.Model):
    """
    Global event registry — NOT tenant-scoped (shared across all organizations).
    Each event defines the accounting vocabulary of the system.
    """

    MODULE_CHOICES = [
        ('sales', 'Sales'),
        ('purchases', 'Purchases'),
        ('inventory', 'Inventory'),
        ('payments', 'Payments'),
        ('tax', 'Tax Engine'),
        ('treasury', 'Finance / Treasury'),
        ('assets', 'Fixed Assets'),
        ('equity', 'Equity & Capital'),
        ('adjustment', 'Adjustments'),
    ]

    NORMAL_BALANCE_CHOICES = [
        ('DEBIT', 'Debit'),
        ('CREDIT', 'Credit'),
        ('EITHER', 'Either'),
    ]

    CRITICALITY_CHOICES = [
        ('CRITICAL', 'Critical — blocks posting if missing'),
        ('STANDARD', 'Standard — needed for full operation'),
        ('OPTIONAL', 'Optional — nice to have'),
        ('CONDITIONAL', 'Conditional — depends on module/config'),
    ]

    code = models.CharField(
        max_length=80, unique=True, db_index=True,
        help_text='Canonical event code, e.g. sales.invoice.receivable'
    )
    module = models.CharField(max_length=20, choices=MODULE_CHOICES)
    document_type = models.CharField(
        max_length=30,
        help_text='Document type within module, e.g. invoice, credit_note, receipt'
    )
    line_role = models.CharField(
        max_length=30,
        help_text='Account role in the entry, e.g. receivable, revenue, vat_output'
    )
    normal_balance = models.CharField(
        max_length=6, choices=NORMAL_BALANCE_CHOICES, default='DEBIT'
    )
    criticality = models.CharField(
        max_length=15, choices=CRITICALITY_CHOICES, default='STANDARD'
    )
    description = models.CharField(max_length=200, blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_posting_event'
        ordering = ['module', 'document_type', 'line_role']

    def __str__(self):
        return self.code


class PostingRuleHistory(TenantModel):
    """
    Audit trail for PostingRule changes.
    Auto-created whenever a PostingRule is created, updated, or deleted.
    """
    CHANGE_TYPES = [
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
        ('AUTO', 'Auto-detected'),
    ]

    event_code = models.CharField(max_length=80, db_index=True)
    change_type = models.CharField(max_length=10, choices=CHANGE_TYPES)
    old_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
    )
    new_account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
    )
    old_account_code = models.CharField(max_length=50, blank=True, default='')
    new_account_code = models.CharField(max_length=50, blank=True, default='')
    source = models.CharField(max_length=20, blank=True, default='')
    changed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    reason = models.CharField(max_length=200, blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'finance_posting_rule_history'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['organization', 'event_code']),
            models.Index(fields=['organization', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.event_code} {self.change_type} @ {self.timestamp}"
