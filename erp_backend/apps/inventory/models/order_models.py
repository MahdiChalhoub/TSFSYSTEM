from django.db import models
from django.core.exceptions import ValidationError
from erp.models import VerifiableModel

class StockAdjustmentOrder(VerifiableModel):
    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='adjustment_orders')
    reason = models.TextField(null=True, blank=True)
    total_qty_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    is_posted = models.BooleanField(default=False)
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustment_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustment_order'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"ADJ-{self.reference or self.pk}"

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk and not bypass:
            original = StockAdjustmentOrder.objects.get(pk=self.pk)
            if original.is_posted:
                raise ValidationError("Immutable Inventory: Posted Stock Adjustment Orders cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.is_posted:
            raise ValidationError("Immutable Inventory: Posted Stock Adjustment Orders cannot be deleted.")
        super().delete(*args, **kwargs)


class StockAdjustmentLine(models.Model):
    order = models.ForeignKey(StockAdjustmentOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
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
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.order_id and not bypass:
            if self.order.is_posted:
                raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Adjustment cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order_id and self.order.is_posted:
            raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Adjustment cannot be deleted.")
        super().delete(*args, **kwargs)


class StockTransferOrder(VerifiableModel):
    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    from_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfers_out')
    to_warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='transfers_in')
    driver = models.CharField(max_length=255, null=True, blank=True)
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    total_qty_transferred = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_posted = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='transfer_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_transfer_order'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"TRF-{self.reference or self.pk}"

    def save(self, *args, **kwargs):
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.pk and not bypass:
            original = StockTransferOrder.objects.get(pk=self.pk)
            if original.is_posted:
                raise ValidationError("Immutable Inventory: Posted Stock Transfer Orders cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.is_posted:
            raise ValidationError("Immutable Inventory: Posted Stock Transfer Orders cannot be deleted.")
        super().delete(*args, **kwargs)


class StockTransferLine(models.Model):
    order = models.ForeignKey(StockTransferOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
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
        bypass = kwargs.pop('force_audit_bypass', False)
        if self.order_id and not bypass:
            if self.order.is_posted:
                raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Transfer cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order_id and self.order.is_posted:
            raise ValidationError("Immutable Inventory: Lines belonging to a posted Stock Transfer cannot be deleted.")
        super().delete(*args, **kwargs)
