"""
Stock Count (Inventory Mode) Models
====================================
Cloned from count.tsfci.com — physical inventory counting with
dual-person verification and adjustment order generation.

Session flow: IN_PROGRESS → WAITING_VERIFICATION → VERIFIED → ADJUSTED
"""
from django.db import models
from decimal import Decimal
from erp.models import TenantModel


# =============================================================================
# INVENTORY SESSION
# =============================================================================

class InventorySession(TenantModel):
    """
    Physical inventory counting session.
    Each session targets a specific warehouse and optional category/supplier filters.
    Supports dual-person counting, manager verification, and adjustment generation.
    """
    STATUS_CHOICES = (
        ('IN_PROGRESS', 'In Progress'),
        ('WAITING_VERIFICATION', 'Waiting Verification'),
        ('VERIFIED', 'Verified'),
        ('ADJUSTED', 'Adjusted'),
        ('CANCELLED', 'Cancelled'),
    )

    reference = models.CharField(max_length=100, null=True, blank=True)
    location = models.CharField(max_length=255, help_text='Warehouse/location name')
    section = models.CharField(max_length=255, default='All Categories', help_text='Category section label')
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='counting_sessions'
    )
    session_date = models.DateField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='IN_PROGRESS')

    # Dual-person assignment
    person1_name = models.CharField(max_length=255, null=True, blank=True)
    person2_name = models.CharField(max_length=255, null=True, blank=True)

    # Filters used when creating session
    category_filter = models.CharField(max_length=255, null=True, blank=True)
    supplier_filter = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    qty_filter = models.CharField(max_length=20, null=True, blank=True, help_text='zero, non_zero, custom')
    qty_min = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    qty_max = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    # Team members (JSON array of {user_id, user_name})
    assigned_users = models.JSONField(default=list, blank=True)

    # Linked adjustment order created after verification
    adjustment_order = models.ForeignKey(
        'inventory.StockAdjustmentOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='counting_session'
    )

    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='counting_sessions')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'inventory_session'
        ordering = ['-session_date', '-created_at']

    def __str__(self):
        return f"COUNT-{self.reference or self.pk}"


# =============================================================================
# INVENTORY SESSION LINE
# =============================================================================

class InventorySessionLine(models.Model):
    """
    Per-product counting line. Tracks system qty, person 1 & 2 physical counts,
    differences, and whether adjustment is needed.
    """
    session = models.ForeignKey(InventorySession, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='counting_lines')

    system_qty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Dual-person physical counts
    physical_qty_person1 = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    physical_qty_person2 = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    # Computed differences
    difference_person1 = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    difference_person2 = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    # Verification flags
    is_same_difference = models.BooleanField(default=False, help_text='Both persons agree on count')
    needs_adjustment = models.BooleanField(default=False, help_text='Difference found, needs stock adjustment')
    is_verified = models.BooleanField(default=False)
    is_adjusted = models.BooleanField(default=False, help_text='Adjustment order has been created for this line')

    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'inventory_session_line'
        unique_together = ('session', 'product')

    def __str__(self):
        return f"{self.product} — sys:{self.system_qty} p1:{self.physical_qty_person1} p2:{self.physical_qty_person2}"

    def compute_differences(self):
        """Recalculate all difference fields based on current counts."""
        if self.physical_qty_person1 is not None:
            self.difference_person1 = self.physical_qty_person1 - self.system_qty
        if self.physical_qty_person2 is not None:
            self.difference_person2 = self.physical_qty_person2 - self.system_qty

        # Check if both persons agree
        if self.difference_person1 is not None and self.difference_person2 is not None:
            self.is_same_difference = (self.difference_person1 == self.difference_person2)
        elif self.difference_person1 is not None or self.difference_person2 is not None:
            self.is_same_difference = True  # Only one person counted

        # Needs adjustment if any difference exists
        diff = self.difference_person1 if self.difference_person1 is not None else self.difference_person2
        self.needs_adjustment = diff is not None and diff != 0

        return self
