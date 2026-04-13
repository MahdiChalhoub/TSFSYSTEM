from django.db import models
from django.db.models import Q, UniqueConstraint
from decimal import Decimal
from erp.models import Country  # Legacy country table (backward compat)
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
    # Dynamic attributes: which attribute groups are relevant for products in this category
    attributes = models.ManyToManyField(
        'ProductAttribute', blank=True, related_name='categories',
        help_text='Attribute groups relevant for products in this category (e.g. Size, Color, Parfum)'
    )

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
    countries = models.ManyToManyField(Country, blank=True, related_name='brands')  # Legacy
    origin_countries = models.ManyToManyField(
        'reference.Country', blank=True, related_name='origin_brands',
        help_text='Countries of origin for this brand (from ref_countries)'
    )
    categories = models.ManyToManyField(Category, blank=True, related_name='brands')
    # Dynamic attributes: which attribute groups are relevant for this brand's products
    attributes = models.ManyToManyField(
        'ProductAttribute', blank=True, related_name='brands',
        help_text='Attribute groups relevant for this brand (e.g. Parfum, Concentration)'
    )
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

    # ── Level 2: Pricing Modes ──────────────────────────────────────
    PRICING_MODE_CHOICES = (
        ('FIXED', 'Fixed Price — all members sell at same price'),
        ('MARGIN_RULE', 'Margin Rule — cost + fixed margin %'),
        ('CEILING', 'Ceiling — members cannot exceed this price'),
        ('BAND', 'Price Band — snap to allowed price tiers'),
        ('MANUAL', 'Manual Override — manager pushes price to all'),
    )
    pricing_mode = models.CharField(
        max_length=15, choices=PRICING_MODE_CHOICES, default='FIXED',
        help_text='How the group price is applied to members'
    )
    margin_floor_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Minimum allowed margin % — system warns below this'
    )
    max_discount_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Maximum discount allowed for group members'
    )
    ROUNDING_CHOICES = (
        ('NONE', 'No rounding'),
        ('NEAREST_5', 'Round to nearest 5'),
        ('NEAREST_10', 'Round to nearest 10'),
        ('NEAREST_25', 'Round to nearest 25'),
        ('NEAREST_50', 'Round to nearest 50'),
        ('NEAREST_100', 'Round to nearest 100'),
    )
    rounding_rule = models.CharField(
        max_length=15, choices=ROUNDING_CHOICES, default='NONE',
        help_text='How final prices are rounded'
    )
    price_band_values = models.JSONField(
        default=list, blank=True,
        help_text='Allowed price tiers for BAND mode, e.g. [200, 250, 300, 350]'
    )
    OVERRIDE_POLICY_CHOICES = (
        ('INHERIT', 'Members inherit group price, no local override'),
        ('ALLOW_LOCAL', 'Members can override locally'),
        ('LOCK_LOCAL', 'Members locked to group price'),
    )
    override_policy = models.CharField(
        max_length=15, choices=OVERRIDE_POLICY_CHOICES, default='INHERIT',
        help_text='Whether member products can override the group price'
    )
    margin_rule_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='For MARGIN_RULE mode: target margin % applied to each member cost'
    )
    last_synced_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When group prices were last synced to members'
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
        ('BLANK', 'Blank / Internal / Repack'),
        ('FRESH', 'Fresh / Variable Weight'),
    )
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True,
        help_text='LEGACY MIRROR — authoritative barcode lives in ProductBarcode table')
    barcode_source = models.CharField(max_length=10, default='UNKNOWN', choices=(
        ('SUPPLIER', 'Supplier barcode'), ('INTERNAL', 'Internally generated'),
        ('MANUAL', 'Manually entered'), ('UNKNOWN', 'Unknown/legacy'),
    ), help_text='How this barcode was obtained')
    barcode_generated_at = models.DateTimeField(null=True, blank=True,
        help_text='When the barcode was auto-generated (null if supplier/manual)')
    name = models.CharField(max_length=255,
        help_text='Full display name. Can be auto-generated from base_name + brand + shown attributes.')
    base_name = models.CharField(max_length=255, null=True, blank=True,
        help_text='Core product identity without brand or attributes. '
                  'E.g. "Orange Juice", "Premium Rice", "Eau de Parfum". '
                  'Used by the nomenclature engine to generate the full display name.')
    description = models.TextField(null=True, blank=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='STANDARD')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    country = models.ForeignKey(Country, on_delete=models.SET_NULL, null=True, blank=True)  # Legacy
    country_of_origin = models.ForeignKey(
        'reference.Country', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='origin_products',
        help_text='Country of origin/fabrication (from ref_countries sourcing list)'
    )
    parfum = models.ForeignKey(Parfum, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    product_group = models.ForeignKey(ProductGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    size = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='sized_products')
    legacy_id = models.IntegerField(null=True, blank=True)

    # ── Dynamic Attribute System (V2) ────────────────────────────────
    # Product can have MANY attribute values (e.g. Parfum=Floral, Size=100ml)
    attribute_values = models.ManyToManyField(
        'ProductAttribute', blank=True, related_name='products_with_attribute',
        help_text='Dynamic attribute values assigned to this product (leaf nodes from attribute tree)'
    )

    # ── Variant Grouping ─────────────────────────────────────────────
    # Products can be grouped under a parent product as variants.
    # parent_product=null means standalone or parent.
    # parent_product=<id> means this is a variant of that parent.
    parent_product = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='variant_children',
        help_text='Parent product for variant grouping. Null = standalone or is a parent.'
    )
    is_parent = models.BooleanField(
        default=False,
        help_text='True = this product is a variant group parent (not sold directly)'
    )
    image_url = models.CharField(max_length=500, null=True, blank=True)
    catalog_description = models.TextField(null=True, blank=True,
        help_text='Marketing/catalog description for eCommerce and print')
    catalog_ready = models.BooleanField(default=False,
        help_text='Product is approved for catalog/eCommerce display')
    media_count = models.PositiveIntegerField(default=0,
        help_text='Number of media assets (images, videos) attached')
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

    # ── Pricing Source ──────────────────────────────────────────────
    PRICING_SOURCE_CHOICES = (
        ('LOCAL', 'Local — product-level price'),
        ('GROUP', 'Group — inherits from ProductGroup'),
    )
    pricing_source = models.CharField(
        max_length=5, choices=PRICING_SOURCE_CHOICES, default='LOCAL',
        help_text='Whether this product uses its own price or inherits from its group'
    )

    # ── Group Sync Status ──────────────────────────────────────────────
    GROUP_SYNC_STATUS_CHOICES = (
        ('SYNCED', 'Synced with group'),
        ('BROKEN', 'Broken — price differs from group'),
        ('LOCAL_OVERRIDE', 'Local override — intentional'),
        ('PENDING', 'Pending group sync'),
        ('N/A', 'Not in a pricing group'),
    )
    group_sync_status = models.CharField(
        max_length=15, choices=GROUP_SYNC_STATUS_CHOICES, default='N/A',
        help_text='Whether this product price matches its pricing group'
    )
    group_broken_since = models.DateTimeField(
        null=True, blank=True,
        help_text='When the group price divergence was detected'
    )
    group_expected_price = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='What the group expected the price to be'
    )

    # ── Product Lifecycle Management ─────────────────────────────────
    # Data maturity level (0-7). Computed by ProductCompletenessService,
    # NOT in save(). Label derived from COMPLETENESS_LABELS constant.
    COMPLETENESS_LABELS = {
        0: 'Draft', 1: 'Identified', 2: 'Priced', 3: 'Inventoried',
        4: 'Grouped', 5: 'Packaged', 6: 'Sourced', 7: 'Complete',
    }

    data_completeness_level = models.PositiveSmallIntegerField(
        default=0, db_index=True,
        help_text='Data maturity level (0=Draft → 7=Complete). Computed by service, not save().'
    )

    # Governance — separate from data maturity
    is_verified = models.BooleanField(
        default=False,
        help_text='Manually set by controller/manager to mark product as verified'
    )
    verified_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When the product was last verified'
    )
    verified_by = models.ForeignKey(
        'erp.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='verified_products',
        help_text='Controller/manager who verified this product'
    )

    # ── Price Regulation (Compliance Module) ─────────────────────────
    REGULATION_STATUS_CHOICES = (
        ('NOT_REGULATED', 'Not regulated'),
        ('COMPLIANT', 'Compliant'),
        ('VIOLATION', 'Price violates regulation'),
        ('EXEMPT', 'Exempt from regulation'),
    )
    price_regulation = models.ForeignKey(
        'compliance.PriceRegulation', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='products',
        help_text='Active government price regulation for this product'
    )
    regulation_status = models.CharField(
        max_length=15, choices=REGULATION_STATUS_CHOICES,
        default='NOT_REGULATED', db_index=True,
        help_text='Current compliance status with price regulation'
    )
    regulation_violation_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='How much over/under the regulated price (null if compliant)'
    )
    regulation_checked_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Last time compliance was checked for this product'
    )

    # ── GL Account Links (for Auto-Posting) ────────────────────────
    # Optional per-product COA overrides. When set, PostingResolver uses
    # these instead of generic posting rules for this specific product.
    revenue_account = models.ForeignKey(
        'finance.ChartOfAccount', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='products_revenue',
        help_text='Revenue GL account override for this product (Sales postings)'
    )
    cogs_account = models.ForeignKey(
        'finance.ChartOfAccount', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='products_cogs',
        help_text='Cost of Goods Sold GL account override (COGS postings)'
    )
    inventory_account = models.ForeignKey(
        'finance.ChartOfAccount', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='products_inventory',
        help_text='Inventory GL account override (stock valuation)'
    )

    # ── Computed Properties (not stored in DB) ───────────────────────
    @property
    def completeness_label(self):
        """Human-readable label for the current data maturity level."""
        return self.COMPLETENESS_LABELS.get(self.data_completeness_level, 'Draft')

    @property
    def is_sellable(self):
        """A product is sellable if it has a selling price and is active."""
        return (self.selling_price_ttc or 0) > 0 and self.is_active

    @property
    def is_complete(self):
        """Whether all required business data is filled."""
        return self.data_completeness_level >= 7

    def compute_display_name(self):
        """
        Auto-generate product display name using the nomenclature engine.
        Prioritizes the global V3 Naming Rule from organization settings.
        """
        from erp.services import ConfigurationService
        
        # 1. Load the global naming rule
        rule = ConfigurationService.get_setting(self.organization, 'product_naming_rule', {})
        formula = rule.get('v3_formula')
        separator = rule.get('separator', ' ')

        # 2. If no V3 formula, fallback to legacy behavior
        if not formula:
            parts = []
            if self.brand_id:
                try: parts.append(self.brand.name)
                except: pass
            
            base = (self.base_name or '').strip()
            if base: parts.append(base)

            if self.pk:
                try:
                    shown_attrs = self.attribute_values.filter(
                        parent__isnull=False,
                        parent__show_in_name=True,
                    ).select_related('parent').order_by('parent__name_position', 'parent__sort_order')

                    for attr_val in shown_attrs:
                        group = attr_val.parent
                        if group.short_label:
                            parts.append(f"{attr_val.name} {group.short_label}".strip())
                        else:
                            parts.append(attr_val.name)
                except: pass
            return separator.join(parts).strip() or self.name

        # 3. V3 Formula execution
        parts = []
        for slot in formula:
            if not slot.get('enabled'): continue
            
            slot_id = slot.get('id')
            slot_type = slot.get('type', 'static')
            use_short = slot.get('useShortName', slot.get('useShortLabel', False))

            if slot_type == 'static':
                if slot_id == 'brand' and self.brand_id:
                    name = (self.brand.short_name if use_short else self.brand.name) or self.brand.name
                    parts.append(name)
                elif slot_id == 'base_name' and self.base_name:
                    parts.append(self.base_name.strip())
                elif slot_id == 'category' and self.category_id:
                    name = (self.category.short_name if use_short else self.category.name) or self.category.name
                    parts.append(name)
                elif slot_id == 'country' and self.country_id:
                    parts.append(self.country.code if use_short else self.country.name)
            
            elif slot_type == 'attribute':
                try:
                    attr_group_id = int(slot_id.replace('attr_', ''))
                    val = self.attribute_values.filter(parent_id=attr_group_id).first()
                    if val:
                        group = val.parent
                        if use_short and group.short_label:
                            parts.append(f"{val.name} {group.short_label}".strip())
                        else:
                            parts.append(val.name)
                except: pass

        return separator.join(parts).strip() or self.name

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
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class ProductAttribute(AuditLogMixin, TenantOwnedModel):
    """
    Dynamic Attribute Tree — Enterprise V3 (Nomenclature-Aware)
    ────────────────────────────────────────────────────────────
    Works as a TREE (parent/child):

      📂 Volume (parent, is_variant=True, show_in_name=True, name_position=1)
         ├── 30ml
         ├── 50ml
         ├── 100ml
         └── 200ml

      📂 Fragrance Family (parent, is_variant=False, show_in_name=False)
         ├── Floral
         ├── Woody
         └── Oriental

      📂 Flavor (parent, is_variant=False, show_in_name=True, name_position=0)
         ├── Orange
         ├── Apple
         └── Mango

    Root nodes (parent=null) are "attribute groups".
    Child nodes (parent=<id>) are "attribute values".
    Products link to CHILD nodes via attribute_values M2M.
    Categories/Brands link to ROOT nodes to auto-suggest.

    Three orthogonal concerns:
      1. ATTRIBUTE = What defines/classifies the product (Volume, Color, Flavor)
      2. PACKAGING = How the product is packed/purchased/converted (ProductPackaging model)
      3. UNIT = How stock and sales are measured (Unit model via Product.unit FK)

    Nomenclature rules (root groups only):
      show_in_name  → Whether selected values appear in auto-generated product name
      name_position → Ordering in the generated name (0=first after base name)
      short_label   → Abbreviated label used in name (e.g. 'ml' instead of 'Volume')
      is_required   → Whether a value MUST be selected for products in linked categories
      show_by_default → Whether this group appears expanded by default in Add Product
    """
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children',
        help_text='Null = root attribute group. Set = child value.'
    )
    is_variant = models.BooleanField(
        default=False,
        help_text='If True, values of this attribute define separate variant SKUs (e.g. Size). '
                  'If False, values are classification only (e.g. Parfum, Gender).'
    )
    sort_order = models.IntegerField(
        default=0,
        help_text='Display ordering within parent group'
    )
    color_hex = models.CharField(
        max_length=7, null=True, blank=True,
        help_text='Optional color swatch for visual attributes (e.g. #FF0000 for Red)'
    )
    image_url = models.CharField(
        max_length=500, null=True, blank=True,
        help_text='Optional image for this attribute value'
    )

    # ── V3: Nomenclature & Governance (Root Groups Only) ─────────
    show_in_name = models.BooleanField(
        default=False,
        help_text='If True, selected values of this group appear in the auto-generated '
                  'product display name. E.g. Volume=180ml → "Pepsi Orange Juice 180ml". '
                  'Only meaningful on root attribute groups.'
    )
    name_position = models.IntegerField(
        default=99,
        help_text='Position in the generated product name (0=immediately after base name, '
                  '1=second, etc.). Lower = earlier. Only meaningful when show_in_name=True.'
    )
    short_label = models.CharField(
        max_length=30, null=True, blank=True,
        help_text='Abbreviated label for name generation. If set, value is suffixed with '
                  'this label instead of the group name. E.g. short_label="ml" → "180ml" '
                  'instead of "Volume: 180". Null = use raw value name as-is.'
    )
    is_required = models.BooleanField(
        default=False,
        help_text='If True, a value MUST be selected for this attribute when creating '
                  'products in linked categories. Enforcement is on the frontend form.'
    )
    show_by_default = models.BooleanField(
        default=True,
        help_text='If True, this attribute group appears expanded/visible by default '
                  'in the Add/Edit Product form. If False, it is collapsed under "More attributes".'
    )
    requires_barcode = models.BooleanField(
        default=False,
        help_text='Products with this attribute require individual barcodes and stock tracking'
    )

    class Meta:
        db_table = 'product_attribute'
        ordering = ['sort_order', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'parent', 'organization'],
                name='unique_attribute_name_parent_tenant'
            )
        ]

    def __str__(self):
        if self.parent:
            return f"{self.parent.name}: {self.name}"
        return self.name

    @property
    def is_root(self):
        """Is this a root attribute group (not a value)?"""
        return self.parent_id is None

    @property
    def is_value(self):
        """Is this an attribute value (has parent)?"""
        return self.parent_id is not None

    def get_values(self):
        """Get all child values for a root attribute."""
        return self.children.all().order_by('sort_order', 'name')


