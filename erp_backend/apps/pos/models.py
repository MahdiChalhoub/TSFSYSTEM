"""
POS / Sales Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/pos/models.py)
"""
from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import TenantModel, VerifiableModel, User


class Order(VerifiableModel):
    TYPES = (
        ('SALE', 'Sale'),
        ('PURCHASE', 'Purchase'),
        ('RETURN', 'Return'),
    )
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending'),
        ('AUTHORIZED', 'Authorized'),
        ('RECEIVED', 'Received'),
        ('INVOICED', 'Invoiced'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )
    type = models.CharField(max_length=20, choices=TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    ref_code = models.CharField(max_length=100, null=True, blank=True)
    contact = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)
    
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    airsi_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    vat_recoverable = models.BooleanField(default=False)
    payment_method = models.CharField(max_length=50, default='CASH')
    invoice_price_type = models.CharField(max_length=20, default='TTC')
    is_locked = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    invoice_number = models.CharField(max_length=100, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # POS Commercial Integrity: Cryptographic Signing
    receipt_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    previous_hash = models.CharField(max_length=64, null=True, blank=True)

    def calculate_hash(self):
        """Calculates SHA-256 hash for this order/receipt."""
        import hashlib
        import json
        
        def serializer(obj):
            if isinstance(obj, Decimal): return str(obj)
            return str(obj)

        lines_data = []
        for line in self.lines.all():
            lines_data.append({
                "product_id": line.product_id,
                "qty": str(line.quantity),
                "price": str(line.unit_price)
            })

        data = {
            "id": self.id,
            "organization_id": self.organization_id,
            "type": self.type,
            "total": str(self.total_amount),
            "invoice_number": self.invoice_number,
            "lines": lines_data,
            "previous_hash": self.previous_hash or "GENESIS"
        }
        
        encoded_data = json.dumps(data, sort_keys=True, default=serializer).encode('utf-8')
        return hashlib.sha256(encoded_data).hexdigest()

    def save(self, *args, **kwargs):
        if self.pk:
            original = Order.objects.get(pk=self.pk)
            # Immutability Guard for finalized orders
            if original.status in ['COMPLETED', 'INVOICED', 'RECEIVED']:
                if not kwargs.get('force_audit_bypass', False):
                    raise ValidationError(f"Immutable POS: Orders in status '{original.status}' cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in ['COMPLETED', 'INVOICED', 'RECEIVED']:
            raise ValidationError(f"Immutable POS: Orders in status '{self.status}' cannot be deleted.")
        super().delete(*args, **kwargs)

    class Meta:
        db_table = 'pos_order'

    def __str__(self):
        return f"ORD-{self.id} ({self.type})"


class OrderLine(TenantModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    unit_cost_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    unit_cost_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    vat_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    airsi_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    effective_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    expiry_date = models.DateField(null=True, blank=True)
    batch = models.ForeignKey('inventory.Inventory', on_delete=models.SET_NULL, null=True, blank=True, related_name='order_lines')
    
    # Procurement Tracking
    qty_received = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    qty_invoiced = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    price_override_detected = models.BooleanField(default=False)

    # Consignment Management
    is_consignment = models.BooleanField(default=False)
    consignment_settled = models.BooleanField(default=False)
    consignment_payout = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Amount to be paid to supplier'
    )

    class Meta:
        db_table = 'pos_orderline'


# Import models from sub-files so Django discovers them for migrations
from apps.pos.returns_models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine  # noqa: E402, F401
from apps.pos.quotation_models import Quotation, QuotationLine  # noqa: E402, F401
from apps.pos.delivery_models import DeliveryZone, DeliveryOrder  # noqa: E402, F401
from apps.pos.discount_models import DiscountRule, DiscountUsageLog  # noqa: E402, F401
from apps.pos.consignment_models import ConsignmentSettlement, ConsignmentSettlementLine  # noqa: E402, F401
from apps.pos.sourcing_models import ProductSupplier, SupplierPriceHistory  # noqa: E402, F401
from apps.pos.purchase_order_models import PurchaseOrder, PurchaseOrderLine  # noqa: E402, F401

