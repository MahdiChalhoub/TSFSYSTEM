"""
Pick / Pack / Ship — Fulfillment Workflow
==========================================
Sales Order → PickList → PackingOrder → Shipment

All three documents use the kernel lifecycle engine (PostableMixin).

Flow:
  1. Sales order confirmed → PickList(DRAFT) created
  2. Warehouse worker picks items → PickList(POSTED)
  3. Packer verifies & packages → PackingOrder(POSTED)
  4. Shipment dispatched with carrier → Shipment(POSTED)
  5. Delivery confirmed → Shipment status updated
"""
from decimal import Decimal
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.lifecycle.models import PostableMixin


class PickList(AuditLogMixin, TenantOwnedModel, PostableMixin):
    """Warehouse picking instruction generated from sales orders."""
    lifecycle_txn_type = 'PICK_LIST'

    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    reference = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        related_name='pick_lists'
    )
    order = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pick_lists'
    )
    assigned_to = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_pick_lists'
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'pick_list'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'assigned_to', 'status']),
        ]

    def __str__(self):
        return f"PICK-{self.reference or self.pk} [{self.status}]"


class PickListLine(AuditLogMixin, TenantOwnedModel):
    """One product line within a pick list. Supports partial picks."""
    pick_list = models.ForeignKey(
        PickList, on_delete=models.CASCADE, related_name='lines'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT
    )
    bin_location = models.ForeignKey(
        'inventory.WarehouseBin', on_delete=models.SET_NULL,
        null=True, blank=True,
        help_text='Suggested bin to pick from'
    )
    qty_requested = models.DecimalField(max_digits=15, decimal_places=3)
    qty_picked = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0'),
        help_text='Actual quantity picked (may differ from requested)'
    )

    picked_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'pick_list_line'
        unique_together = ('pick_list', 'product', 'bin_location')

    def __str__(self):
        return f"{self.product} × {self.qty_picked}/{self.qty_requested}"

    @property
    def is_complete(self):
        return self.qty_picked >= self.qty_requested


class PackingOrder(AuditLogMixin, TenantOwnedModel, PostableMixin):
    """Packing instruction after picking is complete."""
    lifecycle_txn_type = 'PACKING_ORDER'

    reference = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    pick_list = models.ForeignKey(
        PickList, on_delete=models.PROTECT,
        related_name='packing_orders'
    )
    packed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='packing_orders'
    )
    total_weight_kg = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True
    )
    total_packages = models.IntegerField(default=1)

    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'packing_order'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
        ]

    def __str__(self):
        return f"PACK-{self.reference or self.pk} [{self.status}]"


class Shipment(AuditLogMixin, TenantOwnedModel, PostableMixin):
    """Final shipment record with carrier tracking."""
    lifecycle_txn_type = 'SHIPMENT'

    CARRIER_CHOICES = (
        ('DHL', 'DHL'),
        ('FEDEX', 'FedEx'),
        ('UPS', 'UPS'),
        ('ARAMEX', 'Aramex'),
        ('LOCAL', 'Local Courier'),
        ('SELF', 'Self Delivery'),
        ('OTHER', 'Other'),
    )

    reference = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    packing_order = models.ForeignKey(
        PackingOrder, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='shipments'
    )
    order = models.ForeignKey(
        'pos.Order', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='shipments'
    )

    carrier = models.CharField(
        max_length=20, choices=CARRIER_CHOICES, null=True, blank=True
    )
    carrier_name = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Custom carrier name when carrier=OTHER'
    )
    tracking_number = models.CharField(max_length=200, null=True, blank=True)
    tracking_url = models.URLField(null=True, blank=True)

    shipped_at = models.DateTimeField(null=True, blank=True)
    estimated_delivery = models.DateField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivery_proof = models.CharField(
        max_length=500, null=True, blank=True,
        help_text='URL to delivery proof (photo/signature)'
    )

    shipping_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0'),
    )
    notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'shipment'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['tracking_number']),
        ]

    def __str__(self):
        return f"SHIP-{self.reference or self.pk} [{self.carrier or 'N/A'}] [{self.status}]"
