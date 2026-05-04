"""
Procurement Request Models
===========================
A lightweight request queue for transfer requests and purchase requests
that can be reviewed/approved before execution.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class ProcurementRequest(TenantModel):
    """
    A request for stock action — either a warehouse transfer or a purchase from another supplier.

    This sits in a queue for review before being converted into an actual
    StockMove (transfer) or PurchaseOrder.
    """
    REQUEST_TYPES = (
        ('TRANSFER', 'Internal Transfer'),
        ('PURCHASE', 'Purchase from Supplier'),
    )
    # Lifecycle now mirrors the full physical-journey vocabulary so the
    # request chip walks the whole chain as the linked PO/TO progresses.
    # Backend signal (see apps.pos.signals) bumps a request's status
    # whenever its source_po (or future source_to) advances. Older
    # request rows still using the legacy subset (PENDING/APPROVED/
    # EXECUTED/REJECTED/CANCELLED) keep working — EXECUTED is treated
    # as an alias for ORDERED everywhere.
    STATUS_CHOICES = (
        ('PENDING',            'Pending Review'),
        ('APPROVED',           'Approved'),
        ('ORDERED',            'Ordered'),
        ('EXECUTED',           'Executed (alias for Ordered)'),
        ('SUPPLIER_CONFIRMED', 'Supplier Confirmed'),
        ('IN_TRANSIT',         'In Transit'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('RECEIVED',           'Received'),
        ('COMPLETED',          'Completed'),
        ('REJECTED',           'Rejected'),
        ('CANCELLED',          'Cancelled'),
        ('FAILED',             'Failed'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    request_type = models.CharField(max_length=20, choices=REQUEST_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')

    # Product being requested
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='procurement_requests'
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # For TRANSFER type
    from_warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='outgoing_requests',
        help_text='Source warehouse (for transfers)'
    )
    to_warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='incoming_requests',
        help_text='Destination warehouse (for transfers)'
    )

    # For PURCHASE type
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'type': 'SUPPLIER'},
        related_name='purchase_requests'
    )
    suggested_unit_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )

    # Metadata
    reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    # Source context — what triggered this request
    source_po = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='derived_requests',
        help_text='The PO being created when this request was generated'
    )

    # ── Recovery (terminal state cooldown — see ProcurementRecovery cron) ──
    # Set when a REJECTED/CANCELLED/FAILED row has aged past the org's
    # configured cooldown. Recovered rows are excluded from active filters
    # so the product/request chip flips back to "Available" naturally.
    is_recovered = models.BooleanField(
        default=False, db_index=True,
        help_text='Marked by the recover_terminal_procurement cron once the '
                  'terminal-state cooldown matured. Recovered rows are hidden '
                  'from active queries.',
    )
    recovered_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When the cron archived this row. Pair with is_recovered.',
    )

    # Audit
    requested_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='procurement_requests_created'
    )
    reviewed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='procurement_requests_reviewed'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # Updated on every bump so freshly-reminded requests bubble up in lists.
    last_bumped_at = models.DateTimeField(null=True, blank=True)
    bump_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'procurement_request'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'request_type']),
        ]

    def __str__(self):
        return f"{self.get_request_type_display()} #{self.id} — {self.product} × {self.quantity}"
