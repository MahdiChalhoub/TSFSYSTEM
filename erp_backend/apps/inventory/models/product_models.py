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
            models.UniqueConstraint(fields=['code', 'tenant'], name='unique_unit_code_tenant')
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
            models.UniqueConstraint(fields=['name', 'tenant'], name='unique_category_name_tenant')
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
            models.UniqueConstraint(fields=['name', 'tenant'], name='unique_brand_name_tenant')
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
            models.UniqueConstraint(fields=['name', 'tenant'], name='unique_parfum_name_tenant')
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
            settings = ConfigurationService.get_global_settings(self.tenant)
        
        if not tax_ctx:
            # Refactored: Use universal TaxService instead of direct finance imports
            tax_ctx = TaxService.get_engine_context(self.tenant, scope=scope)

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
                    tenant=self.tenant, 
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
            last_pp = PurchaseService.get_last_purchase_price(self.tenant, self)
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
        settings = ConfigurationService.get_global_settings(self.tenant)
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

    class Meta:
        db_table = 'product'
        constraints = [
            UniqueConstraint(fields=['sku', 'tenant'], name='unique_product_sku_per_tenant'),
            UniqueConstraint(fields=['barcode', 'tenant'], name='unique_product_barcode_per_tenant', condition=Q(barcode__isnull=False)),
        ]
        indexes = [
            # Gap 10 — Performance Architecture: compound indexes for POS catalog patterns
            models.Index(fields=['tenant', 'category', 'is_active'], name='product_tenant_cat_active_idx'),
            models.Index(fields=['tenant', 'status'],                name='product_tenant_status_idx'),
            models.Index(fields=['tenant', 'min_stock_level'],       name='product_tenant_minstk_idx'),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class ProductAttribute(AuditLogMixin, TenantOwnedModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'product_attribute'
        constraints = [
            models.UniqueConstraint(fields=['name', 'tenant'], name='unique_attribute_name_tenant')
        ]

    def __str__(self):
        return self.name


class ProductAttributeValue(AuditLogMixin, TenantOwnedModel):
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name='values')
    value = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'product_attribute_value'
        unique_together = ('attribute', 'value', 'tenant')

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
            models.UniqueConstraint(fields=['sku', 'tenant'], name='unique_variant_sku_tenant')
        ]


class ComboComponent(AuditLogMixin, TenantOwnedModel):
    combo_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='combo_components')
    component_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='part_of_combos')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    price_override = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'combo_component'
        unique_together = ('combo_product', 'component_product', 'tenant')
        ordering = ['sort_order']


class ProductPackaging(AuditLogMixin, TenantOwnedModel):
    """
    Multi-level packaging hierarchy for a product.
    Each level maps a higher-level unit (e.g., Carton) to the base product,
    with its own barcode and optional custom selling price.

    Example:
      Level 1: Pack   = 6 pieces,  barcode=6001234000001, price=5500
      Level 2: Carton = 24 pieces, barcode=6001234000002, price=20000
      Level 3: Pallet = 480 pieces, barcode=6001234000003, price=380000
    """
    PRICE_MODE_CHOICES = (
        ('FORMULA', 'Formula — auto-calculated from base price × ratio × discount'),
        ('FIXED',   'Fixed — manually set custom_selling_price'),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='packaging_levels')
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='packaging_levels')
    level = models.PositiveIntegerField(default=1, help_text="Hierarchy level (1=first above base, 2=second, etc.)")
    ratio = models.DecimalField(max_digits=15, decimal_places=4, default=1, help_text="How many BASE units this level contains")
    barcode = models.CharField(max_length=100, null=True, blank=True, help_text="Unique barcode for this packaging level")
    custom_selling_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text="Override selling price for this level")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    # ── Level 2: Formula Pricing ────────────────────────────────────
    price_mode = models.CharField(
        max_length=10, choices=PRICE_MODE_CHOICES, default='FORMULA',
        help_text='FORMULA: auto = base × ratio × (1 - discount%). FIXED: use custom_selling_price.'
    )
    discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
        help_text='Discount percentage vs unit price (e.g. 2.00 = 2% cheaper per unit in this packaging)'
    )

    class Meta:
        db_table = 'product_packaging'
        ordering = ['level']
        constraints = [
            models.UniqueConstraint(fields=['product', 'unit', 'tenant'], name='unique_packaging_per_unit'),
            models.UniqueConstraint(fields=['barcode', 'tenant'], name='unique_packaging_barcode', condition=Q(barcode__isnull=False)),
        ]

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

    def __str__(self):
        unit_name = self.unit.name if self.unit else 'Unknown'
        return f"{self.product.name} - {unit_name} (x{self.ratio})"
