"""
Stock Count Serializers
========================
Serializers for InventorySession and InventorySessionLine.
"""
from rest_framework import serializers
from apps.inventory.models import InventorySession, InventorySessionLine


class InventorySessionLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)
    product_image = serializers.CharField(source='product.image', read_only=True)
    category_name = serializers.SerializerMethodField()
    brand_name = serializers.SerializerMethodField()

    class Meta:
        model = InventorySessionLine
        fields = '__all__'

    def get_category_name(self, obj):
        if obj.product and obj.product.category:
            return obj.product.category.name
        return None

    def get_brand_name(self, obj):
        if obj.product and obj.product.brand:
            return obj.product.brand.name
        return None


class InventorySessionSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()
    counted_count = serializers.SerializerMethodField()
    verified_count = serializers.SerializerMethodField()
    needs_adjustment_count = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InventorySession
        fields = '__all__'
        read_only_fields = ['organization', 'created_by']

    def get_products_count(self, obj):
        return obj.lines.count()

    def get_counted_count(self, obj):
        return obj.lines.filter(physical_qty_person1__isnull=False).count()

    def get_verified_count(self, obj):
        return obj.lines.filter(is_verified=True).count()

    def get_needs_adjustment_count(self, obj):
        return obj.lines.filter(needs_adjustment=True, is_adjusted=False).count()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None


class InventorySessionDetailSerializer(InventorySessionSerializer):
    """Session serializer with nested lines for detail view."""
    lines = InventorySessionLineSerializer(many=True, read_only=True)

    class Meta(InventorySessionSerializer.Meta):
        pass
