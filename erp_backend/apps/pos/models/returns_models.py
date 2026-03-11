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
# PURCHASE RETURNS (Enterprise Lifecycle)
# =============================================================================

class PurchaseReturn(TenantModel):
    """
    Return goods to a supplier. Enterprise lifecycle with supplier credit tracking.

    Lifecycle:
        DRAFT → APPROVED → SENT → RECEIVED_BY_SUPPLIER → CREDIT_PENDING → CLOSED
        Any non-terminal → CANCELLED

    Integration:
        - Links to either legacy Order or formal PurchaseOrder
        - Stock reversal on APPROVED (via ReturnsService)
        - GL reversal entry created on APPROVED
        - Supplier credit note tracked via SupplierCreditNote
        - PO qty_returned updated on APPROVED
        - Event emitted at each transition
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('APPROVED', 'Approved'),
        ('SENT', 'Sent to Supplier'),
        ('RECEIVED_BY_SUPPLIER', 'Received by Supplier'),
        ('CREDIT_PENDING', 'Awaiting Credit Note'),
        ('CLOSED', 'Closed'),
        ('CANCELLED', 'Cancelled'),
    )

    RETURN_TYPE_CHOICES = (
        ('DEFECTIVE', 'Defective Product'),
        ('DAMAGED', 'Damaged in Transit'),
        ('WRONG_ITEM', 'Wrong Item Delivered'),
        ('OVERDELIVERY', 'Over-delivery'),
        ('QUALITY', 'Quality Issue'),
        ('EXPIRED', 'Expired/Near-expiry'),
        ('OTHER', 'Other'),
    )

    # ── Link to source PO (dual FK: legacy Order or formal PurchaseOrder)
    original_order = models.ForeignKey(
        'pos.Order', on_delete=models.PROTECT, related_name='purchase_returns',
        null=True, blank=True,
        help_text='Legacy purchase order (Order type=PURCHASE)'
    )
    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.PROTECT, related_name='returns',
        null=True, blank=True,
        help_text='Formal purchase order'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns'
    )

    # ── Return metadata
    return_number = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Auto-generated return reference (e.g. PRET-2026-001)'
    )
    return_date = models.DateField()
    return_type = models.CharField(
        max_length=20, choices=RETURN_TYPE_CHOICES, default='OTHER'
    )
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='DRAFT')
    reference = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='External reference (e.g. RMA number from supplier)'
    )

    # ── Financial
    expected_credit_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Expected credit note amount from supplier'
    )
    actual_credit_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Actual credit received from supplier'
    )
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns', help_text='Reversing GL entry'
    )

    # ── Tracking
    processed_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns_processed'
    )
    approved_by = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_returns_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    received_by_supplier_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # ── Transition matrix
    ALLOWED_TRANSITIONS = {
        'DRAFT': ['APPROVED', 'CANCELLED'],
        'APPROVED': ['SENT', 'CANCELLED'],
        'SENT': ['RECEIVED_BY_SUPPLIER', 'CANCELLED'],
        'RECEIVED_BY_SUPPLIER': ['CREDIT_PENDING', 'CLOSED', 'CANCELLED'],
        'CREDIT_PENDING': ['CLOSED', 'CANCELLED'],
        'CLOSED': [],
        'CANCELLED': [],
    }

    class Meta:
        db_table = 'purchase_return'
        ordering = ['-return_date', '-created_at']

    def __str__(self):
        ref = self.return_number or f'PRET-{self.id}'
        source = self.purchase_order_id or self.original_order_id
        return f"{ref} (PO #{source})"

    def transition_to(self, new_status, user=None, reason=None):
        """Validate and execute status transition."""
        allowed = self.ALLOWED_TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot transition PurchaseReturn from '{self.status}' to '{new_status}'. "
                f"Allowed: {allowed}"
            )
        self.status = new_status

    @property
    def total_return_amount(self):
        """Sum of all line total_amounts."""
        total = self.lines.aggregate(total=models.Sum('total_amount'))['total']
        return total or Decimal('0.00')

    @property
    def credit_gap(self):
        """Difference between expected and actual credit amounts."""
        if self.actual_credit_amount is None:
            return None
        return self.expected_credit_amount - self.actual_credit_amount


class PurchaseReturnLine(TenantModel):
    """Per-product return line for a supplier return."""
    return_order = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='lines')
    original_line = models.ForeignKey(
        'pos.OrderLine', on_delete=models.PROTECT, related_name='purchase_return_lines',
        null=True, blank=True,
        help_text='Original legacy order line'
    )
    po_line = models.ForeignKey(
        'pos.PurchaseOrderLine', on_delete=models.PROTECT, related_name='return_lines',
        null=True, blank=True,
        help_text='Original formal PO line'
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    quantity_returned = models.DecimalField(max_digits=15, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, help_text='Cost at time of purchase')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    return_reason = models.CharField(max_length=50, null=True, blank=True)
    destocked = models.BooleanField(default=False, help_text='Whether the item was removed from inventory')
    batch_number = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'purchase_return_line'

    def __str__(self):
        return f"PRetLine #{self.id} — {self.product} × {self.quantity_returned}"

    def clean(self):
        """Validate that return quantity doesn't exceed received/ordered qty."""
        source_line = self.po_line or self.original_line
        if source_line and self.quantity_returned:
            already_returned = PurchaseReturnLine.objects.filter(
                return_order__status__in=['DRAFT', 'APPROVED', 'SENT',
                                          'RECEIVED_BY_SUPPLIER', 'CREDIT_PENDING', 'CLOSED']
            ).exclude(pk=self.pk)

            if self.po_line:
                already_returned = already_returned.filter(po_line=self.po_line)
            else:
                already_returned = already_returned.filter(original_line=self.original_line)

            total_returned = already_returned.aggregate(
                total=models.Sum('quantity_returned')
            )['total'] or Decimal('0')

            # Use qty_received for PO lines, quantity for legacy
            if self.po_line:
                max_returnable = (self.po_line.qty_received or Decimal('0')) - total_returned
            else:
                max_returnable = (self.original_line.quantity or Decimal('0')) - total_returned

            if self.quantity_returned > max_returnable:
                raise ValidationError(
                    f"Cannot return {self.quantity_returned}. "
                    f"Max returnable: {max_returnable}"
                )


# =============================================================================
# SUPPLIER CREDIT NOTE
# =============================================================================

class SupplierCreditNote(TenantModel):
    """
    Tracks a credit note received from a supplier in relation to a purchase return.

    Lifecycle: DRAFT → RECEIVED → APPLIED → CANCELLED
    - RECEIVED: Credit note document received from supplier
    - APPLIED: Credit applied against AP (journal entry posted)
    - CANCELLED: Credit note voided
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('RECEIVED', 'Received'),
        ('APPLIED', 'Applied'),
        ('CANCELLED', 'Cancelled'),
    )

    purchase_return = models.ForeignKey(
        PurchaseReturn, on_delete=models.CASCADE, related_name='credit_notes'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supplier_credit_notes'
    )

    credit_number = models.CharField(
        max_length=100,
        help_text='Supplier credit note number'
    )
    date_received = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=3, default='XOF')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supplier_credit_notes',
        help_text='AP adjustment journal entry'
    )

    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'supplier_credit_note'
        unique_together = ('credit_number', 'organization')
        ordering = ['-date_received', '-created_at']

    def __str__(self):
        return f"SCN-{self.credit_number} ({self.supplier})"

