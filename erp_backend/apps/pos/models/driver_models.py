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

    # Structured vehicle category — drives icon/badge rendering and per-type
    # filtering (e.g. "find me a TRUCK driver for this big PO"). The
    # free-text `vehicle_info` field stays for human-readable details
    # (make/model). Default MOTORCYCLE matches what the UI used to send
    # when the form silently dropped the field.
    VEHICLE_TYPE_CHOICES = (
        ('MOTORCYCLE', 'Motorcycle'),
        ('CAR', 'Car'),
        ('VAN', 'Van'),
        ('TRUCK', 'Truck'),
        ('BICYCLE', 'Bicycle'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    phone = models.CharField(max_length=50, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    vehicle_info = models.CharField(max_length=200, blank=True, null=True, help_text="e.g. Toyota Corolla (ABC-123)")
    # Structured category — see VEHICLE_TYPE_CHOICES above.
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES,
        default='MOTORCYCLE',
        help_text="Vehicle category — drives icon/badge rendering.")
    # Plate is queried separately from `vehicle_info` so settings UI / GR
    # documents / handover slips can format it consistently.
    vehicle_plate = models.CharField(max_length=50, blank=True, null=True,
        help_text="Numeric plate printed on dispatch slips and PO handover.")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OFFLINE')
    is_active_fleet = models.BooleanField(default=True, help_text="Set to False to exclude from auto-dispatch")
    # Per-module availability — a tenant may have a driver who only does
    # store deliveries (sales) or only handles purchase pickups. The
    # `users/?driver_for=…` filter reads these to scope each module's
    # picker. Defaults to True so existing rows keep showing up everywhere.
    available_for_sales = models.BooleanField(default=True,
        help_text="Show this driver in the sales/POS delivery picker.")
    available_for_purchase = models.BooleanField(default=True,
        help_text="Show this driver in the purchase-order driver picker.")

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


class ExternalDriver(TenantModel):
    """
    A reusable contractor / one-off driver the tenant uses for pickups
    or deliveries but doesn't onboard as a User. Holds just enough info
    to identify and contact them — name + phone — plus optional vehicle
    details for dispatch slips.

    Distinct from `Driver`: external drivers have NO User row and earn
    no commission rows in our books (they invoice us externally). They
    show up in the PO form's driver picker when source = EXTERNAL, so
    the operator picks instead of re-typing name + phone every time.
    """
    name = models.CharField(max_length=120,
        help_text='Display name on dispatch slips and the picker.')
    phone = models.CharField(max_length=50, blank=True, null=True)
    vehicle_plate = models.CharField(max_length=50, blank=True, null=True,
        help_text='License plate printed on the handover document.')
    vehicle_info = models.CharField(max_length=200, blank=True, null=True,
        help_text='Free-text vehicle description, e.g. "White Hilux".')
    notes = models.TextField(blank=True, null=True,
        help_text='Operator notes — preferred routes, working hours, etc.')
    is_active = models.BooleanField(default=True,
        help_text='Hides from the picker without deleting the row.')

    class Meta:
        db_table = 'pos_external_driver'
        verbose_name = 'External Driver'
        verbose_name_plural = 'External Drivers'
        # One name per tenant — stops accidental duplicates from
        # repeated typos when adding inline from the PO form.
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'],
                name='unique_external_driver_name_per_org',
            ),
        ]

    def __str__(self):
        return f"{self.name} (external)"
