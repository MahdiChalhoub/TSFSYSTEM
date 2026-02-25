"""
Sourcing & Vendor Pricing Models
Tracks which suppliers provide which products and the evolution of their pricing.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class ProductSupplier(TenantModel):
    """Links a product to a specific supplier with terms."""
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='qualified_suppliers')
    supplier = models.ForeignKey('crm.Contact', on_delete=models.CASCADE, related_name='supplied_products')
    
    supplier_sku = models.CharField(max_length=100, null=True, blank=True, help_text="Supplier's internal part number")
    lead_time_days = models.IntegerField(default=7, help_text="Typical delay in days from order to reception")
    min_order_qty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('1.00'))
    
    is_active = models.BooleanField(default=True)
    is_preferred = models.BooleanField(default=False)
    
    last_purchased_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    last_purchased_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'pos_product_supplier'
        unique_together = ('product', 'supplier', 'organization')

    def __str__(self):
        return f"{self.supplier.name} -> {self.product.name}"


class SupplierPriceHistory(TenantModel):
    """Snapshot of a supplier's price for a product at a point in time."""
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    supplier = models.ForeignKey('crm.Contact', on_delete=models.CASCADE)
    
    price = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=10, default='XOF')
    
    effective_date = models.DateTimeField(auto_now_add=True)
    reference_order = models.ForeignKey('pos.Order', on_delete=models.SET_NULL, null=True, blank=True)
    
    notes = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'pos_supplier_price_history'
        ordering = ['-effective_date']

    def __str__(self):
        return f"{self.product.name} @ {self.price} ({self.supplier.name})"
