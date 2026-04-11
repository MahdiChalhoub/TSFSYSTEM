from django.db import models
from django.core.exceptions import ValidationError
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.lifecycle.models import PostableMixin
from kernel.lifecycle.constants import LifecycleStatus

class StockAdjustmentOrder(AuditLogMixin, TenantOwnedModel, PostableMixin):
    lifecycle_txn_type = 'STOCK_ADJUSTMENT'

    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='adjustment_orders')
    reason = models.TextField(null=True, blank=True)
    reason_code = models.ForeignKey(
        'inventory.AdjustmentReason', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='adjustment_orders',
        help_text='Structured reason code (auditor-required)'
    )
    total_qty_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustment_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustment_order'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"ADJ-{self.reference or self.pk}"

    def save(self, *args, **kwargs):
        if self.pk:
            original = StockAdjustmentOrder.objects.get(pk=self.pk)
            if original.status == LifecycleStatus.POSTED or original.is_locked:
                raise ValidationError("Immutable Inventory: Posted Stock Adjustment Orders cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status not in (LifecycleStatus.DRAFT, LifecycleStatus.CANCELLED):
            raise ValidationError("Immutable Inventory: Only Draft or Cancelled orders can be deleted.")
        super().delete(*args, **kwargs)


class StockAdjustmentLine(AuditLogMixin, TenantOwnedModel):
    order = models.ForeignKey(StockAdjustmentOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    # Product snapshot (frozen at adjustment time)
    product_name_snapshot = models.CharField(max_length=255, null=True, blank=True,
        help_text='Product name at time of adjustment (immutable)')
    product_sku_snapshot = models.CharField(max_length=100, null=True, blank=True,
        help_text='Product SKU at time of adjustment (immutable)')
    product_barcode_snapshot = models.CharField(max_length=100, null=True, blank=True,
        help_text='Product barcode at time of adjustment (immutable)')
    qty_adjustment = models.DecimalField(max_digits=15, decimal_places=2)
    amount_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE)
    reason = models.TextField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    recovered_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    reflect_transfer = models.ForeignKey('inventory.StockTransferOrder', on_delete=models.SET_NULL, null=True, blank=True)
    added_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustment_line'

    def save(self, *args, **kwargs):
        if self.order_id:
            if self.order.status == LifecycleStatus.POSTED or self.order.is_locked:
                raise ValidationError("Immutable Inventory: Lines belonging to a posted/locked Stock Adjustment cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order_id and (self.order.status == LifecycleStatus.POSTED or self.order.is_locked):
            raise ValidationError("Immutable Inventory: Lines belonging to a posted/locked Stock Adjustment cannot be deleted.")
        super().delete(*args, **kwargs)


class StockTransferOrder(AuditLogMixin, TenantOwnedModel, PostableMixin):
    lifecycle_txn_type = 'STOCK_TRANSFER'

    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    from_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfers_out')
    to_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfers_in')
    driver = models.CharField(max_length=255, null=True, blank=True)
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    total_qty_transferred = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='transfer_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # ── VAT Assessment (cross-jurisdiction transfers) ────────────────
    VAT_TRANSFER_TYPE_CHOICES = [
        ('SAME_JURISDICTION', 'Same Jurisdiction (no VAT impact)'),
        ('CROSS_JURISDICTION', 'Cross Jurisdiction (VAT adjustment)'),
        ('FREE_ZONE_IN', 'Into Free Trade Zone (VAT exempt)'),
        ('FREE_ZONE_OUT', 'Out of Free Trade Zone (VAT applies)'),
        ('CROSS_BORDER', 'Cross-Border Inter-company'),
    ]
    vat_transfer_type = models.CharField(
        max_length=20, choices=VAT_TRANSFER_TYPE_CHOICES,
        default='SAME_JURISDICTION',
        help_text='VAT treatment for this transfer based on source/destination jurisdictions')
    source_vat_registration = models.CharField(
        max_length=50, blank=True, default='',
        help_text='VAT registration number at source branch')
    destination_vat_registration = models.CharField(
        max_length=50, blank=True, default='',
        help_text='VAT registration number at destination branch')
    vat_rate_source = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='VAT rate at source jurisdiction')
    vat_rate_destination = models.DecimalField(
        max_digits=7, decimal_places=4, default=0,
        help_text='VAT rate at destination jurisdiction')
    vat_adjustment = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Net VAT adjustment (+ = additional VAT due, - = credit)')
    goods_value_for_vat = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Transfer value of goods for VAT assessment')

    class Meta:
        db_table = 'stock_transfer_order'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'date']),
        ]

    def __str__(self):
        return f"TRF-{self.reference or self.pk}"

    def save(self, *args, **kwargs):
        if self.pk:
            original = StockTransferOrder.objects.get(pk=self.pk)
            if original.status == LifecycleStatus.POSTED or original.is_locked:
                raise ValidationError("Immutable Inventory: Posted Stock Transfer Orders cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status not in (LifecycleStatus.DRAFT, LifecycleStatus.CANCELLED):
            raise ValidationError("Immutable Inventory: Only Draft or Cancelled transfers can be deleted.")
        super().delete(*args, **kwargs)


class StockTransferLine(AuditLogMixin, TenantOwnedModel):
    order = models.ForeignKey(StockTransferOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    # Product snapshot (frozen at transfer time)
    product_name_snapshot = models.CharField(max_length=255, null=True, blank=True,
        help_text='Product name at time of transfer (immutable)')
    product_sku_snapshot = models.CharField(max_length=100, null=True, blank=True,
        help_text='Product SKU at time of transfer (immutable)')
    product_barcode_snapshot = models.CharField(max_length=100, null=True, blank=True,
        help_text='Product barcode at time of transfer (immutable)')
    qty_transferred = models.DecimalField(max_digits=15, decimal_places=2)
    from_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfer_lines_out')
    to_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfer_lines_in')
    reason = models.TextField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    recovered_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    added_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'stock_transfer_line'

    def save(self, *args, **kwargs):
        if self.order_id:
            if self.order.status == LifecycleStatus.POSTED or self.order.is_locked:
                raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Transfer cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order_id and (self.order.status == LifecycleStatus.POSTED or self.order.is_locked):
            raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Transfer cannot be deleted.")
        super().delete(*args, **kwargs)
