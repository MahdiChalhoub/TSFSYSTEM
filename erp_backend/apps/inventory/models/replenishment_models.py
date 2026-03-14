"""
Replenishment Engine Models
=============================
ReplenishmentRule: Per-product/supplier auto-reorder configuration.
PurchaseSuggestion: Auto-generated purchase suggestions when stock drops
                    below thresholds.

Flow:
  InventoryBalance.available < ReplenishmentRule.min_qty
    → Create PurchaseSuggestion
      → User approves
        → Convert to PurchaseOrder
"""
from decimal import Decimal
from django.db import models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class ReplenishmentRule(AuditLogMixin, TenantOwnedModel):
    """
    Auto-purchasing rules per product / warehouse / supplier.
    The replenishment engine scans InventoryBalance and fires
    PurchaseSuggestions when available < min_qty.
    """
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='replenishment_rules'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='replenishment_rules',
        help_text='Null = applies to all warehouses'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='replenishment_rules',
        help_text='Preferred supplier for this product'
    )

    min_qty = models.DecimalField(
        max_digits=15, decimal_places=3,
        help_text='Trigger replenishment when available falls below this'
    )
    max_qty = models.DecimalField(
        max_digits=15, decimal_places=3,
        help_text='Fill up to this level'
    )
    reorder_qty = models.DecimalField(
        max_digits=15, decimal_places=3,
        help_text='Default order quantity (max_qty - current_stock)'
    )
    lead_time_days = models.IntegerField(
        default=7,
        help_text='Expected delivery time from supplier'
    )

    METHOD_CHOICES = (
        ('FIXED', 'Fixed Reorder Quantity'),
        ('TOP_UP', 'Top Up to Max'),
        ('EOQ', 'Economic Order Quantity'),
    )
    method = models.CharField(
        max_length=10, choices=METHOD_CHOICES, default='TOP_UP'
    )

    is_active = models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'replenishment_rule'
        unique_together = ('product', 'warehouse', 'organization')
        ordering = ['product__name']
        indexes = [
            models.Index(fields=['organization', 'is_active']),
        ]

    def __str__(self):
        wh = self.warehouse or 'ALL'
        return f"Replenish {self.product} @ {wh}: min={self.min_qty}, max={self.max_qty}"


class PurchaseSuggestion(AuditLogMixin, TenantOwnedModel):
    """
    Auto-generated purchase suggestion from the replenishment engine.
    Can be approved, converted to a PO, or dismissed.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('CONVERTED', 'Converted to PO'),
        ('DISMISSED', 'Dismissed'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent — stockout imminent'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE,
        related_name='purchase_suggestions'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.CASCADE,
        related_name='purchase_suggestions'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_suggestions'
    )
    rule = models.ForeignKey(
        ReplenishmentRule, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='suggestions'
    )

    current_stock = models.DecimalField(max_digits=15, decimal_places=3)
    suggested_qty = models.DecimalField(max_digits=15, decimal_places=3)
    estimated_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0'),
        help_text='suggested_qty × product.cost_price'
    )
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')

    # Conversion tracking
    converted_po_id = models.IntegerField(
        null=True, blank=True,
        help_text='PK of the PurchaseOrder created from this suggestion'
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    converted_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='converted_suggestions'
    )

    dismissed_reason = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'purchase_suggestion'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'product', 'status']),
        ]

    def __str__(self):
        return f"Suggest {self.suggested_qty}× {self.product} for {self.warehouse} [{self.status}]"
