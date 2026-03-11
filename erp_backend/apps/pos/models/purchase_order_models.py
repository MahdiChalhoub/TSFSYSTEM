"""
Purchase Order Models
=====================
Dedicated PurchaseOrder & PurchaseOrderLine models with a 10-state lifecycle.

Lifecycle:
    DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED →
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
        DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED →
        RECEIVED → INVOICED → COMPLETED
        Any non-terminal state → CANCELLED
        SUBMITTED → REJECTED
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted for Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('SENT', 'Sent to Supplier'),
        ('CONFIRMED', 'Confirmed by Supplier'),
        ('IN_TRANSIT', 'In Transit / Dispatched'),
        ('PARTIALLY_RECEIVED', 'Partially Received'),
        ('RECEIVED', 'Fully Received'),
        ('PARTIALLY_INVOICED', 'Partially Invoiced'),
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

    PURCHASE_SUB_TYPE_CHOICES = (
        ('STANDARD', 'Standard Purchase'),
        ('WHOLESALE', 'Wholesale Purchase'),
        ('CONSIGNEE', 'Consignee Purchase'),
    )

    # Valid transitions: current_status → set of allowed next statuses
    VALID_TRANSITIONS = {
        'DRAFT': {'SUBMITTED', 'CANCELLED'},
        'SUBMITTED': {'APPROVED', 'REJECTED', 'CANCELLED'},
        'APPROVED': {'SENT', 'CANCELLED'},
        'REJECTED': {'DRAFT'},  # Can re-open as draft
        'SENT': {'CONFIRMED', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'},
        'CONFIRMED': {'IN_TRANSIT', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'},
        'IN_TRANSIT': {'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'},
        'PARTIALLY_RECEIVED': {'RECEIVED', 'CANCELLED'},
        'RECEIVED': {'PARTIALLY_INVOICED', 'INVOICED', 'COMPLETED'},
        'PARTIALLY_INVOICED': {'INVOICED', 'COMPLETED'},
        'INVOICED': {'COMPLETED'},
        'COMPLETED': set(),  # Terminal
        'CANCELLED': set(),  # Terminal
    }

    # Auto-generated reference
    po_number = models.CharField(max_length=50, null=True, blank=True, db_index=True,
                                  help_text='Auto-generated PO reference (e.g., PO-000001)')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='DRAFT')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    purchase_sub_type = models.CharField(
        max_length=20, choices=PURCHASE_SUB_TYPE_CHOICES, default='STANDARD',
        help_text='Sub-classification: Standard/Wholesale (better unit cost)/Consignee (pay on sale)'
    )

    # Supplier
    supplier = models.ForeignKey('crm.Contact', on_delete=models.PROTECT, related_name='purchase_orders',
                                  help_text='Supplier contact')
    supplier_name = models.CharField(max_length=255, null=True, blank=True, help_text='Snapshot at creation')
    supplier_ref = models.CharField(max_length=100, null=True, blank=True,
                                     help_text='Supplier quote/reference number')

    # Location
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='purchase_orders_as_site')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='purchase_orders_as_warehouse',
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

    # Approval & Cancellation workflow
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

    cancelled_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='cancelled_pos')
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True, help_text="Reason for supplier cancellation")
    
    invoiced_at = models.DateTimeField(null=True, blank=True)

    # Invoice & Payment
    invoice = models.ForeignKey('finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='linked_purchase_orders')

    # Invoice Policy — determines what qty invoices are matched against
    INVOICE_POLICY_CHOICES = (
        ('RECEIVED_QTY', 'Received Quantity (default — 3-way match)'),
        ('ORDERED_QTY', 'Ordered Quantity (2-way match)'),
    )
    invoice_policy = models.CharField(
        max_length=15, choices=INVOICE_POLICY_CHOICES, default='RECEIVED_QTY',
        help_text='Which qty the invoice is validated against'
    )

    # Payment Terms & Logistics
    payment_term = models.ForeignKey(
        'pos.PaymentTerm', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='purchase_orders',
        help_text='Payment conditions (Net 30, 60/90, etc.)'
    )
    assigned_driver = models.ForeignKey(
        'erp.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_po_deliveries',
        help_text='Driver assigned for pickup/delivery coordination'
    )

    # Notes
    notes = models.TextField(null=True, blank=True)
    internal_notes = models.TextField(null=True, blank=True, help_text='Internal notes not shared with supplier')

    # Audit
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='created_pos')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # Supplier Portal Integration
    tracking_number = models.CharField(max_length=100, null=True, blank=True, help_text='Dispatched tracking ID')
    tracking_url = models.URLField(max_length=500, null=True, blank=True, help_text='Link to carrier tracking page')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)

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
        elif new_status == 'CANCELLED':
            self.cancelled_by = user
            self.cancelled_at = timezone.now()
            self.cancellation_reason = reason
        elif new_status == 'SENT':
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

        if all_received and self.status in ('SENT', 'PARTIALLY_RECEIVED'):
            self.status = 'RECEIVED'
            self.received_date = timezone.now().date()
            self.save()
        elif any_received and not all_received and self.status == 'SENT':
            self.status = 'PARTIALLY_RECEIVED'
            self.save()

    def check_invoice_completeness(self):
        """Auto-transition between RECEIVED → PARTIALLY_INVOICED → INVOICED."""
        lines = self.lines.all()
        if not lines.exists():
            return

        total_received = sum(l.qty_received for l in lines)
        total_invoiced = sum(l.qty_invoiced for l in lines)

        if total_invoiced <= 0:
            return  # Stay at RECEIVED

        if total_invoiced < total_received:
            if self.status in ('RECEIVED', 'PARTIALLY_INVOICED'):
                self.status = 'PARTIALLY_INVOICED'
                self.save(update_fields=['status'])
        else:
            if self.status in ('RECEIVED', 'PARTIALLY_INVOICED'):
                self.status = 'INVOICED'
                self.save(update_fields=['status'])

    def get_discrepancy_summary(self):
        """Aggregate discrepancies across all lines for the discrepancy dashboard."""
        lines = list(self.lines.all())
        return {
            'total_ordered': sum(l.quantity for l in lines),
            'total_declared': sum((l.supplier_declared_qty or Decimal('0')) for l in lines),
            'has_declarations': any(l.supplier_declared_qty is not None for l in lines),
            'total_received': sum(l.qty_received for l in lines),
            'total_damaged': sum(l.qty_damaged for l in lines),
            'total_rejected': sum(l.qty_rejected for l in lines),
            'total_invoiced': sum(l.qty_invoiced for l in lines),
            'total_missing_vs_po': sum(l.missing_vs_po for l in lines),
            'total_received_amount': sum(l.received_amount for l in lines),
            'total_damaged_amount': sum(l.damaged_amount for l in lines),
            'total_missing_amount': sum(l.missing_amount for l in lines),
        }


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
    supplier_declared_qty = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Quantity declared by supplier in BL/Proforma. None = not yet declared.'
    )
    qty_received = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    qty_invoiced = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Pricing
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Receiving & Discrepancies
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True,
                                   help_text='Override receiving warehouse for this line')
    expected_date = models.DateField(null=True, blank=True)
    
    qty_missing = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), help_text='Supplier failed to deliver (Out of stock/forgot)')
    qty_damaged = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), help_text='Arrived damaged or broken')
    qty_rejected = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), help_text='Rejected by warehouse (e.g. wrong spec, expired)')
    receipt_notes = models.TextField(null=True, blank=True, help_text='Notes regarding discrepancies during receipt')

    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'purchase_order_line'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.product} × {self.quantity}"

    # ── Discrepancy Computed Properties (Phase 5) ─────────────────────────

    @property
    def declared_gap(self):
        """Gap: what supplier declared vs what was ordered. None if no declaration."""
        if self.supplier_declared_qty is None:
            return None
        return self.supplier_declared_qty - self.quantity

    @property
    def receipt_gap_vs_declared(self):
        """Gap: what was declared vs what actually arrived (received + damaged)."""
        if self.supplier_declared_qty is None:
            return None
        return self.supplier_declared_qty - (self.qty_received + self.qty_damaged)

    @property
    def receipt_gap_vs_ordered(self):
        """Gap: what was ordered vs what actually arrived (received + damaged + rejected)."""
        return self.quantity - (self.qty_received + self.qty_damaged + self.qty_rejected)

    @property
    def missing_vs_po(self):
        """Qty missing compared to original PO order."""
        return max(self.quantity - (self.qty_received + self.qty_damaged + self.qty_rejected), Decimal('0'))

    @property
    def missing_vs_declared(self):
        """Qty missing compared to supplier declaration. None if no declaration."""
        if self.supplier_declared_qty is None:
            return None
        return max(self.supplier_declared_qty - (self.qty_received + self.qty_damaged + self.qty_rejected), Decimal('0'))

    @property
    def received_amount(self):
        return self.qty_received * self.unit_price

    @property
    def damaged_amount(self):
        return self.qty_damaged * self.unit_price

    @property
    def missing_amount(self):
        return self.missing_vs_po * self.unit_price

    def save(self, *args, **kwargs):
        """Auto-calculate line totals and validate mutability."""
        bypass = kwargs.pop('force_audit_bypass', False)
        
        if self.order_id and not bypass:
            if self.order.status in ['RECEIVED', 'INVOICED', 'COMPLETED', 'CANCELLED']:
                raise ValidationError(f"Immutable PO: Cannot modify lines for PurchaseOrder {self.order.po_number or self.order.id} ({self.order.status}).")

        base = self.quantity * self.unit_price
        discount = base * (self.discount_percent / Decimal('100'))
        net = base - discount
        self.tax_amount = net * (self.tax_rate / Decimal('100'))
        self.line_total = net
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.order_id:
            if self.order.status in ['RECEIVED', 'INVOICED', 'COMPLETED', 'CANCELLED']:
                raise ValidationError(f"Immutable PO: Cannot delete lines for PurchaseOrder {self.order.po_number or self.order.id} ({self.order.status}).")
        super().delete(*args, **kwargs)

    def receive(self, qty):
        """
        Record received quantity for this line.

        Phase 8: Tolerance-based over-receipt protection.
        Checks total arrived (received + damaged + rejected) against
        ordered qty + configurable tolerance.
        """
        if qty <= 0:
            raise ValidationError("Received quantity must be positive.")

        # Total arrived = everything that physically showed up
        total_arrived = self.qty_received + self.qty_damaged + self.qty_rejected
        total_after = total_arrived + qty

        # Configurable tolerance (default 5%)
        from erp.services import ConfigurationService
        settings = ConfigurationService.get_global_settings(self.order.organization)
        tolerance_pct = Decimal(str(settings.get('po_over_receipt_tolerance', 5)))
        max_allowed = self.quantity * (1 + tolerance_pct / 100)

        if total_after > max_allowed:
            raise ValidationError(
                f"Over-receipt: Cannot accept {qty} more. "
                f"Total arrived would be {total_after} vs max allowed {max_allowed} "
                f"(ordered {self.quantity} + {tolerance_pct}% tolerance)."
            )

        self.qty_received += qty
        self.save()
        # Check parent PO completeness
        self.order.check_receipt_completeness()
