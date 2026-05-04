"""
Bank Reconciliation Models
==========================
Specialized models for bank statement import and reconciliation.

This extends the general reconciliation_models.py with bank-specific features:
- Bank statement import (CSV/Excel)
- Statement line tracking
- Auto-matching with confidence scores
- Reconciliation session tracking

Usage:
    from apps.finance.models import BankStatement, BankStatementLine

    # Import statement
    statement = BankStatement.objects.create(
        organization=org,
        account=financial_account,
        statement_date=date.today(),
        opening_balance=1000.00,
        closing_balance=1500.00
    )
"""

from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal, ROUND_HALF_UP
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


# Drift-bridge: TenantOwnedModel uses db_column='tenant_id' but the bank-
# reconciliation tables in this DB were created with `organization_id`.
# Each subclass overrides the FK to match. No DB migration needed.
_BANK_TABLE_ORG_FK = lambda: models.ForeignKey(
    'erp.Organization',
    on_delete=models.CASCADE,
    related_name='%(app_label)s_%(class)s_v2_set',
    db_index=True,
    null=True, blank=True,
    db_column='organization_id',
)


class BankStatement(AuditLogMixin, TenantOwnedModel):
    organization = _BANK_TABLE_ORG_FK()
    """
    Imported bank statement for reconciliation.

    Lifecycle:
    IMPORTED → MATCHING → PARTIAL → MATCHED → RECONCILED
    """

    STATUS_CHOICES = (
        ('IMPORTED', 'Imported'),
        ('MATCHING', 'Matching in Progress'),
        ('PARTIAL', 'Partially Matched'),
        ('MATCHED', 'Fully Matched'),
        ('RECONCILED', 'Reconciled'),
    )

    account = models.ForeignKey(
        'finance.FinancialAccount',
        on_delete=models.PROTECT,
        related_name='bank_statements',
        help_text='Bank account for this statement'
    )

    statement_date = models.DateField()
    statement_number = models.CharField(max_length=100, null=True, blank=True)

    opening_balance = models.DecimalField(max_digits=15, decimal_places=2)
    closing_balance = models.DecimalField(max_digits=15, decimal_places=2)
    calculated_closing = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    total_debits = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_credits = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    file = models.FileField(upload_to='bank_statements/%Y/%m/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IMPORTED')

    matched_count = models.IntegerField(default=0)
    unmatched_count = models.IntegerField(default=0)
    total_lines = models.IntegerField(default=0)

    reconciled_at = models.DateTimeField(null=True, blank=True)
    reconciled_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='reconciled_statements')

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'bank_statement'
        ordering = ['-statement_date', '-id']
        indexes = [
            models.Index(fields=['organization', 'account', 'statement_date']),
            models.Index(fields=['organization', 'status']),
        ]

    def __str__(self):
        return f"Statement {self.statement_number or self.id} - {self.account.name} - {self.statement_date}"

    def calculate_totals(self):
        """Recalculate totals from lines."""
        lines = self.lines.all()
        self.total_debits = sum(l.debit_amount for l in lines).quantize(Decimal('0.01'), ROUND_HALF_UP)
        self.total_credits = sum(l.credit_amount for l in lines).quantize(Decimal('0.01'), ROUND_HALF_UP)
        self.calculated_closing = (self.opening_balance + self.total_debits - self.total_credits).quantize(
            Decimal('0.01'), ROUND_HALF_UP
        )
        self.total_lines = lines.count()
        self.matched_count = lines.filter(is_matched=True).count()
        self.unmatched_count = self.total_lines - self.matched_count

        # Update status
        if self.matched_count == 0:
            self.status = 'IMPORTED'
        elif self.matched_count == self.total_lines:
            self.status = 'MATCHED'
        else:
            self.status = 'PARTIAL'

        self.save(update_fields=[
            'total_debits', 'total_credits', 'calculated_closing',
            'total_lines', 'matched_count', 'unmatched_count', 'status'
        ])


class BankStatementLine(AuditLogMixin, TenantOwnedModel):
    organization = _BANK_TABLE_ORG_FK()
    """Individual bank transaction line."""

    statement = models.ForeignKey(BankStatement, on_delete=models.CASCADE, related_name='lines')
    line_number = models.IntegerField(default=0)

    transaction_date = models.DateField()
    value_date = models.DateField(null=True, blank=True)

    description = models.CharField(max_length=500)
    reference = models.CharField(max_length=100, blank=True)

    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    balance = models.DecimalField(max_digits=15, decimal_places=2)

    # Matching
    is_matched = models.BooleanField(default=False)
    matched_entry = models.ForeignKey('finance.JournalEntryLine', on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_bank_lines')
    match_confidence = models.FloatField(null=True, blank=True)
    suggested_entry_id = models.IntegerField(null=True, blank=True)
    match_reason = models.CharField(max_length=200, blank=True)

    matched_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_line_matches')
    matched_at = models.DateTimeField(null=True, blank=True)

    category = models.CharField(max_length=100, blank=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'bank_statement_line'
        ordering = ['statement', 'line_number', 'transaction_date']
        indexes = [
            models.Index(fields=['organization', 'statement', 'is_matched']),
            models.Index(fields=['organization', 'transaction_date']),
        ]

    def __str__(self):
        amount = self.credit_amount or self.debit_amount
        direction = "CR" if self.credit_amount else "DR"
        return f"{self.transaction_date} - {direction} {amount} - {self.description[:50]}"

    def match_to_entry(self, journal_entry_line, user, confidence=1.0):
        """Match to journal entry line."""
        from django.utils import timezone
        self.is_matched = True
        self.matched_entry = journal_entry_line
        self.match_confidence = confidence
        self.matched_by = user
        self.matched_at = timezone.now()
        self.save(update_fields=['is_matched', 'matched_entry', 'match_confidence', 'matched_by', 'matched_at'])
        self.statement.calculate_totals()


class ReconciliationSession(AuditLogMixin, TenantOwnedModel):
    organization = _BANK_TABLE_ORG_FK()
    """Track reconciliation session metrics."""

    statement = models.ForeignKey(BankStatement, on_delete=models.CASCADE, related_name='sessions')
    started_by = models.ForeignKey('erp.User', on_delete=models.PROTECT, related_name='started_reconciliation_sessions')

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)

    auto_matched_count = models.IntegerField(default=0)
    manual_matched_count = models.IntegerField(default=0)
    unmatched_count = models.IntegerField(default=0)

    status = models.CharField(
        max_length=20,
        choices=(('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed'), ('ABANDONED', 'Abandoned')),
        default='IN_PROGRESS'
    )

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'reconciliation_session'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['organization', 'statement']),
            models.Index(fields=['organization', 'status', 'started_at']),
        ]

    def __str__(self):
        return f"Session {self.id} - {self.statement} - {self.status}"
