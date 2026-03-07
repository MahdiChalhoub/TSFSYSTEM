"""
GoodsReceipt — Purchase Receiving Screen
=========================================
Manages the physical reception of products with operational intelligence.

Two modes:
  - DIRECT (Mode A): Receiving without a Purchase Order
  - PO_BASED (Mode B): Receiving against an imported Purchase Order

Lifecycle (session-level):
  DRAFT → IN_PROGRESS → COMPLETED | PARTIALLY_COMPLETED | CANCELLED

Lifecycle (line-level):
  PENDING → RECEIVED | PARTIALLY_RECEIVED | REJECTED | UNDER_REVIEW

Integrates with:
  - PurchaseOrder / PurchaseOrderLine (PO-based receiving)
  - Inventory / InventoryMovement (stock updates)
  - StockMove (transfer requests)
  - Task (automated follow-up tasks)
  - OperationalRequest (approval workflows)
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from erp.models import User


# =============================================================================
# GOODS RECEIPT (Session Envelope)
# =============================================================================

class GoodsReceipt(AuditLogMixin, TenantOwnedModel):
    """
    A receiving session — groups multiple product lines being received
    at a specific warehouse location.
    """
    MODE_CHOICES = (
        ('DIRECT', 'Direct Receiving (No PO)'),
        ('PO_BASED', 'Receiving Against Purchase Order'),
    )

    STATUS_CHOICES = (
        ('DRAFT', 'Draft — session created'),
        ('IN_PROGRESS', 'In Progress — actively receiving'),
        ('COMPLETED', 'Completed — all items processed'),
        ('PARTIALLY_COMPLETED', 'Partially Completed — some items pending'),
        ('CLOSED', 'Closed — finalized and locked'),
        ('CANCELLED', 'Cancelled'),
    )

    # Auto-generated reference
    receipt_number = models.CharField(
        max_length=50, null=True, blank=True, db_index=True,
        help_text='Auto-generated reference (e.g., GR-000001)'
    )

    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='DIRECT')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='DRAFT')

    # Links
    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='goods_receipts',
        help_text='Linked PO (Mode B only)'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        related_name='goods_receipts',
        help_text='Receiving location'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='goods_receipts',
        limit_choices_to={'type': 'SUPPLIER'}
    )
    branch = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='branch_goods_receipts',
        limit_choices_to={'location_type': 'BRANCH'},
        help_text='Auto-derived from warehouse — do not set manually'
    )

    # Actors
    received_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='goods_receipts_received'
    )

    # Metadata
    supplier_ref = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Delivery note / BL reference from supplier'
    )
    notes = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'goods_receipt'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['receipt_number']),
        ]

    def __str__(self):
        return f"{self.receipt_number or f'GR-{self.pk}'} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        # Auto-generate receipt number on first save
        if not self.receipt_number:
            from apps.finance.models import TransactionSequence
            self.receipt_number = TransactionSequence.next_value(
                self.tenant, 'GOODS_RECEIPT'
            )
        # Auto-set started_at when moving to IN_PROGRESS
        if self.status == 'IN_PROGRESS' and not self.started_at:
            self.started_at = timezone.now()
        # Auto-set completed_at when moving to COMPLETED/CLOSED
        if self.status in ('COMPLETED', 'CLOSED', 'PARTIALLY_COMPLETED') and not self.completed_at:
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)

    def check_completeness(self):
        """Check line statuses and update session status accordingly."""
        lines = self.lines.all()
        if not lines.exists():
            return

        all_processed = all(
            l.line_status in ('RECEIVED', 'REJECTED', 'CLOSED')
            for l in lines
        )
        any_processed = any(
            l.line_status in ('RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED')
            for l in lines
        )

        if all_processed:
            self.status = 'COMPLETED'
        elif any_processed:
            self.status = 'PARTIALLY_COMPLETED'

        self.save()


# =============================================================================
# GOODS RECEIPT LINE (Per-Product)
# =============================================================================

class GoodsReceiptLine(AuditLogMixin, TenantOwnedModel):
    """
    One product line within a receiving session.
    Captures receiving decisions, rejection reasons, and decision engine outputs.
    """
    LINE_STATUS_CHOICES = (
        ('PENDING', 'Pending — awaiting processing'),
        ('SCANNED', 'Scanned — identified but not yet decided'),
        ('UNDER_REVIEW', 'Under Review — needs manager input'),
        ('RECEIVED', 'Received — accepted into stock'),
        ('PARTIALLY_RECEIVED', 'Partially Received — partial acceptance'),
        ('REJECTED', 'Rejected — refused'),
        ('APPROVAL_REQUIRED', 'Approval Required — unexpected item'),
        ('APPROVED_EXTRA', 'Approved Extra Item'),
        ('REFUSED_EXTRA', 'Refused Extra Item'),
        ('RETURN_PENDING', 'Return Pending'),
        ('TRANSFER_REQUIRED', 'Transfer Required'),
        ('VERIFIED', 'Verified — quality check passed'),
        ('CLOSED', 'Closed'),
    )

    REJECTION_REASON_CHOICES = (
        ('NOT_REJECTED', 'Not Rejected'),
        ('DAMAGED', 'Damaged'),
        ('EXPIRED', 'Expired'),
        ('SHORT_SHELF_LIFE', 'Short Shelf Life'),
        ('QUALITY_ISSUE', 'Quality Issue'),
        ('NOT_ORDERED', 'Not Ordered'),
        ('WRONG_PRODUCT', 'Wrong Product'),
        ('OTHER', 'Other'),
    )

    APPROVAL_STATUS_CHOICES = (
        ('NOT_REQUIRED', 'Not Required'),
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REFUSED', 'Refused'),
        ('ESCALATED', 'Escalated'),
    )

    TRANSFER_CHOICES = (
        ('NO_TRANSFER', 'No Transfer Needed'),
        ('TO_STORE', 'Transfer to Store Required'),
        ('TO_WAREHOUSE', 'Transfer to Warehouse Required'),
        ('REQUEST_CREATED', 'Transfer Request Created'),
        ('IN_PROGRESS', 'Transfer In Progress'),
        ('COMPLETED', 'Transfer Completed'),
    )

    # Parent
    receipt = models.ForeignKey(
        GoodsReceipt, on_delete=models.CASCADE, related_name='lines'
    )

    # Product
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT, related_name='goods_receipt_lines'
    )
    po_line = models.ForeignKey(
        'pos.PurchaseOrderLine', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='goods_receipt_lines',
        help_text='Linked PO line (Mode B only)'
    )

    # Quantities
    qty_ordered = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Expected qty from PO (0 in Mode A)'
    )
    qty_received = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )
    qty_rejected = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00')
    )

    # Product details at time of receipt
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)

    # Status & Workflow
    line_status = models.CharField(
        max_length=25, choices=LINE_STATUS_CHOICES, default='PENDING'
    )
    rejection_reason = models.CharField(
        max_length=25, choices=REJECTION_REASON_CHOICES, default='NOT_REJECTED'
    )
    rejection_notes = models.TextField(null=True, blank=True)
    is_unexpected = models.BooleanField(
        default=False, help_text='Item not on the PO (Mode B only)'
    )
    approval_status = models.CharField(
        max_length=20, choices=APPROVAL_STATUS_CHOICES, default='NOT_REQUIRED'
    )
    transfer_requirement = models.CharField(
        max_length=20, choices=TRANSFER_CHOICES, default='NO_TRANSFER'
    )

    # ── Decision Engine Output (computed, stored for audit) ──────────────────

    # Stock context
    stock_on_location = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Current stock at receiving warehouse'
    )
    total_stock = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total stock across all locations'
    )

    # Sales intelligence
    avg_daily_sales = models.DecimalField(
        max_digits=15, decimal_places=4, default=Decimal('0.0000'),
        help_text='Average daily sales velocity'
    )
    remaining_shelf_life_days = models.IntegerField(
        null=True, blank=True,
        help_text='Days until expiry (null if non-expiry item)'
    )

    # Safety metrics
    safe_qty = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='(avg_daily_sales × shelf_life_days) - current_stock'
    )
    safe_qty_after_receipt = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='safe_qty - qty_received'
    )
    receipt_coverage_pct = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal('0.00'),
        help_text='(qty_received / max(safe_qty, 1)) × 100'
    )

    # Business scores
    sales_performance_score = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal('0.0000'),
        help_text='Sales rotation efficiency score'
    )
    adjustment_risk_score = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal('0.0000'),
        help_text='Negative adjustment ratio (shrinkage/damage risk)'
    )

    # Recommendations
    recommended_action = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='System-generated recommended action text'
    )
    decision_warnings = models.JSONField(
        default=list, blank=True,
        help_text='List of warning badge codes from decision engine'
    )

    # Evidence
    evidence_attachment = models.URLField(
        max_length=500, null=True, blank=True,
        help_text='Photo/document evidence URL (for rejections)'
    )

    # Audit
    processed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='processed_receipt_lines'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'goods_receipt_line'
        ordering = ['id']
        indexes = [
            models.Index(fields=['receipt', 'line_status']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        return f"{self.product} × {self.qty_received} ({self.get_line_status_display()})"


# ─── Auto-derive branch on GoodsReceipt ─────────────────────────────────────

from django.db.models.signals import pre_save  # noqa: E402
from django.dispatch import receiver  # noqa: E402


@receiver(pre_save, sender=GoodsReceipt)
def derive_goods_receipt_branch(sender, instance, **kwargs):
    """Stamp branch FK from the receiving warehouse's parent chain."""
    if instance.warehouse:
        wh = instance.warehouse
        instance.branch = wh.get_branch() if wh.location_type != 'BRANCH' else wh
