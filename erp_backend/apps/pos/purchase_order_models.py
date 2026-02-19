"""
Purchase Order Models
=====================
Dedicated PurchaseOrder & PurchaseOrderLine models with a 10-state lifecycle.

Lifecycle:
    DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED →
    RECEIVED → INVOICED → COMPLETED    
                  ↓                          
    REJECTED / CANCELLED (terminal states)

Integrates with:
  - Contact model (apps/crm/models.py) — supplier link
  - Product model (apps/inventory/models.py) — line items
  - Warehouse model (apps/inventory/models.py) — receiving location
  - Invoice model (apps/finance/invoice_models.py) — supplier invoicing
  - Payment model (apps/finance/payment_models.py) — supplier payment
"""
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from erp.models import TenantModel


# =============================================================================
# PURCHASE ORDER
# =============================================================================

class PurchaseOrder(TenantModel):
    """
    Purchase order with 10-state lifecycle and transition validation.
    
    State Machine:
        DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED →
        RECEIVED → INVOICED → COMPLETED
        Any non-terminal state → CANCELLED
        SUBMITTED → REJECTED
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted for Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('ORDERED', 'Ordered (Sent to Supplier)'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('RECEIVED', 'Fully Received'),
        ('INVOICED', 'Invoiced'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    # Valid transitions: current_status → set of allowed next statuses
    VALID_TRANSITIONS = {
        'DRAFT': {'SUBMITTED', 'CANCELLED'},
        'SUBMITTED': {'APPROVED', 'REJECTED', 'CANCELLED'},
        'APPROVED': {'ORDERED', 'CANCELLED'},
        'REJECTED': {'DRAFT'},  # Can re-open as draft
        'ORDERED': {'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'},
        'PARTIALLY_RECEIVED': {'RECEIVED', 'CANCELLED'},
        'RECEIVED': {'INVOICED', 'COMPLETED'},
        'INVOICED': {'COMPLETED'},
        'COMPLETED': set(),  # Terminal
        'CANCELLED': set(),  # Terminal
    }

    # Auto-generated reference
    po_number = models.CharField(max_length=50, null=True, blank=True, db_index=True,
                                  help_text='Auto-generated PO reference (e.g., PO-000001)')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='DRAFT')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')

    # Supplier
    supplier = models.ForeignKey('crm.Contact', on_delete=models.PROTECT, related_name='purchase_orders',
                                  help_text='Supplier contact')
    supplier_name = models.CharField(max_length=255, null=True, blank=True, help_text='Snapshot at creation')
    supplier_ref = models.CharField(max_length=100, null=True, blank=True,
                                     help_text='Supplier quote/reference number')

    # Location
    site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
                                   help_text='Default receiving warehouse')

    # Dates
    order_date = models.DateField(null=True, blank=True, help_text='Date PO was sent to supplier')
    expected_date = models.DateField(null=True, blank=True, help_text='Expected delivery date')
    received_date = models.DateField(null=True, blank=True, help_text='Actual full receipt date')

    # Financials
    currency = models.CharField(max_length=3, default='USD')
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal('1.000000'))
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    shipping_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Approval workflow
    submitted_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='submitted_pos')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='approved_pos')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='rejected_pos')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    # Invoice & Payment
    invoice = models.ForeignKey('finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='purchase_orders')

    # Notes
    notes = models.TextField(null=True, blank=True)
    internal_notes = models.TextField(null=True, blank=True, help_text='Internal notes not shared with supplier')

    # Audit
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='created_pos')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'purchase_order'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', 'supplier']),
            models.Index(fields=['po_number']),
        ]

    def __str__(self):
        return f"{self.po_number or f'PO-{self.pk}'} ({self.status})"

    def save(self, *args, **kwargs):
        # Auto-generate PO number on first transition out of DRAFT
        if not self.po_number and self.status != 'DRAFT':
            from apps.finance.models import TransactionSequence
            self.po_number = TransactionSequence.next_value(self.organization, 'PURCHASE_ORDER')

        # Snapshot supplier name
        if self.supplier_id and not self.supplier_name:
            try:
                self.supplier_name = str(self.supplier)
            except Exception:
                pass

        super().save(*args, **kwargs)

    def transition_to(self, new_status, user=None, reason=None):
        """
        Validates and executes a status transition.
        Raises ValidationError if the transition is invalid.
        """
        allowed = self.VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"Cannot transition from '{self.status}' to '{new_status}'. "
                f"Allowed: {', '.join(allowed) if allowed else 'none (terminal state)'}"
            )

        # Status-specific actions
        if new_status == 'SUBMITTED':
            self.submitted_by = user
            self.submitted_at = timezone.now()
        elif new_status == 'APPROVED':
            self.approved_by = user
            self.approved_at = timezone.now()
        elif new_status == 'REJECTED':
            self.rejected_by = user
            self.rejected_at = timezone.now()
            self.rejection_reason = reason
        elif new_status == 'ORDERED':
            if not self.order_date:
                self.order_date = timezone.now().date()
        elif new_status == 'RECEIVED':
            self.received_date = timezone.now().date()

        self.status = new_status
        self.save()

    def recalculate_totals(self):
        """Recalculate totals from line items."""
        lines = self.lines.all()
        self.subtotal = sum(l.line_total for l in lines)
        self.tax_amount = sum(l.tax_amount for l in lines)
        total = self.subtotal + self.tax_amount - self.discount_amount + self.shipping_cost
        self.total_amount = max(total, Decimal('0.00'))
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

    def check_receipt_completeness(self):
        """Check if all lines are fully received and update status."""
        lines = self.lines.all()
        if not lines.exists():
            return

        all_received = all(l.qty_received >= l.quantity for l in lines)
        any_received = any(l.qty_received > 0 for l in lines)

        if all_received and self.status in ('ORDERED', 'PARTIALLY_RECEIVED'):
            self.status = 'RECEIVED'
            self.received_date = timezone.now().date()
            self.save()
        elif any_received and not all_received and self.status == 'ORDERED':
            self.status = 'PARTIALLY_RECEIVED'
            self.save()


# =============================================================================
# PURCHASE ORDER LINE
# =============================================================================

class PurchaseOrderLine(TenantModel):
    """Individual line item on a purchase order."""
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    description = models.TextField(null=True, blank=True, help_text='Override product description')

    # Quantities
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('1.00'))
    qty_received = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    qty_invoiced = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Pricing
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Receiving
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
                                   help_text='Override receiving warehouse for this line')
    expected_date = models.DateField(null=True, blank=True)

    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'purchase_order_line'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.product} × {self.quantity}"

    def save(self, *args, **kwargs):
        """Auto-calculate line totals."""
        base = self.quantity * self.unit_price
        discount = base * (self.discount_percent / Decimal('100'))
        net = base - discount
        self.tax_amount = net * (self.tax_rate / Decimal('100'))
        self.line_total = net
        super().save(*args, **kwargs)

    def receive(self, qty):
        """Record received quantity for this line."""
        if qty <= 0:
            raise ValidationError("Received quantity must be positive.")
        if self.qty_received + qty > self.quantity:
            raise ValidationError(
                f"Cannot receive {qty}. Already received {self.qty_received} of {self.quantity}."
            )
        self.qty_received += qty
        self.save()
        # Check parent PO completeness
        self.order.check_receipt_completeness()
