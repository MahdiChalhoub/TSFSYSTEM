"""
Procurement Governance Models
==============================
Enterprise-grade procurement subsystems:
  - 3-Way Match Results (persisted, queryable)
  - Dispute Cases
  - Purchase Requisitions + Lines
  - Supplier Quotations (procurement-side, distinct from sales quotations)
  - Procurement Budgets + Commitments
  - Supplier Performance Snapshots

These models complement the existing infrastructure:
  - GoodsReceipt / GoodsReceiptLine (apps/inventory/models/goods_receipt_models.py)
  - PurchaseReturn / PurchaseReturnLine (apps/pos/models/returns_models.py)
  - ApprovalPolicy / TxnApproval (kernel/lifecycle/models.py)
  - ThreeWayMatchService (apps/pos/services/three_way_match_service.py)
"""
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from erp.models import TenantModel


# =============================================================================
# 3-WAY MATCH SUBSYSTEM
# =============================================================================

class ThreeWayMatchResult(TenantModel):
    """
    Persisted result of a 3-way match evaluation.
    Links PO ↔ GoodsReceipt(s) ↔ Invoice and records the outcome.
    """
    MATCH_STATUS = (
        ('MATCHED', 'Fully Matched'),
        ('PARTIAL_MATCH', 'Partial Match'),
        ('QTY_VARIANCE', 'Quantity Variance'),
        ('PRICE_VARIANCE', 'Price Variance'),
        ('TAX_VARIANCE', 'Tax Variance'),
        ('OVERBILLED', 'Overbilled'),
        ('UNDERDELIVERED', 'Under-delivered'),
        ('BLOCKED', 'Blocked for Payment'),
        ('DISPUTED', 'Disputed'),
        ('RESOLVED', 'Resolved'),
    )

    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.CASCADE,
        related_name='match_results'
    )
    invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.CASCADE,
        related_name='match_results'
    )
    goods_receipt = models.ForeignKey(
        'inventory.GoodsReceipt', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='match_results',
        help_text='Primary GRN used for matching (null if multi-GRN)'
    )

    status = models.CharField(max_length=25, choices=MATCH_STATUS, default='MATCHED')
    payment_blocked = models.BooleanField(default=False)

    # Aggregated quantities
    total_ordered_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    total_declared_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    total_received_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    total_invoiced_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))

    # Value variances
    total_price_variance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    total_tax_variance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    total_qty_variance_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Policy
    tolerance_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('5.00'),
        help_text='Tolerance % used during this match evaluation'
    )

    # Structured detail
    violations = models.JSONField(default=list, blank=True)
    summary = models.JSONField(default=dict, blank=True)

    # Audit
    matched_at = models.DateTimeField(auto_now_add=True)
    matched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='match_results_created'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='match_results_resolved'
    )
    resolution_notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'three_way_match_result'
        ordering = ['-matched_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['purchase_order']),
        ]

    def __str__(self):
        return f"Match {self.id}: PO#{self.purchase_order_id} ↔ INV#{self.invoice_id} → {self.status}"


class ThreeWayMatchLine(TenantModel):
    """
    Per-line comparison within a 3-way match result.
    Records ordered vs declared vs received vs invoiced for each product.
    """
    match_result = models.ForeignKey(
        ThreeWayMatchResult, on_delete=models.CASCADE, related_name='lines'
    )
    purchase_order_line = models.ForeignKey(
        'pos.PurchaseOrderLine', on_delete=models.PROTECT,
        related_name='match_lines'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='match_lines'
    )

    # Quantities from each source
    ordered_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    declared_qty = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    received_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    invoiced_qty = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))

    # Prices from each source
    ordered_unit_price = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal('0'))
    invoiced_unit_price = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal('0'))

    # Computed variances
    qty_variance = models.DecimalField(max_digits=15, decimal_places=3, default=Decimal('0'))
    price_variance = models.DecimalField(max_digits=15, decimal_places=4, default=Decimal('0'))
    amount_variance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Structured detail per line
    variance_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'three_way_match_line'
        indexes = [
            models.Index(fields=['match_result']),
        ]


