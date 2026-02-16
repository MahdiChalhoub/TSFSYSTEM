from django.db import models
from erp.models import Organization, TenantModel
from apps.inventory.models import Product, Warehouse

class ProductSerial(TenantModel):
    """
    Tracks a unique physical item (Serial Number, IMEI, etc.)
    """
    STATUS_CHOICES = (
        ('IN_STOCK', 'In Stock'),
        ('SOLD', 'Sold'),
        ('RETURNED', 'Returned'),
        ('DAMAGED', 'Damaged'),
        ('LOST', 'Lost'),
        ('IN_TRANSIT', 'In Transit'),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='serials')
    serial_number = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_STOCK')
    
    # Current location
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name='stored_serials')
    
    # History context
    last_order_id = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_serial'
        unique_together = ('organization', 'serial_number')

    def __str__(self):
        return f"{self.product.name} ({self.serial_number})"

class SerialLog(TenantModel):
    """
    Audit trail for a specific serial number.
    """
    serial = models.ForeignKey(ProductSerial, on_delete=models.CASCADE, related_name='logs')
    action = models.CharField(max_length=100) # PURCHASE, SALE, TRANSFER, ADJUSTMENT
    reference = models.CharField(max_length=100, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    user_name = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_serial_log'
        ordering = ['-created_at']
