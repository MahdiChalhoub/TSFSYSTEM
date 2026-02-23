"""
Inventory Module Serializers
Enriched with nested relationships and computed fields.
"""
from rest_framework import serializers
from .models import (
    Product, Unit, Category, Brand, Parfum, ProductGroup,
    Warehouse, Inventory, InventoryMovement,
    StockAdjustmentOrder, StockAdjustmentLine,
    StockTransferOrder, StockTransferLine,
    OperationalRequest, OperationalRequestLine,
    ComboComponent, ProductSerial, SerialLog
)
from erp.models import Country, Site


# =============================================================================
# TAXONOMY SERIALIZERS
# =============================================================================

class UnitSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = [
            'id', 'code', 'name', 'short_name', 'type', 
            'conversion_factor', 'base_unit', 'allow_fraction', 
            'needs_balance', 'balance_code_structure', 'product_count',
            'organization'
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()


class CountrySimpleSerializer(serializers.ModelSerializer):
    """Lightweight Country serializer for nesting inside Brand."""
    class Meta:
        model = Country
        fields = ['id', 'code', 'name']


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    brand_count = serializers.SerializerMethodField()
    parfum_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'code', 'short_name', 'parent', 
            'level', 'full_path', 'product_count',
            'brand_count', 'parfum_count', 'organization'
        ]
        read_only_fields = ['organization', 'level', 'full_path']

    def get_product_count(self, obj):
        return obj.products.count()

    def get_brand_count(self, obj):
        return obj.brands.count()

    def get_parfum_count(self, obj):
        return obj.parfums.count()


class CategorySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'code']


# =============================================================================
# BRAND SERIALIZERS
# =============================================================================

class BrandSerializer(serializers.ModelSerializer):
    """List serializer — includes counts and country/category objects."""
    product_count = serializers.SerializerMethodField()
    countries = CountrySimpleSerializer(many=True, read_only=True)
    categories = CategorySimpleSerializer(many=True, read_only=True)

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'product_count',
            'created_at', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()


class BrandDetailSerializer(serializers.ModelSerializer):
    """Detail serializer — includes full nested countries and categories."""
    countries = CountrySimpleSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'product_count', 'created_at', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()


# =============================================================================
# PARFUM (ATTRIBUTE) SERIALIZERS
# =============================================================================

class ParfumSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    categories = CategorySimpleSerializer(many=True, read_only=True)

    class Meta:
        model = Parfum
        fields = [
            'id', 'name', 'short_name',
            'categories',
            'product_count',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()


# =============================================================================
# PRODUCT GROUP SERIALIZER
# =============================================================================

class ProductGroupSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    parfum_name = serializers.CharField(source='parfum.name', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = ProductGroup
        fields = [
            'id', 'name', 'description', 'image',
            'brand', 'parfum', 'category',
            'brand_name', 'parfum_name', 'category_name',
            'product_count', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()


class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    
    class Meta:
        from .models import ProductAttributeValue
        model = ProductAttributeValue
        fields = ['id', 'attribute', 'attribute_name', 'value', 'code']


class ProductVariantSerializer(serializers.ModelSerializer):
    attribute_values = ProductAttributeValueSerializer(many=True, read_only=True)
    option_values = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()

    class Meta:
        from .models import ProductVariant
        model = ProductVariant
        fields = [
            'id', 'sku', 'name', 'price', 'barcode', 'attribute_values', 'option_values',
            'selling_price_ht', 'selling_price_ttc', 'image_url',
            'stock_quantity', 'is_active'
        ]

    def get_option_values(self, obj):
        return {
            av.attribute.name: av.value 
            for av in obj.attribute_values.all().select_related('attribute')
        }

    @property
    def price(self, obj):
        return obj.selling_price_ttc

    name = serializers.SerializerMethodField()
    price = serializers.DecimalField(source='selling_price_ttc', max_digits=15, decimal_places=2, read_only=True)

    def get_name(self, obj):
        attrs = obj.attribute_values.all().select_related('attribute')
        if not attrs: return obj.sku
        return ", ".join([f"{av.attribute.name}: {av.value}" for av in attrs])

    def get_stock_quantity(self, obj):
        from .models import Inventory
        from django.db.models import Sum
        return float(Inventory.objects.filter(variant=obj).aggregate(
            total=Sum('quantity'))['total'] or 0)


# =============================================================================
# PRODUCT SERIALIZERS
# =============================================================================

class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    country_name = serializers.CharField(source='country.name', read_only=True, default=None)
    country_code = serializers.CharField(source='country.code', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    unit_short_name = serializers.CharField(source='unit.short_name', read_only=True, default=None)
    parfum_name = serializers.CharField(source='parfum.name', read_only=True, default=None)
    size_unit_name = serializers.CharField(source='size_unit.short_name', read_only=True, default=None)

    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'description',
            'product_type', 'variants',
            'category', 'brand', 'unit', 'country', 'parfum',
            'product_group', 'size', 'size_unit',
            'brand_name', 'country_name', 'country_code',
            'category_name', 'unit_name', 'unit_short_name',
            'parfum_name', 'size_unit_name',
            'cost_price', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'tva_rate',
            'min_stock_level', 'max_stock_level', 'reorder_point', 'reorder_quantity',
            'is_expiry_tracked', 'tracks_serials',
            'status', 'is_active', 'created_at', 'updated_at',
            'organization',
        ]
        read_only_fields = ['organization']


class ProductCreateSerializer(serializers.ModelSerializer):
    """Used for validation in create_complex — explicit field list."""
    class Meta:
        model = Product
        fields = [
            'sku', 'barcode', 'name', 'description',
            'product_type',
            'category', 'brand', 'unit', 'country', 'parfum',
            'product_group', 'size', 'size_unit',
            'cost_price', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'tva_rate',
            'min_stock_level', 'is_expiry_tracked',
        ]
        read_only_fields = ['organization']


class StorefrontProductSerializer(serializers.ModelSerializer):
    """Secure serializer for public storefront with limited fields."""
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    variants = ProductVariantSerializer(many=True, read_only=True)
    
    class Meta:
        from .models import Product
        model = Product
        fields = [
            'id', 'sku', 'name', 'description', 'image_url',
            'selling_price_ttc', 'category_name', 'brand_name',
            'variants', 'status'
        ]


class ComboComponentSerializer(serializers.ModelSerializer):
    """Serializer for combo/bundle product components."""
    component_name = serializers.CharField(source='component_product.name', read_only=True)
    component_sku = serializers.CharField(source='component_product.sku', read_only=True)
    component_price = serializers.DecimalField(
        source='component_product.selling_price_ttc', max_digits=15, decimal_places=2, read_only=True
    )

    class Meta:
        model = ComboComponent
        fields = [
            'id', 'combo_product', 'component_product',
            'component_name', 'component_sku', 'component_price',
            'quantity', 'price_override', 'sort_order',
            'organization',
        ]
        read_only_fields = ['organization']


# =============================================================================
# WAREHOUSE & INVENTORY SERIALIZERS
# =============================================================================

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source='site.name', read_only=True, default=None)
    inventory_count = serializers.SerializerMethodField()
    site = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Warehouse
        fields = [
            'id', 'site', 'name', 'code', 'type',
            'can_sell', 'is_active',
            'site_name', 'inventory_count',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_inventory_count(self, obj):
        return obj.inventory_set.count()


class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = Inventory
        fields = [
            'id', 'warehouse', 'product', 'quantity',
            'expiry_date', 'batch_number', 'batch',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = InventoryMovement
        fields = [
            'id', 'product', 'warehouse', 'type',
            'quantity', 'reference', 'reason',
            'cost_price', 'cost_price_ht', 'created_at',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']


# =============================================================================
# STOCK ADJUSTMENT ORDER SERIALIZERS
# =============================================================================

class StockAdjustmentLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default=None)
    reflect_transfer_ref = serializers.CharField(
        source='reflect_transfer.reference', read_only=True, default=None
    )

    class Meta:
        model = StockAdjustmentLine
        fields = [
            'id', 'order', 'product', 'product_name',
            'qty_adjustment', 'amount_adjustment',
            'warehouse', 'warehouse_name',
            'reason', 'recovered_amount',
            'reflect_transfer', 'reflect_transfer_ref',
            'added_by', 'added_by_name',
        ]
        read_only_fields = ['order']


class StockAdjustmentOrderSerializer(serializers.ModelSerializer):
    lines = StockAdjustmentLineSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = StockAdjustmentOrder
        fields = [
            'id', 'reference', 'date', 'supplier', 'supplier_name',
            'warehouse', 'warehouse_name', 'reason',
            'total_qty_adjustment', 'total_amount_adjustment',
            'notes', 'is_posted',
            'lifecycle_status', 'locked_by', 'locked_by_name',
            'locked_at', 'current_verification_level',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'lines', 'line_count', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'is_posted',
                            'lifecycle_status', 'locked_by', 'locked_at',
                            'current_verification_level', 'total_qty_adjustment',
                            'total_amount_adjustment']

    def get_line_count(self, obj):
        return obj.lines.count()


# =============================================================================
# STOCK TRANSFER ORDER SERIALIZERS
# =============================================================================

class StockTransferLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True, default=None)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, default=None)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default=None)

    class Meta:
        model = StockTransferLine
        fields = [
            'id', 'order', 'product', 'product_name',
            'qty_transferred',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'reason', 'recovered_amount',
            'added_by', 'added_by_name',
        ]
        read_only_fields = ['order']


class StockTransferOrderSerializer(serializers.ModelSerializer):
    lines = StockTransferLineSerializer(many=True, read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True, default=None)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, default=None)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = StockTransferOrder
        fields = [
            'id', 'reference', 'date',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'driver', 'supplier', 'supplier_name', 'reason',
            'total_qty_transferred', 'is_posted', 'notes',
            'lifecycle_status', 'locked_by', 'locked_by_name',
            'locked_at', 'current_verification_level',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'lines', 'line_count', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'is_posted',
                            'lifecycle_status', 'locked_by', 'locked_at',
                            'current_verification_level', 'total_qty_transferred']

    def get_line_count(self, obj):
        return obj.lines.count()