class ProductAttributeValue(AuditLogMixin, TenantOwnedModel):
    """
    LEGACY — Kept for backward compatibility.
    New code should use ProductAttribute tree (parent/child) directly.
    """
    attribute = models.ForeignKey(ProductAttribute, on_delete=models.CASCADE, related_name='legacy_values')
    value = models.CharField(max_length=100)
    code = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'product_attribute_value'
        unique_together = ('attribute', 'value', 'organization')

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"


class ProductVariant(AuditLogMixin, TenantOwnedModel):
    """
    LEGACY — Kept for backward compatibility.
    New variant system uses Product.parent_product FK (product = variant).
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='legacy_variants')
    sku = models.CharField(max_length=100)
    barcode = models.CharField(max_length=100, null=True, blank=True)
    attribute_values = models.ManyToManyField(ProductAttributeValue, related_name='legacy_variant_links')
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
    barcode = models.CharField(max_length=100, null=True, blank=True,
        help_text='LEGACY MIRROR — authoritative barcode lives in ProductBarcode table')
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

    # ── Packaging Governance ────────────────────────────────────────
    is_verified = models.BooleanField(default=False,
        help_text='Package-level verification (independent of product verification)')
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        'erp.User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='verified_packages',
    )
    label_printed_at = models.DateTimeField(null=True, blank=True,
        help_text='Last time a label was printed for this packaging')
    label_version = models.PositiveIntegerField(default=0,
        help_text='Label version counter — increments on each reprint')

    @property
    def is_scan_ready(self):
        """Has barcode and is active."""
        return bool(self.barcode) and self.is_active

    @property
    def is_label_ready(self):
        """Has barcode + name + price → ready for label printing."""
        return bool(self.barcode and self.name and self.get_selling_price() > 0)

    @property
    def readiness_status(self):
        """Returns READY / PARTIAL / INCOMPLETE."""
        checks = [self.name, self.barcode, self.get_selling_price() > 0]
        filled = sum(bool(c) for c in checks)
        if filled == len(checks): return 'READY'
        if filled > 0: return 'PARTIAL'
        return 'INCOMPLETE'

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

