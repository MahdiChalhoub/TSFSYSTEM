"""
StockLedger — Reservation-Aware Stock Tracking
================================================
Gap 3 (ERP Roadmap): Tracks the three-quantity model per product/warehouse:

  on_hand   = physical units in stock (set by InventoryService.reduce_stock)
  reserved  = committed to confirmed orders (not yet delivered)
  available = on_hand - reserved  (computed property)

Every state change that affects stock is recorded as a movement row,
giving a full chronological ledger per product/warehouse.

Movement types:
  RESERVATION         — stock committed on order CONFIRMED
  RESERVATION_RELEASE — reservation voided (order CANCELLED)
  DELIVERY_DEDUCTION  — stock physically removed on order DELIVERED
                        (also releases corresponding reservation)
  RETURN              — stock returned to warehouse
  ADJUSTMENT          — manual override / correction
"""
from django.db import models
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config


class StockLedger(AuditLogMixin, TenantOwnedModel):
    """
    Append-only double-entry ledger for stock reservation movements.
    Never update or delete rows — always append new correcting entries.
    """

    MOVEMENT_TYPES = get_config('inventory_movement_types', default=(
        ('RESERVATION',         'Reservation — stock committed on confirm'),
        ('RESERVATION_RELEASE', 'Reservation Release — order cancelled'),
        ('DELIVERY_DEDUCTION',  'Delivery Deduction — stock physically removed'),
        ('RETURN',              'Return — stock returned to warehouse'),
        ('ADJUSTMENT',          'Manual Adjustment'),
    ))

    product    = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT, related_name='stock_ledger'
    )
    warehouse  = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT, related_name='stock_ledger'
    )
    order      = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_ledger_entries',
        help_text='Source order for this movement'
    )

    movement_type  = models.CharField(max_length=30, choices=MOVEMENT_TYPES, db_index=True)

    # ── Reservation Source Tracking ──────────────────────────────────────────
    RESERVATION_SOURCE_TYPES = get_config('inventory_reservation_source_types', default=(
        ('SALES_ORDER', 'Sales Order'),
        ('TRANSFER_ORDER', 'Transfer Order'),
        ('PRODUCTION_ORDER', 'Production Order'),
        ('PICK_LIST', 'Pick List'),
        ('MANUAL', 'Manual Reservation'),
    ))
    reservation_source_type = models.CharField(
        max_length=30, choices=RESERVATION_SOURCE_TYPES,
        null=True, blank=True,
        help_text='What document reserved this stock'
    )
    reservation_source_id = models.IntegerField(
        null=True, blank=True,
        help_text='PK of the source document'
    )

    # Signed quantities: positive = increase, negative = decrease
    reserved_delta = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'),
        help_text='Change to reserved qty (+reserve / -release)'
    )
    on_hand_delta  = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'),
        help_text='Change to physical on-hand qty (-deduction / +return)'
    )

    # Running balances after this entry (denormalised for fast reads)
    running_on_hand  = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0.000'))
    running_reserved = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0.000'))

    reference  = models.CharField(max_length=200, null=True, blank=True,
        help_text='Human-readable reference, e.g. WF-RESERVE-42')
    note       = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'stock_ledger'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'product', 'warehouse', 'created_at']),
            models.Index(fields=['order', 'movement_type']),
        ]

    def __str__(self):
        return (
            f"[{self.movement_type}] {self.product_id} @ {self.warehouse_id} "
            f"Δreserved={self.reserved_delta:+} Δon_hand={self.on_hand_delta:+}"
        )

    @property
    def available(self):
        """Available = on_hand - reserved (running balance view)."""
        return self.running_on_hand - self.running_reserved
