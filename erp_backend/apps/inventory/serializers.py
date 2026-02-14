"""
Inventory Module Serializers
Enriched with nested relationships and computed fields.
"""
from rest_framework import serializers
from .models import (
    Product, Unit, Category, Brand, Parfum, ProductGroup,
    Warehouse, Inventory, InventoryMovement
)
from erp.models import Country


# =============================================================================
# TAXONOMY SERIALIZERS
# =============================================================================

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = '__all__'
        read_only_fields = ['organization']


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
        fields = '__all__'
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.product_set.count() if hasattr(obj, 'product_set') else 0

    def get_brand_count(self, obj):
        return obj.brands.count()

    def get_parfum_count(self, obj):
        return obj.parfums.count()


# =============================================================================
# BRAND SERIALIZERS
# =============================================================================

class BrandSerializer(serializers.ModelSerializer):
    """List serializer — includes counts and country/category names."""
    product_count = serializers.SerializerMethodField()
    country_names = serializers.SerializerMethodField()
    category_names = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            'id', 'name', 'short_name', 'logo',
            'countries', 'categories',
            'product_count', 'country_names', 'category_names',
            'created_at', 'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.products.count()

    def get_country_names(self, obj):
        return list(obj.countries.values_list('name', flat=True))

    def get_category_names(self, obj):
        return list(obj.categories.values_list('name', flat=True))


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
    category_names = serializers.SerializerMethodField()

    class Meta:
        model = Parfum
        fields = [
            'id', 'name', 'short_name',
            'categories',
            'product_count', 'category_names',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_product_count(self, obj):
        return obj.product_set.count() if hasattr(obj, 'product_set') else 0

    def get_category_names(self, obj):
        return list(obj.categories.values_list('name', flat=True))


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
        return obj.product_set.count()


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

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'description',
            'category', 'brand', 'unit', 'country', 'parfum',
            'product_group', 'size', 'size_unit',
            'brand_name', 'country_name', 'country_code',
            'category_name', 'unit_name', 'unit_short_name',
            'parfum_name', 'size_unit_name',
            'cost_price', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'tva_rate',
            'min_stock_level', 'is_expiry_tracked',
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
            'category', 'brand', 'unit', 'country', 'parfum',
            'product_group', 'size', 'size_unit',
            'cost_price', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'tva_rate',
            'min_stock_level', 'is_expiry_tracked',
        ]
        read_only_fields = ['organization']


# =============================================================================
# WAREHOUSE & INVENTORY SERIALIZERS
# =============================================================================

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source='site.name', read_only=True, default=None)
    inventory_count = serializers.SerializerMethodField()

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
