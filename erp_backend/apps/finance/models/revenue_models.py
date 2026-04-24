"""
Revenue-recognition models — DeferredRevenue + PerformanceObligation.

Mirror of DeferredExpense but with the debit/credit direction reversed:
at invoice time the amount lands as a CREDIT on a DeferredRevenue
(liability) account. Each period the engine releases a slice from
deferred-revenue to revenue-recognised.

Supports ASC 606 / IFRS 15 at a simplified level:
  - straight-line recognition over `duration_months`
  - optional performance obligations (milestone-based release)
  - satisfaction evidence stored per obligation
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from apps.finance.models.coa_models import ChartOfAccount
from apps.finance.models.ledger_models import JournalEntry
from kernel.audit.mixins import AuditLogMixin
from kernel.tenancy.models import TenantOwnedModel


class DeferredRevenue(AuditLogMixin, TenantOwnedModel):
    """A liability-side deferral of revenue that will be recognised
    over `duration_months` starting `start_date`.

    Created when an invoice is booked for a multi-period service
    (subscription, maintenance contract, prepaid license). The engine
    sweeps a monthly slice from deferred_coa (liability) into
    revenue_coa (income) each close.
    """
    CATEGORIES = (
        ('SUBSCRIPTION', 'Subscription'),
        ('LICENSE', 'License'),
        ('MAINTENANCE', 'Maintenance Contract'),
        ('SUPPORT', 'Support Plan'),
        ('ADVANCE_PAYMENT', 'Advance Payment'),
        ('OTHER', 'Other'),
    )
    RECOGNITION_METHODS = (
        ('STRAIGHT_LINE', 'Straight-line over duration'),
        ('MILESTONE', 'Per-milestone (performance obligations)'),
        ('USAGE', 'Usage-based (tracked externally)'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORIES, default='OTHER')
    recognition_method = models.CharField(
        max_length=20, choices=RECOGNITION_METHODS, default='STRAIGHT_LINE',
    )

    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    start_date = models.DateField()
    duration_months = models.PositiveIntegerField(default=1)
    monthly_amount = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    remaining_amount = models.DecimalField(max_digits=15, decimal_places=2)
    months_recognized = models.PositiveIntegerField(default=0)

    # Posting anchors: the liability-side account (DeferredRevenue on BS)
    # and the P&L revenue account that each release credits.
    deferred_coa = models.ForeignKey(
        ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deferred_revenue_liabilities',
    )
    revenue_coa = models.ForeignKey(
        ChartOfAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deferred_revenue_recognitions',
    )

    source_invoice_id = models.IntegerField(
        null=True, blank=True,
        help_text='Optional FK to the Invoice that created this deferral',
    )
    contact_id = models.IntegerField(
        null=True, blank=True,
        help_text='Counterparty (Customer) for sub-ledger reporting',
    )

    scope = models.CharField(max_length=20, default='OFFICIAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'deferredrevenue'
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'start_date']),
        ]

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk and not bypass:
            original = DeferredRevenue.objects.get(pk=self.pk)
            if original.status in ('COMPLETED', 'CANCELLED'):
                raise ValidationError(
                    f"Immutable: cannot modify a {original.status} deferred revenue"
                )
        if self.duration_months > 0:
            self.monthly_amount = (
                self.total_amount / self.duration_months
            ).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in ('COMPLETED', 'CANCELLED'):
            raise ValidationError(
                f"Immutable: cannot delete a {self.status} deferred revenue"
            )
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"DeferredRevenue({self.name}, {self.remaining_amount})"


class RevenuePerformanceObligation(TenantOwnedModel):
    """ASC 606 / IFRS 15 performance obligation.

    Only used when `DeferredRevenue.recognition_method='MILESTONE'`.
    Each obligation represents a distinct performance promise; revenue
    is released when `is_satisfied=True` rather than on a time schedule.
    """
    deferred_revenue = models.ForeignKey(
        DeferredRevenue, on_delete=models.CASCADE,
        related_name='obligations',
    )
    description = models.CharField(max_length=300)
    allocation_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text="Portion of deferred_revenue.total_amount allocated to this obligation",
    )
    expected_satisfaction_date = models.DateField(null=True, blank=True)
    is_satisfied = models.BooleanField(default=False)
    satisfied_at = models.DateTimeField(null=True, blank=True)
    satisfaction_evidence = models.TextField(
        null=True, blank=True,
        help_text='Free text: signed acceptance, shipment tracking, usage report, etc.',
    )
    # Tracks the release JE that recognised this obligation's revenue.
    release_journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='performance_obligations_released',
    )

    class Meta:
        db_table = 'revenueperformanceobligation'
        indexes = [
            models.Index(fields=['deferred_revenue', 'is_satisfied']),
        ]

    def __str__(self):
        return f"PO({self.description}, {self.allocation_amount})"