# =============================================================================
# OPERATIONAL REQUEST SERIALIZERS
# =============================================================================

class OperationalRequestLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = OperationalRequestLine
        fields = [
            'id', 'request', 'product', 'product_name',
            'quantity', 'warehouse', 'warehouse_name', 'reason',
        ]
        read_only_fields = ['request']


class ProductSerialSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = ProductSerial
        fields = '__all__'
        read_only_fields = ['organization']


class SerialLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SerialLog
        fields = '__all__'
        read_only_fields = ['organization']


class OperationalRequestSerializer(serializers.ModelSerializer):
    lines = OperationalRequestLineSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True, default=None)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = OperationalRequest
        fields = [
            'id', 'reference', 'request_type', 'date',
            'requested_by', 'requested_by_name',
            'priority', 'status', 'description',
            'approved_by', 'approved_by_name', 'approved_at',
            'converted_to_type', 'converted_to_id',
            'rejection_reason', 'notes',
            'created_at', 'updated_at',
            'lines', 'line_count', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'approved_by',
                            'approved_at', 'converted_to_type', 'converted_to_id']

    def get_line_count(self, obj):
        return obj.lines.count()


# =============================================================================
# PRODUCT ANALYTICS SERIALIZER
# =============================================================================

class ProductAnalyticsSerializer(serializers.Serializer):
    """Read-only serializer for the product analytics endpoint."""
    id = serializers.IntegerField()
    sku = serializers.CharField()
    barcode = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    category_name = serializers.CharField(allow_null=True)
    brand_name = serializers.CharField(allow_null=True)
    unit_code = serializers.CharField(allow_null=True)

    # Stock
    total_stock = serializers.FloatField()
    min_stock_level = serializers.IntegerField()

    # Pricing
    cost_price = serializers.FloatField()
    selling_price_ttc = serializers.FloatField()

    # Sales metrics
    avg_daily_sales = serializers.FloatField()
    avg_monthly_sales = serializers.FloatField()
    total_sold_30d = serializers.FloatField()

    # Purchase metrics
    total_purchased_30d = serializers.FloatField()
    avg_unit_cost = serializers.FloatField()

    # Health
    health_score = serializers.IntegerField()
    stock_days_remaining = serializers.FloatField(allow_null=True)

    # Request lifecycle
    request_status = serializers.CharField(allow_null=True)
    request_type = serializers.CharField(allow_null=True)
    request_id = serializers.IntegerField(allow_null=True)
    request_priority = serializers.CharField(allow_null=True)
    order_type = serializers.CharField(allow_null=True)
    order_id = serializers.IntegerField(allow_null=True)
    rejection_reason = serializers.CharField(allow_null=True)


# =============================================================================
# STOCK ALERT SERIALIZER
# =============================================================================

from .alert_models import StockAlert


class StockAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    acknowledged_by_name = serializers.SerializerMethodField()
    purchase_order_number = serializers.ReadOnlyField(source='purchase_order.po_number')

    class Meta:
        model = StockAlert
        fields = '__all__'
        read_only_fields = ['organization', 'acknowledged_by', 'acknowledged_at',
                            'resolved_at']

    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by:
            name = f"{obj.acknowledged_by.first_name} {obj.acknowledged_by.last_name}".strip()
            return name or obj.acknowledged_by.username
        return None

