"""
Returns & Credit Notes Models
==============================
Sales returns, credit notes, and purchase returns with lifecycle management.
"""
from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel


# =============================================================================
# SALES RETURNS
# =============================================================================

class SalesReturn(TenantModel):
    """
    Header for a customer return. Links to the original sale order.
    Lifecycle: PENDING → APPROVED → COMPLETED → CANCELLED
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    original_order = models.ForeignKey(
        'pos.Order', on_delete=models.PROTECT, related_name='returns',
        help_text='The original sale order being (partially) returned'
    )
    return_date = models.DateField()
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reference = models.CharField(max_length=100, null=True, blank=True)
    credit_note = models.OneToOneField(
        'CreditNote', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sales_return', help_text='Auto-created when return is approved'
    )
    processed_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'sales_return'
        ordering = ['-return_date', '-created_at']

    def __str__(self):
        return f"RET-{self.id} (Order #{self.original_order_id})"


class SalesReturnLine(TenantModel):
    """
    Per-product return line within a SalesReturn.
    Quantity must not exceed the original order line quantity.
    """
    return_order = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name='lines')
    original_line = models.ForeignKey(
        'pos.OrderLine', on_delete=models.PROTECT, related_name='return_lines',
        help_text='The original sale line being returned'
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    quantity_returned = models.DecimalField(max_digits=15, decimal_places=2)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, help_text='Price at time of original sale')
    refund_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    reason = models.TextField(null=True, blank=True)
    restocked = models.BooleanField(default=False, help_text='Whether the item was returned to inventory')

    class Meta:
        db_table = 'sales_return_line'

    def __str__(self):
        return f"RetLine #{self.id} — {self.product} × {self.quantity_returned}"

    def clean(self):
        """Validate that return quantity doesn't exceed original."""
        if self.original_line and self.quantity_returned:
            already_returned = SalesReturnLine.objects.filter(
                original_line=self.original_line,
                return_order__status__in=['PENDING', 'APPROVED', 'COMPLETED']
            ).exclude(pk=self.pk).aggregate(
                total=models.Sum('quantity_returned')
            )['total'] or Decimal('0')
            max_returnable = self.original_line.quantity - already_returned
            if self.quantity_returned > max_returnable:
                raise ValidationError(
                    f"Cannot return {self.quantity_returned}. Max returnable: {max_returnable}"
                )


# =============================================================================
# CREDIT NOTES
# =============================================================================

class CreditNote(TenantModel):
    """
    Credit document issued to a customer when a return is approved.
    Auto-created by ReturnsService.approve_sales_return().
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('APPLIED', 'Applied'),
        ('CANCELLED', 'Cancelled'),
    )
    credit_number = models.CharField(max_length=100, help_text='Auto-generated CN reference')
    customer = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='credit_notes'
    )
    date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='credit_notes', help_text='Auto-posted reversing GL entry'
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'credit_note'
        unique_together = ('credit_number', 'organization')
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"CN-{self.credit_number}"


# =============================================================================
# PURCHASE RETURNS
# =============================================================================

class PurchaseReturn(TenantModel):
    """
    Return goods to a supplier. Reverses stock and GL entries.
    Lifecycle: PENDING → APPROVED → COMPLETED → CANCELLED
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    original_order = models.ForeignKey(
        'pos.Order', on_delete=models.PROTECT, related_name='purchase_returns',
        help_text='The original purchase order'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns'
    )
    return_date = models.DateField()
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reference = models.CharField(max_length=100, null=True, blank=True)
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns', help_text='Reversing GL entry'
    )
    processed_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'purchase_return'
        ordering = ['-return_date', '-created_at']

    def __str__(self):
        return f"PRET-{self.id} (PO #{self.original_order_id})"


class PurchaseReturnLine(TenantModel):
    """Per-product return line for a supplier return."""
    return_order = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='lines')
    original_line = models.ForeignKey(
        'pos.OrderLine', on_delete=models.PROTECT, related_name='purchase_return_lines'
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    quantity_returned = models.DecimalField(max_digits=15, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, help_text='Cost at time of purchase')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    destocked = models.BooleanField(default=False, help_text='Whether the item was removed from inventory')

    class Meta:
        db_table = 'purchase_return_line'

    def __str__(self):
        return f"PRetLine #{self.id} — {self.product} × {self.quantity_returned}"

    def clean(self):
        """Validate that return quantity doesn't exceed original."""
        if self.original_line and self.quantity_returned:
            already_returned = PurchaseReturnLine.objects.filter(
                original_line=self.original_line,
                return_order__status__in=['PENDING', 'APPROVED', 'COMPLETED']
            ).exclude(pk=self.pk).aggregate(
                total=models.Sum('quantity_returned')
            )['total'] or Decimal('0')
            max_returnable = self.original_line.quantity - already_returned
            if self.quantity_returned > max_returnable:
                raise ValidationError(
                    f"Cannot return {self.quantity_returned}. Max returnable: {max_returnable}"
                )