class DisputeCase(TenantModel):
    """
    Formal dispute record for procurement discrepancies.
    Created by 3-way match failures, receipt issues, or manual escalation.
    """
    DISPUTE_TYPE_CHOICES = (
        ('QTY_VARIANCE', 'Quantity Variance'),
        ('PRICE_VARIANCE', 'Price Variance'),
        ('TAX_VARIANCE', 'Tax Variance'),
        ('QUALITY_ISSUE', 'Quality Issue'),
        ('DAMAGED_GOODS', 'Damaged Goods'),
        ('MISSING_GOODS', 'Missing Goods'),
        ('WRONG_PRODUCT', 'Wrong Product'),
        ('DUPLICATE_INVOICE', 'Duplicate Invoice'),
        ('LATE_DELIVERY', 'Late Delivery'),
        ('OTHER', 'Other'),
    )

    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('UNDER_REVIEW', 'Under Review'),
        ('ESCALATED', 'Escalated'),
        ('RESOLVED', 'Resolved'),
        ('CANCELLED', 'Cancelled'),
    )

    RESOLUTION_CHOICES = (
        ('CREDIT_NOTE', 'Supplier Credit Note Issued'),
        ('REPLACEMENT', 'Replacement Shipment'),
        ('PRICE_ADJUSTMENT', 'Price Adjustment'),
        ('QTY_ADJUSTMENT', 'Quantity Adjustment'),
        ('WRITE_OFF', 'Written Off'),
        ('NO_ACTION', 'No Action Required'),
    )

    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.CASCADE,
        related_name='disputes'
    )
    invoice = models.ForeignKey(
        'finance.Invoice', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='disputes'
    )
    match_result = models.ForeignKey(
        ThreeWayMatchResult, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='disputes'
    )

    dispute_type = models.CharField(max_length=30, choices=DISPUTE_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')

    description = models.TextField()
    disputed_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Resolution
    resolution_type = models.CharField(
        max_length=20, choices=RESOLUTION_CHOICES,
        null=True, blank=True
    )
    resolution_notes = models.TextField(null=True, blank=True)

    # Links
    supplier_credit_note = models.ForeignKey(
        'finance.Invoice', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='dispute_credit_notes'
    )

    # Audit
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='disputes_opened'
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='disputes_resolved'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dispute_case'
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['purchase_order']),
        ]

    def __str__(self):
        return f"Dispute #{self.id}: {self.get_dispute_type_display()} ({self.status})"


# =============================================================================
# PURCHASE REQUISITION / RFQ CHAIN
# =============================================================================

