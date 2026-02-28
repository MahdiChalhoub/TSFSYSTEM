"""
Delivery / Shipment Models
Tracks physical delivery of goods from an order to a customer location.
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User
import random
import string


def generate_confirmation_code():
    """6-digit numeric code (padded to always be 6 digits)."""
    return str(random.randint(100000, 999999))


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
        ('PENDING',    'Pending'),
        ('PREPARING',  'Preparing'),
        ('IN_TRANSIT', 'In Transit'),
        ('DELIVERED',  'Delivered'),
        ('FAILED',     'Failed'),
        ('CANCELLED',  'Cancelled'),
    )

    PAYMENT_MODE_CHOICES = (
        ('IMMEDIATE', 'Pay immediately to delivery man'),
        ('CREDIT',    'Client credit (authority required)'),
        ('HOLD',      'Hold — delivery man brings cash back'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('PENDING',   'Pending'),
        ('PAID',      'Paid'),
        ('CREDITED',  'Credited'),
        ('CANCELLED', 'Cancelled'),
    )

    order   = models.ForeignKey('pos.Order', on_delete=models.CASCADE, related_name='deliveries')
    zone    = models.ForeignKey(DeliveryZone, on_delete=models.SET_NULL, null=True, blank=True)
    session = models.ForeignKey('pos.RegisterSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_orders')
    status  = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    # Address
    recipient_name = models.CharField(max_length=200, null=True, blank=True)
    address_line1  = models.CharField(max_length=300, null=True, blank=True)
    address_line2  = models.CharField(max_length=300, null=True, blank=True)
    city           = models.CharField(max_length=100, null=True, blank=True)
    phone          = models.CharField(max_length=50,  null=True, blank=True)

    # Payment tracking
    payment_mode     = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES, default='HOLD')
    payment_status   = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    amount_due       = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    amount_collected = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Confirmation flags
    confirmed_by_driver = models.BooleanField(default=False)
    confirmed_by_pos    = models.BooleanField(default=False)

    # Logistics
    tracking_code = models.CharField(max_length=100, null=True, blank=True)
    delivery_fee  = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    driver        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    notes         = models.TextField(null=True, blank=True)

    # Timestamps
    scheduled_date = models.DateTimeField(null=True, blank=True)
    dispatched_at  = models.DateTimeField(null=True, blank=True)
    delivered_at   = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True, null=True, blank=True)

    # Phase 3 — Dual confirmation codes (both optional, controlled per org)
    # Code 1: Register ↔ Driver (driver shows this to cashier when returning cash)
    require_pos_return_code = models.BooleanField(default=False)
    pos_return_code         = models.CharField(max_length=10, null=True, blank=True)
    # Code 2: Driver ↔ Client (client gives this to driver to confirm delivery arrived)
    require_client_delivery_code = models.BooleanField(default=False)
    client_delivery_code         = models.CharField(max_length=10, null=True, blank=True)
    # GPS from driver mobile
    driver_latitude  = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    driver_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_gps_at      = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'delivery_order'
        ordering = ['-created_at']

    def __str__(self):
        return f"DEL-{self.id} ({self.status})"

    @property
    def is_payment_pending(self):
        """True when cash is in transit (HOLD mode, not yet returned to POS)."""
        return self.payment_mode == 'HOLD' and self.payment_status == 'PENDING'
