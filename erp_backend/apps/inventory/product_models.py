from django.db import models
from django.db.models import Q, UniqueConstraint
from decimal import Decimal
from erp.models import Country
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.events import emit_event


class Unit(AuditLogMixin, TenantOwnedModel):
    """Unit of measurement with Kernel OS v2.0 integration"""
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
            models.UniqueConstraint(fields=['code', 'organization'], name='unique_unit_code_tenant')
        ]

    def __str__(self):
        return self.code


class Category(AuditLogMixin, TenantOwnedModel):
    """Product category with Kernel OS v2.0 integration"""
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    level = models.IntegerField(default=0)
    full_path = models.CharField(max_length=1000, null=True, blank=True)
    products_count = models.IntegerField(default=0)
    barcode_sequence = models.IntegerField(default=0)

    class Meta:
        db_table = 'category'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_category_name_tenant')
        ]

    def __str__(self):
        return self.full_path or self.name

    def save(self, *args, **kwargs):
        self._compute_level_and_path()
        super().save(*args, **kwargs)
        for child in self.children.all():
            child.save()

    def _compute_level_and_path(self):
        parts = [self.name]
        current = self.parent
        depth = 0
        seen = set()
        while current and current.pk not in seen:
            seen.add(current.pk)
            parts.insert(0, current.name)
            current = current.parent
            depth += 1
        self.level = depth
        self.full_path = ' > '.join(parts)


class Brand(AuditLogMixin, TenantOwnedModel):
    """Brand with Kernel OS v2.0 integration"""
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    logo = models.CharField(max_length=255, null=True, blank=True)
    countries = models.ManyToManyField(Country, blank=True, related_name='brands')
    categories = models.ManyToManyField(Category, blank=True, related_name='brands')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'brand'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_brand_name_tenant')
        ]

    def __str__(self):
        return self.name


class Parfum(AuditLogMixin, TenantOwnedModel):
    """Parfum/Fragrance with Kernel OS v2.0 integration"""
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name='parfums')

    class Meta:
        db_table = 'parfum'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_parfum_name_tenant')
        ]

    def __str__(self):
        return self.name


class ProductGroup(AuditLogMixin, TenantOwnedModel):
    """Product group with Kernel OS v2.0 integration"""
    name = models.CharField(max_length=255)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_groups')
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    image = models.CharField(max_length=255, null=True, blank=True)

    # ── Level 1: Price Sync ─────────────────────────────────────────
    price_sync_enabled = models.BooleanField(
        default=True,
        help_text='When enabled, changing any member product price updates all members'
    )
    base_selling_price_ttc = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Reference selling price (TTC) for all products in this group'
    )
    base_selling_price_ht = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Reference selling price (HT) for all products in this group'
    )
    packaging_formula = models.JSONField(
        default=dict, blank=True,
        help_text='Per-packaging-level discount formula, e.g. {"CARTON": {"discount_pct": 2.0}, "PAQUET": {"discount_pct": 5.0}}'
    )

    class Meta:
        db_table = 'productgroup'

    def __str__(self):
        return self.name


