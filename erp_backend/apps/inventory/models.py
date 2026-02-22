"""
Inventory Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/inventory/models.py)
"""
from django.db import models
from django.db.models import Q, UniqueConstraint
from decimal import Decimal
from erp.models import TenantModel, VerifiableModel, Organization, Site, Country


# =============================================================================
# PRODUCT TAXONOMY
# =============================================================================

class Unit(TenantModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=20, null=True, blank=True)
    type = models.CharField(max_length=50, default='UNIT')
    conversion_factor = models.DecimalField(max_digits=15, decimal_places=6, default=1.0)
    base_unit = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='derived_units')
    allow_fraction = models.BooleanField(default=True)
    needs_balance = models.BooleanField(default=False)
    balance_code_structure = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'unit'
        constraints = [
            models.UniqueConstraint(fields=['code', 'organization'], name='unique_unit_code_org')
        ]

    def __str__(self):
        return self.code


class Category(TenantModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    # ── Auto-Computed Fields ───────────────────────────────────
    level = models.IntegerField(
        default=0, help_text='Depth in category tree (0 = root)'
    )
    full_path = models.CharField(
        max_length=1000, null=True, blank=True,
        help_text='Full breadcrumb path: "Electronics > Phones > Smartphones"'
    )
    products_count = models.IntegerField(
        default=0, help_text='Cached count of active products'
    )
    barcode_sequence = models.IntegerField(
        default=0, help_text='Next barcode sequence number for auto-SKU'
    )

    class Meta:
        db_table = 'category'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_category_name_org')
        ]

    def __str__(self):
        return self.full_path or self.name

    def save(self, *args, **kwargs):
        """Auto-compute level and full_path on every save."""
        self._compute_level_and_path()
        super().save(*args, **kwargs)
        # Update children paths if this category's name changed
        for child in self.children.all():
            child.save()

    def _compute_level_and_path(self):
        """Walk up parent chain to compute level and full breadcrumb path."""
        parts = [self.name]
        current = self.parent
        depth = 0
        seen = set()  # Prevent infinite loop on circular reference
        while current and current.pk not in seen:
            seen.add(current.pk)
            parts.insert(0, current.name)
            current = current.parent
            depth += 1
        self.level = depth
        self.full_path = ' > '.join(parts)

    def refresh_products_count(self):
        """Refresh cached product count from the database."""
        try:
            from apps.inventory.models import Product
            self.products_count = Product.objects.filter(
                category=self, is_active=True
            ).count()
            self.save(update_fields=['products_count'])
        except Exception:
            pass

    def next_barcode(self):
        """Generate next auto-barcode for this category."""
        self.barcode_sequence += 1
        self.save(update_fields=['barcode_sequence'])
        prefix = (self.code or self.name[:3]).upper()
        return f"{prefix}-{self.barcode_sequence:05d}"


class Brand(TenantModel):
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    logo = models.CharField(max_length=255, null=True, blank=True)
    countries = models.ManyToManyField(Country, blank=True, related_name='brands')
    categories = models.ManyToManyField(Category, blank=True, related_name='brands')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'brand'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_brand_name_org')
        ]

    def __str__(self):
        return self.name


class Parfum(TenantModel):
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name='parfums')

    class Meta:
        db_table = 'parfum'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_parfum_name_org')
        ]

    def __str__(self):
        return self.name


class ProductGroup(TenantModel):
    name = models.CharField(max_length=255)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_groups')
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    image = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'productgroup'

    def __str__(self):
        return self.name


# =============================================================================
# PRODUCTS
# =============================================================================

class Product(TenantModel):
    PRODUCT_TYPES = (
        ('STANDARD', 'Standard'),
        ('COMBO', 'Combo / Bundle'),
        ('SERVICE', 'Service'),
    )

    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='STANDARD')

    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True)
    product_group = models.ForeignKey(ProductGroup, on_delete=models.SET_NULL, null=True, blank=True)

    # Emballage / Size (e.g., 300ml, 500g)
    size = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='sized_products')

    legacy_id = models.IntegerField(null=True, blank=True, help_text='ID from legacy tsfci.com system')
    image_url = models.CharField(max_length=500, null=True, blank=True)

    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    min_stock_level = models.IntegerField(default=10)
    max_stock_level = models.IntegerField(null=True, blank=True, help_text='Maximum stock level before overstock alert')
    reorder_point = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True,
                                         help_text='Stock level at which to trigger reorder alert')
    reorder_quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True,
                                            help_text='Suggested quantity to reorder')
    is_expiry_tracked = models.BooleanField(default=False)
    tracks_serials = models.BooleanField(default=False, help_text='Requires Serial/IMEI per unit')

    status = models.CharField(max_length=20, default='ACTIVE')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'product'
        constraints = [
            UniqueConstraint(fields=['sku', 'organization'], name='unique_product_sku_per_org'),
            UniqueConstraint(
                fields=['barcode', 'organization'],
                name='unique_product_barcode_per_org',
                condition=Q(barcode__isnull=False),
            ),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class ComboComponent(TenantModel):
    """Links a COMBO product to its child products with quantities."""
    combo_product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='combo_components',
        help_text='The parent combo/bundle product'
    )
    component_product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='part_of_combos',
        help_text='The child product included in this combo'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    price_override = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Optional price override for this component within the combo'
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'combo_component'
        unique_together = ('combo_product', 'component_product', 'organization')
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.combo_product.name} → {self.component_product.name} ×{self.quantity}"


# =============================================================================
# WAREHOUSING & STOCK
# =============================================================================

