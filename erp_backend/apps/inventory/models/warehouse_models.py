from django.db import models
from decimal import Decimal
from erp.models import TenantModel, Site

class Warehouse(TenantModel):
    site = models.ForeignKey(Site, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=50, default='GENERAL')
    can_sell = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    legacy_id = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'warehouse'
        unique_together = ('code', 'site', 'organization')

    def __str__(self):
        return self.name


class Inventory(TenantModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='inventory')
    variant = models.ForeignKey('inventory.ProductVariant', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_stock')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    expiry_date = models.DateField(null=True, blank=True)
    is_consignment = models.BooleanField(default=False)
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, 
        limit_choices_to={'type': 'SUPPLIER'},
        related_name='consignment_stock'
    )
    consignment_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    batch = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_batches')

    class Meta:
        db_table = 'inventory'
        unique_together = ('warehouse', 'product', 'variant', 'organization')


class InventoryMovement(TenantModel):
    MOVEMENT_TYPES = (
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
        ('ADJUSTMENT', 'Adjustment'),
        ('TRANSFER', 'Transfer'),
    )
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    reference = models.CharField(max_length=100, null=True, blank=True)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    reason = models.TextField(null=True, blank=True)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'inventorymovement'
