"""
POS / Sales Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/pos/models.py)
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class Order(TenantModel):
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
    # Note: warehouse context comes via site or is set at checkout time
    # The `warehouse` column was never added to the DB, so we don't model it here.
    site = models.ForeignKey('erp.Site', on_delete=models.SET_NULL, null=True, blank=True)
    
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    airsi_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    invoice_number = models.CharField(max_length=100, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Order'

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
    effective_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    expiry_date = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'OrderLine'
