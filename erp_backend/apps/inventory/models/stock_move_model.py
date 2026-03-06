"""
StockMove — Gap 4 (Multi-Warehouse Logic)
==========================================
Represents an inter-warehouse stock transfer request.

Lifecycle:
  DRAFT → PENDING → IN_TRANSIT → DONE | CANCELLED

Each StockMove links two warehouse locations (from/to) and
carries one or more product lines.

Stock accounting:
  On IN_TRANSIT: deduct `quantity` from `from_warehouse` (reserved + on_hand)
  On DONE:       add `quantity` to `to_warehouse` on_hand
  On CANCELLED:  reverse the IN_TRANSIT deduction (restore from_warehouse)
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.lifecycle.models import PostableMixin
from kernel.lifecycle.constants import LifecycleStatus
from erp.models import User


class StockMove(AuditLogMixin, TenantOwnedModel, PostableMixin):
    lifecycle_txn_type = 'STOCK_MOVE'

    STATUS_CHOICES = (
        ('DRAFT',      'Draft — not yet submitted'),
        ('PENDING',    'Pending — awaiting dispatch'),
        ('IN_TRANSIT', 'In Transit — goods dispatched'),
        ('DONE',       'Done — received at destination'),
        ('CANCELLED',  'Cancelled'),
    )

    MOVE_TYPES = (
        ('TRANSFER', 'Inter-Warehouse Transfer'),
        ('SALE',     'Fulfilment from alternate warehouse'),
        ('RETURN',   'Customer return to warehouse'),
        ('DROPSHIP', 'Dropship — vendor ships to customer'),
    )

    ref_code       = models.CharField(max_length=50, null=True, blank=True, db_index=True,
                         help_text='Auto-generated sequence reference')
    move_type      = models.CharField(max_length=12, choices=MOVE_TYPES, default='TRANSFER')

    # ── Source & Destination ─────────────────────────────────────────────────
    from_warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        related_name='outgoing_moves',
        help_text='Source warehouse (stock leaves here)',
    )
    to_warehouse   = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        related_name='incoming_moves',
        help_text='Destination warehouse (stock arrives here)',
    )

    # ── Optional order link (for inter-warehouse fulfilment on sales orders) ─
    order          = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='stock_moves',
    )

    # ── Metadata ──────────────────────────────────────────────────────────────
    notes          = models.TextField(null=True, blank=True)
    scheduled_date = models.DateField(null=True, blank=True,
                         help_text='Expected dispatch/transit date')
    dispatched_at  = models.DateTimeField(null=True, blank=True)
    received_at    = models.DateTimeField(null=True, blank=True)

    requested_by   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='requested_moves',
    )
    approved_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_moves',
    )

    created_at     = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_move'
        indexes  = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['from_warehouse', 'to_warehouse']),
            models.Index(fields=['ref_code']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ref_code or f'MOVE-{self.id}'}: {self.from_warehouse} → {self.to_warehouse} [{self.status}]"


class StockMoveLine(AuditLogMixin, TenantOwnedModel):
    """
    One product/quantity row within a StockMove.
    Supports partial fulfilment: quantity_done may be < quantity.
    """
    move           = models.ForeignKey(StockMove, on_delete=models.CASCADE,
                         related_name='lines')
    product        = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    quantity       = models.DecimalField(max_digits=15, decimal_places=3,
                         help_text='Quantity requested for transfer')
    quantity_done  = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0.000'),
                         help_text='Quantity actually transferred (may differ from requested)')
    unit_cost      = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                         help_text='AMC at time of dispatch (for COGS accuracy)')

    class Meta:
        db_table = 'stock_move_line'
        unique_together = ('move', 'product')

    def __str__(self):
        return f"{self.product} × {self.quantity} (done: {self.quantity_done})"
