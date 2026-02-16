"""
Stock Count (Inventory Mode) Models
====================================
InventorySession — physical inventory counting session
InventorySessionLine — per-product counting line
MicroSection — filter-based sub-group within a session
CountingAdjustmentOrder — adjustment order generated from verification
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
    Tracks dual-person counting with verification workflow.
    """
    STATUS_CHOICES = (
        ('IN_PROGRESS', 'In Progress'),
        ('PENDING_VERIFICATION', 'Pending Verification'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    reference = models.CharField(max_length=100, null=True, blank=True)
    session_date = models.DateField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='IN_PROGRESS')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, related_name='counting_sessions')
    description = models.TextField(null=True, blank=True)

    # Filters used to scope which products are in this session
    category_filter = models.ForeignKey('inventory.Category', on_delete=models.SET_NULL, null=True, blank=True)
    supplier_filter = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    min_qty_filter = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    max_qty_filter = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    # Team assignment (JSON array of user IDs)
    assigned_users = models.JSONField(default=list, blank=True)

    # Counters
    total_products = models.IntegerField(default=0)
    counted_products = models.IntegerField(default=0)
    verified_products = models.IntegerField(default=0)

    # Adjustment order link
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

    @property
    def progress_percent(self):
        if self.total_products == 0:
            return 0
        return round((self.counted_products / self.total_products) * 100)


# =============================================================================
# INVENTORY SESSION LINE
# =============================================================================

class InventorySessionLine(models.Model):
    """
    Per-product counting line within a session.
    Supports dual-person counting (person_1_qty, person_2_qty).
    """
    session = models.ForeignKey(InventorySession, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE)
    system_qty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Dual-person counting
    person_1_qty = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    person_1_user = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='counting_lines_p1')
    person_1_at = models.DateTimeField(null=True, blank=True)
    person_1_locked = models.BooleanField(default=False)

    person_2_qty = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    person_2_user = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='counting_lines_p2')
    person_2_at = models.DateTimeField(null=True, blank=True)
    person_2_locked = models.BooleanField(default=False)

    # Computed difference
    difference = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))

    # Verification
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_counting_lines')
    verified_at = models.DateTimeField(null=True, blank=True)

    # Section assignment
    micro_section = models.ForeignKey('MicroSection', on_delete=models.SET_NULL, null=True, blank=True, related_name='lines')

    # Notes
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'inventory_session_line'
        unique_together = ('session', 'product')

    def __str__(self):
        return f"{self.product} — sys:{self.system_qty} p1:{self.person_1_qty} p2:{self.person_2_qty}"

    def compute_difference(self):
        """Calculate difference between physical count and system qty."""
        # Use person_1 count as primary, person_2 as backup
        physical = self.person_1_qty if self.person_1_qty is not None else self.person_2_qty
        if physical is not None:
            self.difference = physical - self.system_qty
        return self.difference


# =============================================================================
# MICRO SECTION
# =============================================================================

class MicroSection(models.Model):
    """
    Filter-based sub-group within a counting session.
    Used to divide work among team members by category, brand, etc.
    """
    session = models.ForeignKey(InventorySession, on_delete=models.CASCADE, related_name='micro_sections')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)

    # Filter config (JSON: {category_id, brand_id, supplier_id, min_qty, max_qty})
    filter_config = models.JSONField(default=dict, blank=True)

    # Assigned counters
    assigned_users = models.JSONField(default=list, blank=True)

    product_count = models.IntegerField(default=0)
    counted_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'inventory_micro_section'

    def __str__(self):
        return f"{self.name} ({self.session})"
