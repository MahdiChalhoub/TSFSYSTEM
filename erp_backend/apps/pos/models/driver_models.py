from django.db import models
from decimal import Decimal
from erp.models import TenantModel, User

class Driver(TenantModel):
    """
    Extended profile for a User who acts as a delivery driver.
    """
    STATUS_CHOICES = (
        ('ONLINE', 'Online / Available'),
        ('BUSY', 'Busy / Delivering'),
        ('OFFLINE', 'Offline / Away'),
    )

    COMMISSION_TYPE_CHOICES = (
        ('FLAT', 'Flat Fee per Delivery'),
        ('PERCENT', 'Percentage of Order Total'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    phone = models.CharField(max_length=50, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    vehicle_info = models.CharField(max_length=200, blank=True, null=True, help_text="e.g. Toyota Corolla (ABC-123)")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OFFLINE')
    is_active_fleet = models.BooleanField(default=True, help_text="Set to False to exclude from auto-dispatch")

    commission_type = models.CharField(max_length=10, choices=COMMISSION_TYPE_CHOICES, default='FLAT')
    commission_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    total_deliveries = models.PositiveIntegerField(default=0)
    total_earned = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    # Geo-tracking snapshots
    last_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'pos_driver'
        verbose_name = 'Driver'
        verbose_name_plural = 'Drivers'

    def __str__(self):
        return f"Driver: {self.user.get_full_name() or self.user.username} ({self.status})"

    def mark_busy(self):
        self.status = 'BUSY'
        self.save(update_fields=['status'])

    def mark_available(self):
        self.status = 'ONLINE'
        self.save(update_fields=['status'])