class Product(AuditLogMixin, TenantOwnedModel):
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
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    product_group = models.ForeignKey(ProductGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    size = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='sized_products')
    legacy_id = models.IntegerField(null=True, blank=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cost_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    selling_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    min_stock_level = models.IntegerField(default=10)
    max_stock_level = models.IntegerField(null=True, blank=True)
    reorder_point = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    reorder_quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    shelf_display_capacity = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Physical capacity of the display shelf for this product'
    )

    @property
    def effective_cost(self):
        """Standard property access (honors Org policy & Valuation method)."""
        return self.get_effective_cost()

    def get_effective_cost(self, tax_ctx=None, last_pp_fallback=None, settings=None, warehouse_id=None, scope='OFFICIAL'):
        """
        Premium Dynamic Cost Engine (Scope-Aware & Multi-Tax Capitalization).
        Resolves value based on:
        1. Fiscal Scope (OFFICIAL / INTERNAL)
        2. Organization Policy (pricingCostBasis: AMC, FIFO, LIFO, HT, TTC)
        3. Real-time Multi-Tax Recoverability logic (VAT, Purchase Tax, AIRSI, Custom)
        4. Underlying Valuation Strategy (cost_valuation_method)
        """
        from erp.services import ConfigurationService
        # Refactored: Avoid direct cross-module imports from apps.finance
        from erp.services import TaxService

        if not settings:
            settings = ConfigurationService.get_global_settings(self.organization)
        
        if not tax_ctx:
            # Refactored: Use universal TaxService instead of direct finance imports
            tax_ctx = TaxService.get_engine_context(self.organization, scope=scope)

        # ── 0. Scope-Based Early Exit ──
        # If INTERNAL scope + TTC_ALWAYS mode, we forcedly return TTC if possible
        if scope == 'INTERNAL' and getattr(tax_ctx, 'internal_cost_mode', 'TTC_ALWAYS') == 'TTC_ALWAYS':
            if (self.cost_price_ttc or 0) > 0:
                return self.cost_price_ttc

        basis = settings.get('pricingCostBasis', 'AMC')
        valuation_method = self.cost_valuation_method or 'WAVG'
        
        # If basis is 'AUTO' or 'AMC', we honor the product's actual valuation method
        if basis in ['AUTO', 'AMC', 'VALUATION']:
            if valuation_method == 'FIFO': basis = 'FIFO'
            elif valuation_method == 'LIFO': basis = 'LIFO'
            else: basis = 'AMC'

        # ── 1. Primary Resolution ──
        final_val = Decimal('0.00')

        if basis == 'AMC':
            final_val = self.cost_price or Decimal('0.00')
        
        elif basis in ['FIFO', 'LIFO']:
            try:
                from .advanced_models import StockValuationEntry
                entry_qs = StockValuationEntry.objects.filter(
                    organization=self.organization, 
                    product=self,
                    movement_type='IN',
                    running_quantity__gt=0
                )
                if warehouse_id:
                    entry_qs = entry_qs.filter(warehouse_id=warehouse_id)
                
                # FIFO = Oldest non-consumed layer
                # LIFO = Newest non-consumed layer
                order = 'movement_date' if basis == 'FIFO' else '-movement_date'
                layer = entry_qs.order_by(order, '-created_at').first()
                if layer:
                    final_val = layer.unit_cost
                else:
                    final_val = self.cost_price # Fallback to AMC
            except Exception:
                final_val = self.cost_price

        elif basis == 'HT':
            final_val = self.cost_price_ht or Decimal('0.00')
        
        elif basis == 'TTC':
            final_val = self.cost_price_ttc or Decimal('0.00')

        # ── 2. Automatic Tax Capitalization (Theoretical Injection) ──
        # If the primary basis is a theoretical HT cost, we must apply capitalize-able taxes.
        if final_val > 0 and basis == 'HT':
            try:
                resolved = TaxService.resolve_purchase_costs(
                    base_ht=final_val,
                    vat_rate=(self.tva_rate or Decimal('0')) / Decimal('100'),
                    airsi_rate=getattr(self, 'airsi_rate', Decimal('0')) / Decimal('100'),
                    ctx=tax_ctx
                )
                return resolved['cost_official'] if scope == 'OFFICIAL' else resolved.get('cost_internal', resolved['cost_official'])
            except Exception:
                pass

        if final_val > 0:
            return final_val

        # ── 3. Intelligent Fallback Chain ──
        # Fallback A: Moving Average (Fact)
        if (self.cost_price or 0) > 0:
            return self.cost_price

        # Fallback B: Theoretical HT + Complex Tax Injection (Fiscal Reality)
        ht = self.cost_price_ht or 0
        if ht > 0:
            try:
                resolved = TaxService.resolve_purchase_costs(
                    base_ht=ht,
                    vat_rate=(self.tva_rate or Decimal('0')) / Decimal('100'),
                    airsi_rate=getattr(self, 'airsi_rate', Decimal('0')) / Decimal('100'),
                    ctx=tax_ctx
                )
                return resolved['cost_official'] if scope == 'OFFICIAL' else resolved.get('cost_internal', resolved['cost_official'])
            except Exception:
                return ht

        # Fallback C: Last Purchased Price (Historical Trace)
        if last_pp_fallback is not None and last_pp_fallback > 0:
            return last_pp_fallback

        try:
            from erp.services import PurchaseService
            last_pp = PurchaseService.get_last_purchase_price(self.organization, self)
            if last_pp:
                return last_pp
        except Exception:
            pass

        return Decimal('0.00')

    @property
    def margin_pct(self):
        """
        Dynamic Profit Metric based on Company Strategy.
        Supports:
        - MARGIN (Default): (Revenue HT - Cost) / Revenue HT  --> "Profit as % of Sales"
        - MARKUP: (Revenue HT - Cost) / Cost                --> "Profit as % of Investment"
        """
        from erp.services import ConfigurationService
        settings = ConfigurationService.get_global_settings(self.organization)
        mode = settings.get('marginCalculationMode', 'MARGIN') # Default to Gross Margin

        cost = self.effective_cost
        sell = self.selling_price_ht or Decimal('0.00')
        profit = sell - cost

        if mode == 'MARKUP':
            if (cost or 0) <= 0: return 0.0
            return round(float((profit / cost) * 100), 2)
        else: # Default: MARGIN
            if (sell or 0) <= 0: return 0.0
            return round(float((profit / sell) * 100), 2)

    # ── Cost Valuation Method ───────────────────────────────────────
    COST_VALUATION_CHOICES = (
        ('WAVG', 'Weighted Average Cost (Moving Average)'),
        ('FIFO', 'First In, First Out'),
        ('LIFO', 'Last In, First Out'),
        ('STANDARD', 'Standard Cost (Fixed)'),
    )
    cost_valuation_method = models.CharField(
        max_length=10, choices=COST_VALUATION_CHOICES, default='WAVG',
        help_text='How the cost of goods is calculated when stock is consumed'
    )

    # ── Lot / Date Management Strategy ──────────────────────────────
    LOT_MANAGEMENT_CHOICES = (
        ('NONE', 'No lot tracking'),
        ('FIFO_AUTO', 'FIFO — Automatic (oldest lot consumed first)'),
        ('FEFO', 'FEFO — First Expiry, First Out (shortest life consumed first)'),
        ('MANUAL', 'Manual — Operator selects lot/layer at POS or picking'),
    )
    lot_management = models.CharField(
        max_length=12, choices=LOT_MANAGEMENT_CHOICES, default='NONE',
        help_text='How lots/batches are selected when consuming stock'
    )
    tracks_lots = models.BooleanField(
        default=False,
        help_text='Enable lot/batch number tracking for this product'
    )

    # ── Expiry / Shelf-Life Configuration ───────────────────────────
    is_expiry_tracked = models.BooleanField(default=False)
    manufacturer_shelf_life_days = models.IntegerField(
        null=True, blank=True,
        help_text='Total shelf life as per manufacturer, in days (e.g. 240 = 8 months)'
    )
    avg_available_expiry_days = models.IntegerField(
        null=True, blank=True,
        help_text='Typical remaining shelf life when product arrives, in days (e.g. 120 = 4 months)'
    )
    shipping_duration_days = models.IntegerField(
        null=True, blank=True,
        help_text='Average shipping/transit time in days — auto-populated from purchase invoices'
    )
    tracks_serials = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default='ACTIVE')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # ── Product Lifecycle Management — Completeness Levels ───────────
    DATA_COMPLETENESS_LEVELS = (
        (0, 'Draft'),        # L0: name + barcode only
        (1, 'Identified'),   # L1: + category, brand, attribute, unit
        (2, 'Priced'),       # L2: + selling price > 0
        (3, 'Inventoried'),  # L3: + inventory config (valuation, min stock)
        (4, 'Grouped'),      # L4: + product group
        (5, 'Packaged'),     # L5: + packaging levels
        (6, 'Sourced'),      # L6: + supplier linked
        (7, 'Complete'),     # L7: all above
        (8, 'Verified'),     # L8: manually verified by controller
    )
    COMPLETENESS_STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('IDENTIFIED', 'Identified'),
        ('PRICED', 'Priced'),
        ('INVENTORIED', 'Inventoried'),
        ('GROUPED', 'Grouped'),
        ('PACKAGED', 'Packaged'),
        ('SOURCED', 'Sourced'),
        ('COMPLETE', 'Complete'),
        ('VERIFIED', 'Verified'),
    )
    LEVEL_TO_STATUS = {
        0: 'DRAFT', 1: 'IDENTIFIED', 2: 'PRICED', 3: 'INVENTORIED',
        4: 'GROUPED', 5: 'PACKAGED', 6: 'SOURCED', 7: 'COMPLETE', 8: 'VERIFIED',
    }

    data_completeness_level = models.IntegerField(
        default=0, choices=DATA_COMPLETENESS_LEVELS,
        help_text='Auto-computed maturity level (0=Draft → 8=Verified)'
    )
    completeness_status = models.CharField(
        max_length=15, choices=COMPLETENESS_STATUS_CHOICES, default='DRAFT',
        help_text='Human-readable status derived from data_completeness_level'
    )
    is_verified = models.BooleanField(
        default=False,
        help_text='Manually set by controller/manager to mark product as fully verified'
    )

    def compute_completeness(self, save_related_check=True):
        """
        Auto-compute the data completeness level based on which fields are filled.
        Returns (level: int, status: str).
        """
        # L0: Draft — at minimum name + barcode
        level = 0

        # L1: Identified — classification complete
        has_classification = bool(
            self.category_id and self.brand_id and self.unit_id
        )
        if has_classification:
            level = 1

        # L2: Priced — has a selling price
        if level >= 1 and (self.selling_price_ttc or 0) > 0:
            level = 2

        # L3: Inventoried — inventory management configured
        if level >= 2 and (self.min_stock_level or 0) > 0:
            level = 3

        # L4: Grouped — belongs to a product group
        if level >= 3 and self.product_group_id:
            level = 4

        # L5/L6: Check related records (packaging, supplier)
        if save_related_check and self.pk:
            # L5: Has packaging
            has_packaging = ProductPackaging.objects.filter(product=self).exists()
            if level >= 4 and has_packaging:
                level = 5

            # L6: Has supplier — check via connector
            try:
                from django.apps import apps
                ProductSupplier = apps.get_model('pos', 'ProductSupplier')
                has_supplier = ProductSupplier.objects.filter(product=self).exists()
            except (LookupError, Exception):
                has_supplier = False

            if level >= 5 and has_supplier:
                level = 6

            # L7: All data complete
            if level >= 6:
                level = 7

        # L8: Manually verified
        if self.is_verified and level >= 7:
            level = 8

        status_str = self.LEVEL_TO_STATUS.get(level, 'DRAFT')
        return level, status_str

    @property
    def is_sellable(self):
        """A product is sellable if it has a selling price, regardless of level."""
        return (self.selling_price_ttc or 0) > 0

    class Meta:
        db_table = 'product'
        constraints = [
            UniqueConstraint(fields=['sku', 'organization'], name='unique_product_sku_per_tenant'),
            UniqueConstraint(fields=['barcode', 'organization'], name='unique_product_barcode_per_tenant', condition=Q(barcode__isnull=False)),
        ]
        indexes = [
            # Gap 10 — Performance Architecture: compound indexes for POS catalog patterns
            models.Index(fields=['organization', 'category', 'is_active'], name='product_tenant_cat_active_idx'),
            models.Index(fields=['organization', 'status'],                name='product_tenant_status_idx'),
            models.Index(fields=['organization', 'min_stock_level'],       name='product_tenant_minstk_idx'),
            models.Index(fields=['organization', 'data_completeness_level'], name='product_completeness_idx'),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        # Auto-compute completeness level (skip related check for new objects)
        level, status_str = self.compute_completeness(save_related_check=not is_new)
        self.data_completeness_level = level
        self.completeness_status = status_str
        super().save(*args, **kwargs)


class ProductAttribute(AuditLogMixin, TenantOwnedModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'product_attribute'
        constraints = [
            models.UniqueConstraint(fields=['name', 'organization'], name='unique_attribute_name_tenant')
        ]

    def __str__(self):
        return self.name


class ProductAttributeValue(AuditLogMixin, TenantOwnedModel):
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'product_attribute_value'
        unique_together = ('attribute', 'value', 'organization')

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"


class ProductVariant(AuditLogMixin, TenantOwnedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    attribute_values = models.ManyToManyField(ProductAttributeValue, related_name='variants')
    selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    selling_price_ttc = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_variant'
        constraints = [
            models.UniqueConstraint(fields=['sku', 'organization'], name='unique_variant_sku_tenant')
        ]


class ComboComponent(AuditLogMixin, TenantOwnedModel):
    combo_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='combo_components')
    component_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='part_of_combos')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    price_override = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'combo_component'
        unique_together = ('combo_product', 'component_product', 'organization')
        ordering = ['sort_order']


class ProductPackaging(AuditLogMixin, TenantOwnedModel):
    """
    First-class packaging object for a product.
    Each packaging level is an independently identifiable, priceable, and
    scannable representation of a product.

    Product = the sellable / stock item itself (always tracked in base units)
    Package = one way that product is packed, identified, priced, and scanned

    Example — Product: Coca Cola
      Level 1: Can 330ml     = 1 piece,   barcode=6001234000000, sell=500, buy=350
      Level 2: Pack of 6     = 6 pieces,  barcode=6001234000001, sell=2800, buy=1900
      Level 3: Carton of 24  = 24 pieces, barcode=6001234000002, sell=10500, buy=7500
    """
    PRICE_MODE_CHOICES = (
        ('FORMULA', 'Formula — auto-calculated from base price × ratio × discount'),
        ('FIXED',   'Fixed — manually set custom_selling_price'),
    )

    # ── Identity ────────────────────────────────────────────────────
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='packaging_levels')
    name = models.CharField(
        max_length=200, null=True, blank=True,
        help_text='Display name for this package, e.g. "Pack of 6", "Carton 24"'
    )
    sku = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Package-level SKU/reference (independent of product SKU)'
    )
    barcode = models.CharField(max_length=100, null=True, blank=True, help_text="Unique barcode for this packaging level")
    image_url = models.CharField(max_length=500, null=True, blank=True, help_text='Package-specific image')

    # ── Unit & Conversion ───────────────────────────────────────────
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='packaging_levels')
    level = models.PositiveIntegerField(default=1, help_text="Hierarchy level (1=first above base, 2=second, etc.)")
    ratio = models.DecimalField(max_digits=15, decimal_places=4, default=1, help_text="How many BASE units this level contains")

    # ── Selling Price ───────────────────────────────────────────────
    custom_selling_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text="Override selling price (TTC) for this level")
    custom_selling_price_ht = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text="Override selling price (HT) for this level")
    price_mode = models.CharField(
        max_length=10, choices=PRICE_MODE_CHOICES, default='FORMULA',
        help_text='FORMULA: auto = base × ratio × (1 - discount%). FIXED: use custom_selling_price.'
    )
    discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
        help_text='Discount percentage vs unit price (e.g. 2.00 = 2% cheaper per unit in this packaging)'
    )

    # ── Purchase Price ──────────────────────────────────────────────
    purchase_price_ht = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Default purchase cost excl. tax for this packaging level'
    )
    purchase_price_ttc = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Default purchase cost incl. tax for this packaging level'
    )

    # ── Dimensions & Weight ─────────────────────────────────────────
    weight_kg = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, help_text='Gross weight in kg')
    length_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    width_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # ── Defaults & Flags ────────────────────────────────────────────
    is_default_purchase = models.BooleanField(
        default=False,
        help_text='Preferred packaging when creating purchase orders'
    )
    is_default_sale = models.BooleanField(
        default=False,
        help_text='Preferred packaging when adding to POS / sales orders'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'product_packaging'
        ordering = ['level']
        constraints = [
            models.UniqueConstraint(fields=['product', 'unit', 'organization'], name='unique_packaging_per_unit'),
            models.UniqueConstraint(fields=['barcode', 'organization'], name='unique_packaging_barcode', condition=Q(barcode__isnull=False)),
            models.UniqueConstraint(fields=['sku', 'organization'], name='unique_packaging_sku', condition=Q(sku__isnull=False)),
        ]

    def save(self, *args, **kwargs):
        """Governance validation before saving."""
        from django.core.exceptions import ValidationError

        # ── Validate ratio (qty in base unit) is positive ──
        if self.ratio is not None and self.ratio <= 0:
            raise ValidationError("Quantity in base units (ratio) must be positive.")

        # ── Auto-compute level from unit depth in tree ──
        if self.unit_id:
            depth = 0
            walker = self.unit
            while walker.base_unit_id:
                depth += 1
                try:
                    walker = Unit.objects.get(id=walker.base_unit_id)
                except Unit.DoesNotExist:
                    break
            self.level = depth

            # Auto-set name from unit if not provided
            if not self.name and self.unit:
                self.name = f"{self.unit.name} (×{self.ratio})"

        # ── Enforce max one default_sale per product ──
        if self.is_default_sale:
            ProductPackaging.objects.filter(
                product=self.product, organization=self.organization,
                is_default_sale=True
            ).exclude(pk=self.pk).update(is_default_sale=False)

        # ── Enforce max one default_purchase per product ──
        if self.is_default_purchase:
            ProductPackaging.objects.filter(
                product=self.product, organization=self.organization,
                is_default_purchase=True
            ).exclude(pk=self.pk).update(is_default_purchase=False)

        super().save(*args, **kwargs)

    # ── Computed Properties ─────────────────────────────────────────

    @property
    def effective_selling_price(self):
        """Calculate the effective selling price based on price_mode."""
        if self.price_mode == 'FIXED' and self.custom_selling_price is not None:
            return self.custom_selling_price
        # FORMULA mode: base_price × ratio × (1 - discount_pct/100)
        base_price = self.product.selling_price_ttc
        if not base_price:
            return Decimal('0.00')
        discount_factor = Decimal('1') - (self.discount_pct / Decimal('100'))
        return (base_price * self.ratio * discount_factor).quantize(Decimal('0.01'))

    @property
    def effective_selling_price_ht(self):
        """HT selling price — fixed override or derived from TTC via product tax rate."""
        if self.price_mode == 'FIXED' and self.custom_selling_price_ht is not None:
            return self.custom_selling_price_ht
        base_ht = self.product.selling_price_ht
        if not base_ht:
            return Decimal('0.00')
        discount_factor = Decimal('1') - (self.discount_pct / Decimal('100'))
        return (base_ht * self.ratio * discount_factor).quantize(Decimal('0.01'))

    @property
    def effective_purchase_price(self):
        """Purchase price for this package. Falls back to product cost × ratio."""
        if self.purchase_price_ht and self.purchase_price_ht > 0:
            return self.purchase_price_ht
        base_cost = self.product.cost_price_ht or self.product.cost_price or Decimal('0.00')
        return (base_cost * self.ratio).quantize(Decimal('0.01'))

    @property
    def unit_selling_price(self):
        """Per-base-unit selling price at this packaging level."""
        if self.ratio and self.ratio > 0:
            return (self.effective_selling_price / self.ratio).quantize(Decimal('0.01'))
        return self.effective_selling_price

    @property
    def display_name(self):
        """Human-readable name: custom name or unit name with ratio."""
        if self.name:
            return self.name
        unit_name = self.unit.name if self.unit else 'Unit'
        return f"{unit_name} (×{self.ratio})"

    @property
    def volume_cm3(self):
        """Volume in cubic centimetres, if dimensions are set."""
        if self.length_cm and self.width_cm and self.height_cm:
            return (self.length_cm * self.width_cm * self.height_cm).quantize(Decimal('0.01'))
        return None

    def __str__(self):
        name = self.name or (self.unit.name if self.unit else 'Unknown')
        return f"{self.product.name} — {name} (×{self.ratio})"

