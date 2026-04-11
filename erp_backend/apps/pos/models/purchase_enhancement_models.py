"""
Phase 10 — Purchase Enhancement Models

Stubs for future enhancements:
  - LandedCost / LandedCostLine: Freight, customs, insurance allocation
  - PurchaseReturn / PurchaseReturnLine: Return flow with accounting
  - PurchaseAttachment: Document storage for quotations, BLs, contracts
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


# =============================================================================
# LANDED COST
# =============================================================================

class LandedCost(TenantModel):
    """
    Allocates additional costs (freight, customs, insurance) to a PO's inventory value.

    Formula: unit_landed_cost = (product_cost × qty + freight + customs) / qty
    """
    ALLOCATION_METHODS = (
        ('BY_VALUE', 'By Value (proportional to line total)'),
        ('BY_QUANTITY', 'By Quantity (evenly per unit)'),
        ('BY_WEIGHT', 'By Weight'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('CANCELLED', 'Cancelled'),
    )

    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.CASCADE,
        related_name='landed_costs'
    )
    reference = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='DRAFT')
    total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    allocation_method = models.CharField(max_length=15, choices=ALLOCATION_METHODS, default='BY_VALUE')
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'landed_cost'
        ordering = ['-created_at']

    def __str__(self):
        return f"Landed Cost #{self.id} for PO {self.purchase_order}"


class LandedCostLine(TenantModel):
    """Individual cost component (freight, customs, insurance, etc.)."""
    COST_TYPES = (
        ('FREIGHT', 'Freight / Shipping'),
        ('CUSTOMS', 'Customs Duty'),
        ('INSURANCE', 'Insurance'),
        ('HANDLING', 'Handling / Port Fees'),
        ('OTHER', 'Other'),
    )

    landed_cost = models.ForeignKey(LandedCost, on_delete=models.CASCADE, related_name='lines')
    cost_type = models.CharField(max_length=20, choices=COST_TYPES)
    description = models.CharField(max_length=255, null=True, blank=True)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    account = models.ForeignKey(
        'finance.ChartOfAccount', on_delete=models.SET_NULL,
        null=True, blank=True, help_text='Ledger account for this cost'
    )

    class Meta:
        db_table = 'landed_cost_line'

    def __str__(self):
        return f"{self.get_cost_type_display()}: {self.amount}"


# PurchaseReturn and PurchaseReturnLine are already implemented in returns_models.py


# =============================================================================
# PURCHASE ATTACHMENT
# =============================================================================

class PurchaseAttachment(TenantModel):
    """Document storage for purchase-related files."""
    ATTACHMENT_TYPES = (
        ('QUOTATION', 'Supplier Quotation'),
        ('CONTRACT', 'Contract'),
        ('BL', 'Bill of Lading'),
        ('PROFORMA', 'Proforma Invoice'),
        ('CUSTOMS', 'Customs Document'),
        ('OTHER', 'Other'),
    )

    purchase_order = models.ForeignKey(
        'pos.PurchaseOrder', on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='purchase/attachments/')
    attachment_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPES, default='OTHER')
    name = models.CharField(max_length=255, null=True, blank=True)
    uploaded_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'purchase_attachment'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.get_attachment_type_display()}: {self.name or self.file.name}"
