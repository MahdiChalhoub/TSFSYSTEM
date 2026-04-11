"""
Stock Cost Layers — FIFO/LIFO/WAC Consumption
==============================================
Each receipt creates a cost layer. Sales consume layers in order:
  FIFO: oldest first
  LIFO: newest first
  WAC:  weighted average across all layers

Example:
  Purchase 1: 100 units @ $10  →  Layer(qty_remaining=100, unit_cost=10)
  Purchase 2:  50 units @ $12  →  Layer(qty_remaining=50,  unit_cost=12)
  Sell 120:
    FIFO → consume 100@10 + 20@12 = $1,240
    LIFO → consume 50@12 + 70@10 = $1,300
"""
from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class StockCostLayer(AuditLogMixin, TenantOwnedModel):
    """
    One row per stock receipt. quantity_remaining counts down as
    sales/adjustments consume from the layer.
    """
    SOURCE_TYPES = (
        ('PURCHASE', 'Purchase Receipt'),
        ('ADJUSTMENT', 'Stock Adjustment'),
        ('RETURN', 'Customer Return'),
        ('TRANSFER_IN', 'Transfer In'),
        ('OPENING', 'Opening Balance'),
        ('PRODUCTION', 'Production Output'),
    )

    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='cost_layers'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='cost_layers',
        help_text='Null = global (non-warehouse-specific) layer'
    )
    batch = models.ForeignKey(
        'inventory.ProductBatch', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cost_layers'
    )

    quantity_initial = models.DecimalField(
        max_digits=15, decimal_places=3,
        help_text='Original receipt quantity'
    )
    quantity_remaining = models.DecimalField(
        max_digits=15, decimal_places=3,
        help_text='Unconsumed quantity (decrements on sale/adjustment)'
    )
    unit_cost = models.DecimalField(
        max_digits=15, decimal_places=4,
        help_text='Per-unit cost at time of receipt'
    )

    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    source_id = models.IntegerField(
        null=True, blank=True,
        help_text='PK of the source document (PO line, adjustment, etc.)'
    )
    receipt_date = models.DateField(db_index=True)

    is_exhausted = models.BooleanField(
        default=False, db_index=True,
        help_text='True when quantity_remaining reaches 0'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_cost_layer'
        ordering = ['receipt_date', 'created_at']
        indexes = [
            models.Index(fields=['organization', 'product', 'warehouse', 'is_exhausted']),
            models.Index(fields=['organization', 'product', 'receipt_date']),
        ]

    def __str__(self):
        return (
            f"Layer #{self.id}: {self.product_id} @ {self.warehouse_id or 'GLOBAL'} "
            f"— {self.quantity_remaining}/{self.quantity_initial} × ${self.unit_cost}"
        )

    def consume(self, qty):
        """
        Consume qty from this layer. Returns actually consumed qty.
        Marks exhausted when fully consumed.
        """
        if self.is_exhausted or self.quantity_remaining <= 0:
            return Decimal('0')

        consumed = min(qty, self.quantity_remaining)
        self.quantity_remaining -= consumed

        if self.quantity_remaining <= 0:
            self.quantity_remaining = Decimal('0')
            self.is_exhausted = True

        self.save(update_fields=['quantity_remaining', 'is_exhausted'])
        return consumed


class CostLayerConsumption(AuditLogMixin, TenantOwnedModel):
    """
    Audit trail: which layer was consumed, how much, and why.
    Links cost layer consumption to the source document.
    """
    cost_layer = models.ForeignKey(
        StockCostLayer, on_delete=models.PROTECT,
        related_name='consumptions'
    )
    quantity_consumed = models.DecimalField(max_digits=15, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=4)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2)

    # What consumed the layer
    consumption_type = models.CharField(
        max_length=30,
        choices=[
            ('SALE', 'Sale'),
            ('ADJUSTMENT', 'Adjustment'),
            ('TRANSFER_OUT', 'Transfer Out'),
            ('WRITE_OFF', 'Write Off'),
            ('PRODUCTION', 'Production Input'),
        ]
    )
    consumption_id = models.IntegerField(
        null=True, blank=True,
        help_text='PK of the consuming document'
    )

    consumed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_cost_layer_consumption'
        ordering = ['-consumed_at']
        indexes = [
            models.Index(fields=['cost_layer', 'consumed_at']),
        ]

    def __str__(self):
        return f"Consumed {self.quantity_consumed} × ${self.unit_cost} from Layer#{self.cost_layer_id}"
