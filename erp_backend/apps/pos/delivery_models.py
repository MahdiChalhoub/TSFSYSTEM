"""
Delivery / Shipment Models
Tracks physical delivery of goods from an order to a customer location.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User


class DeliveryZone(TenantModel):
    """Named delivery zones with optional fee."""
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    base_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    estimated_days = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'delivery_zone'
        unique_together = ('name', 'organization')

    def __str__(self):
        return self.name


class DeliveryOrder(TenantModel):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PREPARING', 'Preparing'),
        ('IN_TRANSIT', 'In Transit'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    )
    order = models.ForeignKey('pos.Order', on_delete=models.CASCADE, related_name='deliveries')
    zone = models.ForeignKey(DeliveryZone, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Address
    recipient_name = models.CharField(max_length=200, null=True, blank=True)
    address_line1 = models.CharField(max_length=300, null=True, blank=True)
    address_line2 = models.CharField(max_length=300, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)

    # Logistics
    tracking_code = models.CharField(max_length=100, null=True, blank=True)
    delivery_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    driver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    notes = models.TextField(null=True, blank=True)

    # Timestamps
    scheduled_date = models.DateTimeField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'delivery_order'
        ordering = ['-created_at']

    def __str__(self):
        return f"DEL-{self.id} ({self.status})"
