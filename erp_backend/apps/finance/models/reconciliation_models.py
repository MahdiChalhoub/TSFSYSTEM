"""
Unified Reconciliation Engine — AR/AP/Bank matching.
Supports: invoice vs payment, bank statement matching, supplier settlements,
customer credit settlement, advance payment settlement.

Status flow: UNRECONCILED → PARTIALLY_RECONCILED → FULLY_RECONCILED
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class ReconciliationMatch(TenantModel):
    """
    A reconciliation group that links related journal entry lines.
    Example: Invoice receivable + payment = matched pair.
    """
    MATCH_TYPES = [
        ('AUTO', 'Automatic Match'),
        ('MANUAL', 'Manual Match'),
        ('PAYMENT', 'Payment Allocation'),
        ('WRITE_OFF', 'Write-Off'),
        ('REVERSAL', 'Reversal / Credit Note'),
    ]
    STATUS_CHOICES = [
        ('MATCHED', 'Fully Matched'),
        ('PARTIAL', 'Partially Matched'),
        ('BROKEN', 'Broken (requires re-match)'),
    ]

    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.PROTECT,
        related_name='reconciliation_matches',
        help_text='The control/reconcilable account (AR, AP, Bank)'
    )
    match_type = models.CharField(max_length=20, choices=MATCH_TYPES, default='MANUAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='MATCHED')
    reference = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    # Partner context (customer/supplier)
    partner_type = models.CharField(max_length=20, null=True, blank=True)
    partner_id = models.IntegerField(null=True, blank=True)

    # Totals
    matched_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    write_off_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Audit
    matched_at = models.DateTimeField(auto_now_add=True)
    matched_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reconciliation_matches'
    )
    unmatched_at = models.DateTimeField(null=True, blank=True)
    unmatched_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='unmatched_reconciliations'
    )

    class Meta:
        db_table = 'reconciliation_match'
        indexes = [
            models.Index(fields=['organization', 'account']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['partner_type', 'partner_id']),
        ]

    def __str__(self):
        return f"Recon-{self.id}: {self.account.code} ({self.status})"


class ReconciliationLine(TenantModel):
    """
    A single line within a reconciliation match — links to a JournalEntryLine.
    """
    reconciliation = models.ForeignKey(
        ReconciliationMatch, on_delete=models.CASCADE,
        related_name='lines'
    )
    journal_entry_line = models.ForeignKey(
        'finance.JournalEntryLine', on_delete=models.PROTECT,
        related_name='reconciliation_lines',
        help_text='The matched journal entry line'
    )
    matched_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Amount allocated from this JE line to this match'
    )
    is_debit_side = models.BooleanField(
        default=True,
        help_text='True if this line is on the debit side of the match'
    )

    class Meta:
        db_table = 'reconciliation_line'
        indexes = [
            models.Index(fields=['reconciliation']),
            models.Index(fields=['journal_entry_line']),
        ]

    def __str__(self):
        return f"ReconLine: JEL-{self.journal_entry_line_id} → {self.matched_amount}"
