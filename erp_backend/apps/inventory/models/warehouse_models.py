from django.db import models
from decimal import Decimal
from erp.models import TenantModel


class Warehouse(TenantModel):
    """
    Unified location model — replaces both Site and Warehouse.
    A Warehouse can be a Branch/Site (top-level), a Store, a Warehouse, or Virtual.
    Hierarchy: parent → children (e.g., Branch → Store → Warehouse)
    """
    LOCATION_TYPES = (
        ('BRANCH', 'Branch / Site'),   # Top-level, replaces old "Site"
        ('STORE', 'Store'),            # Retail point of sale
        ('WAREHOUSE', 'Warehouse'),     # Pure storage
        ('VIRTUAL', 'Virtual'),         # Virtual / transit
    )

    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children',
        help_text='Parent location (e.g., a branch contains warehouses)'
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPES, default='WAREHOUSE')

    # ── Physical address (from old Site model) ──
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    vat_number = models.CharField(max_length=100, null=True, blank=True)

    # ── Operational flags ──
    can_sell = models.BooleanField(default=True,
        help_text='Can products be sold directly from this location?')
    is_active = models.BooleanField(default=True)
    legacy_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'warehouse'
        unique_together = ('code', 'organization')

    def __str__(self):
        prefix = dict(self.LOCATION_TYPES).get(self.location_type, '')
        return f"{self.name} ({prefix})" if prefix else self.name

    @property
    def is_branch(self):
        return self.location_type == 'BRANCH'

    @property
    def is_store(self):
        return self.location_type == 'STORE'

    @property
    def site_name(self):
        """Backward compat: return the branch/parent name."""
        if self.parent:
            return self.parent.name
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
