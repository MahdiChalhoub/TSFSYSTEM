"""
Warehouse Location System
===========================
Hierarchical warehouse structure:
  Zone → Aisle → Rack → Shelf → Bin → ProductLocation

Full location code format: {zone}-{aisle}-{rack}-{shelf}-{bin}
"""
from django.db import models
from erp.models import TenantModel


class WarehouseZone(TenantModel):
    """Top-level warehouse zone (e.g. STORAGE, RECEIVING, SHIPPING, FROZEN)."""
    ZONE_TYPES = (
        ('STORAGE', 'Storage'),
        ('RECEIVING', 'Receiving'),
        ('SHIPPING', 'Shipping'),
        ('FROZEN', 'Frozen/Cold'),
        ('HAZMAT', 'Hazardous Materials'),
        ('RETURNS', 'Returns'),
        ('STAGING', 'Staging'),
    )

    warehouse = models.ForeignKey(
        'erp.Site', on_delete=models.CASCADE, related_name='zones',
        help_text='Warehouse site this zone belongs to'
    )
    code = models.CharField(max_length=10, help_text='Short code, e.g. "A", "FR01"')
    name = models.CharField(max_length=100)
    zone_type = models.CharField(max_length=20, choices=ZONE_TYPES, default='STORAGE')
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    capacity_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'warehouse_zone'
        unique_together = ['warehouse', 'code', 'organization']
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_zone_type_display()})"


class WarehouseAisle(TenantModel):
    """Aisle within a zone."""
    zone = models.ForeignKey(WarehouseZone, on_delete=models.CASCADE, related_name='aisles')
    code = models.CharField(max_length=10, help_text='Aisle code, e.g. "01", "A1"')
    name = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'warehouse_aisle'
        unique_together = ['zone', 'code']
        ordering = ['code']

    def __str__(self):
        return f"{self.zone.code}-{self.code}"


class WarehouseRack(TenantModel):
    """Rack within an aisle."""
    aisle = models.ForeignKey(WarehouseAisle, on_delete=models.CASCADE, related_name='racks')
    code = models.CharField(max_length=10, help_text='Rack code, e.g. "R01"')
    name = models.CharField(max_length=100, null=True, blank=True)
    max_weight_kg = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'warehouse_rack'
        unique_together = ['aisle', 'code']
        ordering = ['code']

    def __str__(self):
        return f"{self.aisle}-{self.code}"


class WarehouseShelf(TenantModel):
    """Shelf within a rack."""
    rack = models.ForeignKey(WarehouseRack, on_delete=models.CASCADE, related_name='shelves')
    code = models.CharField(max_length=10, help_text='Shelf code, e.g. "S01"')
    name = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'warehouse_shelf'
        unique_together = ['rack', 'code']
        ordering = ['code']

    def __str__(self):
        return f"{self.rack}-{self.code}"


class WarehouseBin(TenantModel):
    """
    Smallest unit of warehouse storage.
    Products are placed in bins.
    """
    shelf = models.ForeignKey(WarehouseShelf, on_delete=models.CASCADE, related_name='bins')
    code = models.CharField(max_length=10, help_text='Bin code, e.g. "B01"')
    name = models.CharField(max_length=100, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'warehouse_bin'
        unique_together = ['shelf', 'code']
        ordering = ['code']

    def __str__(self):
        return f"{self.shelf}-{self.code}"

    @property
    def full_location_code(self):
        """Build full location: ZONE-AISLE-RACK-SHELF-BIN."""
        shelf = self.shelf
        rack = shelf.rack
        aisle = rack.aisle
        zone = aisle.zone
        return f"{zone.code}-{aisle.code}-{rack.code}-{shelf.code}-{self.code}"


class ProductLocation(TenantModel):
    """
    Maps a product to a specific warehouse bin with quantity.
    A product can exist in multiple bins.
    """
    product = models.ForeignKey(
        'inventory.Product', on_delete=models.CASCADE, related_name='locations'
    )
    bin = models.ForeignKey(WarehouseBin, on_delete=models.CASCADE, related_name='product_locations')
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    min_quantity = models.DecimalField(
        max_digits=15, decimal_places=3, default=0,
        help_text='Minimum quantity to trigger restock alert'
    )
    max_quantity = models.DecimalField(
        max_digits=15, decimal_places=3, null=True, blank=True,
        help_text='Maximum capacity for this bin/product'
    )
    last_counted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'product_location'
        unique_together = ['product', 'bin']

    def __str__(self):
        return f"{self.product} @ {self.bin.full_location_code} ({self.quantity})"