class PurchaseRequisition(TenantModel):
    """
    Internal purchase request — upstream of RFQ and PO.
    Lifecycle: DRAFT → SUBMITTED → APPROVED → RFQ → CONVERTED → CLOSED | CANCELLED
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted'),
        ('APPROVED', 'Approved'),
        ('RFQ', 'RFQ Sent'),
        ('CONVERTED', 'Converted to PO'),
        ('CLOSED', 'Closed'),
        ('CANCELLED', 'Cancelled'),
    )

    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    req_number = models.CharField(
        max_length=50, null=True, blank=True, db_index=True,
        help_text='Auto-generated (e.g., REQ-000001)'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')

    # Location
    site = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT,
        related_name='purchase_requisitions',
        help_text='Requesting branch/site'
    )

    # Requester
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='purchase_requisitions'
    )
    department = models.CharField(max_length=100, null=True, blank=True)
    justification = models.TextField(null=True, blank=True)
    needed_by = models.DateField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_requisitions'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Conversion
    converted_po = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='source_requisition'
    )

    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'purchase_requisition'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.req_number and self.status != 'DRAFT':
            try:
                from erp.connector_engine import connector_engine
                result = connector_engine.route_read(
                    target_module='finance',
                    endpoint='generate_sequence',
                    organization_id=self.organization_id,
                    params={'sequence_type': 'PURCHASE_REQUISITION'},
                )
                if result and result.data and isinstance(result.data, dict):
                    self.req_number = result.data.get('sequence_number', f'REQ-{self.pk}')
                else:
                    import uuid
                    self.req_number = f'REQ-{uuid.uuid4().hex[:8].upper()}'
            except Exception:
                import uuid
                self.req_number = f'REQ-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.req_number or f'REQ-{self.pk}'} ({self.status})"


class PurchaseRequisitionLine(TenantModel):
    """Individual product line within a requisition."""
    requisition = models.ForeignKey(
        PurchaseRequisition, on_delete=models.CASCADE, related_name='lines'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='requisition_lines'
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    estimated_unit_price = models.DecimalField(
        max_digits=15, decimal_places=4, null=True, blank=True,
        help_text='Estimated cost (from last purchase or catalogue)'
    )
    needed_by = models.DateField(null=True, blank=True)
    justification = models.TextField(null=True, blank=True)

    # Preferred supplier (optional — can be overridden by RFQ)
    preferred_supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
    )

    class Meta:
        db_table = 'purchase_requisition_line'

    def __str__(self):
        return f"{self.product} × {self.quantity}"


class SupplierQuotation(TenantModel):
    """
    Procurement-side quotation from a supplier (distinct from sales Quotation).
    Linked to a PurchaseRequisition for supplier comparison workflow.
    Lifecycle: DRAFT → RECEIVED → SELECTED | REJECTED
    """
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('REQUESTED', 'Requested'),
        ('RECEIVED', 'Received'),
        ('UNDER_REVIEW', 'Under Review'),
        ('SELECTED', 'Selected'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
    )

    quotation_number = models.CharField(
        max_length=50, null=True, blank=True, db_index=True
    )
    requisition = models.ForeignKey(
        PurchaseRequisition, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='supplier_quotations'
    )
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.PROTECT,
        related_name='supplier_quotations',
        limit_choices_to={'type': 'SUPPLIER'}
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    valid_until = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=10, default='XOF')

    # Totals
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Conversion
    converted_po = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='source_quotation'
    )

    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplier_quotation'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['requisition']),
        ]

    def __str__(self):
        return f"SQ-{self.quotation_number or self.pk} from {self.supplier}"


class SupplierQuotationLine(TenantModel):
    """Product line within a supplier quotation."""
    quotation = models.ForeignKey(
        SupplierQuotation, on_delete=models.CASCADE, related_name='lines'
    )
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.PROTECT,
        related_name='supplier_quotation_lines'
    )
    requisition_line = models.ForeignKey(
        PurchaseRequisitionLine, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='quotation_responses'
    )
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    unit_price = models.DecimalField(max_digits=15, decimal_places=4)
    tax_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    lead_time_days = models.PositiveIntegerField(default=0)
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'supplier_quotation_line'

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity * self.unit_price).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product} × {self.quantity} @ {self.unit_price}"


# =============================================================================
# PROCUREMENT BUDGET / COMMITMENT
# =============================================================================

class ProcurementBudget(TenantModel):
    """
    Budget envelope for procurement spending control.
    Can be scoped to branch, category, or budget type.
    """
    BUDGET_TYPE_CHOICES = (
        ('OPEX', 'Operational Expenditure'),
        ('CAPEX', 'Capital Expenditure'),
        ('PROJECT', 'Project-Based'),
    )

    name = models.CharField(max_length=120)
    budget_type = models.CharField(max_length=10, choices=BUDGET_TYPE_CHOICES, default='OPEX')
    period_start = models.DateField()
    period_end = models.DateField()

    # Scoping (all optional — null = global)
    site = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='procurement_budgets',
        limit_choices_to={'location_type': 'BRANCH'}
    )
    category = models.ForeignKey(
        'inventory.Category', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='procurement_budgets'
    )

    # Amounts
    amount_limit = models.DecimalField(max_digits=15, decimal_places=2)
    committed_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0'),
        help_text='Sum of approved POs not yet received/invoiced'
    )
    consumed_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0'),
        help_text='Sum of received/invoiced POs'
    )

    # Alert thresholds
    warning_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('80.00'),
        help_text='Alert when utilization exceeds this %'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'procurement_budget'
        ordering = ['-period_start']
        indexes = [
            models.Index(fields=['organization', 'period_start', 'period_end']),
        ]

    @property
    def available_amount(self):
        return self.amount_limit - self.committed_amount - self.consumed_amount

    @property
    def utilization_pct(self):
        if self.amount_limit == 0:
            return Decimal('0')
        return ((self.committed_amount + self.consumed_amount) / self.amount_limit * 100).quantize(Decimal('0.01'))

    @property
    def is_over_warning(self):
        return self.utilization_pct >= self.warning_pct

    def __str__(self):
        return f"{self.name} ({self.period_start} → {self.period_end})"


class BudgetCommitment(TenantModel):
    """
    Links a PO to a budget with committed/released amounts.
    Committed on PO approval, released on PO cancellation or completion.
    """
    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.CASCADE,
        related_name='budget_commitments'
    )
    budget = models.ForeignKey(
        ProcurementBudget, on_delete=models.PROTECT,
        related_name='commitments'
    )
    committed_amount = models.DecimalField(max_digits=15, decimal_places=2)
    released_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    committed_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'budget_commitment'
        indexes = [
            models.Index(fields=['purchase_order']),
            models.Index(fields=['budget']),
        ]

    @property
    def net_commitment(self):
        return self.committed_amount - self.released_amount

    def __str__(self):
        return f"Commitment #{self.id}: {self.committed_amount} on {self.budget}"


# =============================================================================
# VENDOR PERFORMANCE
# =============================================================================

class SupplierPerformanceSnapshot(TenantModel):
    """
    Periodic supplier performance scorecard.
    Computed from PO, GRN, Invoice, Return, and Dispute data.
    """
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.CASCADE,
        related_name='performance_snapshots',
        limit_choices_to={'type': 'SUPPLIER'}
    )
    period_start = models.DateField()
    period_end = models.DateField()

    # Volume
    total_pos = models.PositiveIntegerField(default=0)
    total_po_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    total_receipts = models.PositiveIntegerField(default=0)
    total_returns = models.PositiveIntegerField(default=0)

    # Performance metrics (all percentages, 0-100)
    on_time_delivery_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    fill_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    damage_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    rejection_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    avg_lead_time_days = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    price_variance_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))
    dispute_rate = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0'))

    # Composite score (weighted blend)
    score = models.DecimalField(
        max_digits=7, decimal_places=2, default=Decimal('0'),
        help_text='Weighted blend: 30% OTD + 20% fill + 15% damage + 10% reject + 10% lead + 10% price + 5% dispute'
    )

    # Snapshot audit
    computed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'supplier_performance_snapshot'
        ordering = ['-period_end']
        indexes = [
            models.Index(fields=['organization', 'supplier', 'period_start']),
        ]
        unique_together = ('organization', 'supplier', 'period_start', 'period_end')

    def __str__(self):
        return f"{self.supplier} performance ({self.period_start}→{self.period_end}): {self.score}/100"
# =============================================================================
# SUPPLIER CLAIMS
# =============================================================================

class SupplierClaim(TenantModel):
    """
    Formal claim against a supplier for damaged/missing/expired goods.
    Auto-generated from GoodsReceipt rejections or 3-way match failures.
    """
    CLAIM_TYPE_CHOICES = (
        ('DAMAGED', 'Damaged Goods'),
        ('EXPIRED', 'Expired Goods'),
        ('MISSING', 'Missing Goods / Shortage'),
        ('QUALITY', 'Quality Issue'),
        ('WRONG_PRODUCT', 'Wrong Product Sent'),
        ('BATCH_ERROR', 'Batch/Expiry Discrepancy'),
        ('OVERCHARGE', 'Price Overcharge'),
        ('OTHER', 'Other'),
    )

    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted to Supplier'),
        ('ACCEPTED', 'Accepted by Supplier'),
        ('REJECTED', 'Rejected by Supplier'),
        ('CREDITED', 'Credit Note Received'),
        ('REPLACED', 'Replacement Received'),
        ('RESOLVED', 'Resolved (Other)'),
        ('CANCELLED', 'Cancelled'),
    )

    claim_number = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    claim_type = models.CharField(max_length=20, choices=CLAIM_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    # Links
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.CASCADE, related_name='supplier_claims'
    )
    receipt_line = models.ForeignKey(
        'inventory.GoodsReceiptLine', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='claims'
    )
    purchase_return = models.ForeignKey(
        'pos.PurchaseReturn', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='claims'
    )

    # Values
    claim_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='XOF')

    # Details
    description = models.TextField()
    evidence_urls = models.JSONField(default=list, blank=True)
    supplier_response = models.TextField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'supplier_claim'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.claim_number:
            try:
                from erp.connector_engine import connector_engine
                result = connector_engine.route_read(
                    target_module='finance',
                    endpoint='generate_sequence',
                    organization_id=self.organization_id,
                    params={'sequence_type': 'SUPPLIER_CLAIM'},
                )
                if result and result.data and isinstance(result.data, dict):
                    self.claim_number = result.data.get('sequence_number', f'CLM-{self.pk}')
                else:
                    import uuid
                    self.claim_number = f'CLM-{uuid.uuid4().hex[:8].upper()}'
            except Exception:
                import uuid
                self.claim_number = f'CLM-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.claim_number or f'CLM-{self.pk}'} - {self.supplier}"