class Warehouse(TenantModel):
    site = models.ForeignKey(Site, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    type = models.CharField(max_length=50, default='GENERAL')
    can_sell = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    legacy_id = models.IntegerField(null=True, blank=True, help_text='ID from legacy tsfci.com system')

    class Meta:
        db_table = 'warehouse'
        unique_together = ('code', 'site', 'organization')

    def __str__(self):
        return self.name


class Inventory(TenantModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, default=0.0)
    expiry_date = models.DateField(null=True, blank=True)

    # Consignment Tracking
    is_consignment = models.BooleanField(default=False)
    supplier = models.ForeignKey(
        'crm.Contact', on_delete=models.SET_NULL, null=True, blank=True, 
        limit_choices_to={'type': 'SUPPLIER'},
        related_name='consignment_stock'
    )
    consignment_cost = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'), 
        help_text='Agreed payout amount to supplier per unit'
    )
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    batch = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_batches')

    class Meta:
        db_table = 'inventory'
        unique_together = ('warehouse', 'product', 'organization')


class InventoryMovement(TenantModel):
    MOVEMENT_TYPES = (
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
        ('ADJUSTMENT', 'Adjustment'),
        ('TRANSFER', 'Transfer'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
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


# =============================================================================
# STOCK ADJUSTMENT ORDERS
# =============================================================================

class StockAdjustmentOrder(VerifiableModel):
    """
    Order header for stock adjustments. Contains line items.
    Inherits VerifiableModel for lifecycle (OPEN→LOCKED→VERIFIED→CONFIRMED).
    When CONFIRMED, executes all line adjustments via InventoryService.
    """
    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='adjustment_orders')
    reason = models.TextField(null=True, blank=True)
    total_qty_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    is_posted = models.BooleanField(default=False, help_text='Whether adjustments have been executed')
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='adjustment_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustment_order'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"ADJ-{self.reference or self.pk}"


class StockAdjustmentLine(models.Model):
    """Per-product adjustment line within an order."""
    order = models.ForeignKey(StockAdjustmentOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty_adjustment = models.DecimalField(max_digits=15, decimal_places=2,
        help_text='Positive = gain, Negative = loss')
    amount_adjustment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE,
        help_text='Specific location for this adjustment')
    reason = models.TextField(null=True, blank=True)
    recovered_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0,
        help_text='Insurance/recovery amount')
    reflect_transfer = models.ForeignKey('StockTransferOrder', on_delete=models.SET_NULL,
        null=True, blank=True, help_text='Linked transfer order if applicable')
    added_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustment_line'

    def __str__(self):
        return f"{self.product} → {self.qty_adjustment}"


# =============================================================================
# STOCK TRANSFER ORDERS
# =============================================================================

class StockTransferOrder(VerifiableModel):
    """
    Order header for stock transfers between warehouses.
    When CONFIRMED, executes all line transfers via InventoryService.
    """
    reference = models.CharField(max_length=100, null=True, blank=True)
    date = models.DateField()
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfers_out')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfers_in')
    driver = models.CharField(max_length=255, null=True, blank=True)
    supplier = models.ForeignKey('crm.Contact', on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    total_qty_transferred = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_posted = models.BooleanField(default=False, help_text='Whether transfers have been executed')
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='transfer_orders')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_transfer_order'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"TRF-{self.reference or self.pk}"


class StockTransferLine(models.Model):
    """Per-product transfer line within an order."""
    order = models.ForeignKey(StockTransferOrder, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty_transferred = models.DecimalField(max_digits=15, decimal_places=2)
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfer_lines_out')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='transfer_lines_in')
    reason = models.TextField(null=True, blank=True)
    recovered_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0,
        help_text='Damage recovery amount')
    added_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'stock_transfer_line'

    def __str__(self):
        return f"{self.product} × {self.qty_transferred}"


# =============================================================================
# OPERATIONAL REQUESTS (Central Request Hub)
# =============================================================================

class OperationalRequest(TenantModel):
    """
    Unified queue where users submit requests for PO, adjustments, or transfers.
    Managers approve and convert approved requests into actual orders.
    """
    REQUEST_TYPES = (
        ('PURCHASE_ORDER', 'Purchase Order'),
        ('STOCK_ADJUSTMENT', 'Stock Adjustment'),
        ('STOCK_TRANSFER', 'Stock Transfer'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )
    REQUEST_STATUS = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('CONVERTED', 'Converted'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    )

    reference = models.CharField(max_length=100, null=True, blank=True)
    request_type = models.CharField(max_length=30, choices=REQUEST_TYPES)
    requested_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='operational_requests')
    date = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    status = models.CharField(max_length=20, choices=REQUEST_STATUS, default='PENDING')
    description = models.TextField(null=True, blank=True)
    approved_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requests')
    approved_at = models.DateTimeField(null=True, blank=True)
    converted_to_type = models.CharField(max_length=30, null=True, blank=True,
        help_text='Type of order created: stock_adjustment, stock_transfer, purchase_order')
    converted_to_id = models.IntegerField(null=True, blank=True,
        help_text='ID of the created order')
    rejection_reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'operational_request'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"REQ-{self.reference or self.pk} ({self.request_type})"


class OperationalRequestLine(models.Model):
    """Individual item line in a request."""
    request = models.ForeignKey(OperationalRequest, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'operational_request_line'

    def __str__(self):
        return f"{self.product} × {self.quantity}"


# Import models from sub-files so Django discovers them for migrations
from apps.inventory.advanced_models import ProductBatch, ProductSerial, SerialLog, ExpiryAlert, StockValuationEntry  # noqa: E402, F401
from apps.inventory.counting_models import InventorySession, InventorySessionLine  # noqa: E402, F401
from apps.inventory.alert_models import StockAlert  # noqa: E402, F401

