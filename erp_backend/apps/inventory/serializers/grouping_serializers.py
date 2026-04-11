"""
Serializers for Product Grouping System.
InventoryGroup: stock aggregation and substitution intelligence.
ProductGroup pricing extensions: pricing modes, margin guards, sync status.
"""
from rest_framework import serializers
from django.db.models import Sum, Count, Avg, F, Q, DecimalField
from django.db.models.functions import Coalesce
from decimal import Decimal
from apps.inventory.models import (
    Product, ProductGroup, Brand,
)
from apps.inventory.models.grouping_models import InventoryGroup, InventoryGroupMember


# ─────────────────────────────────────────────────────────────────────────
# Inventory Group (Stock Intelligence)
# ─────────────────────────────────────────────────────────────────────────

class InventoryGroupMemberSerializer(serializers.ModelSerializer):
    """Member of an inventory group — product with substitution metadata."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    country_name = serializers.SerializerMethodField()
    product_size = serializers.DecimalField(
        source='product.size', max_digits=10, decimal_places=2, read_only=True
    )
    product_size_unit = serializers.CharField(
        source='product.size_unit.code', read_only=True, default=None
    )
    stock_qty = serializers.SerializerMethodField()
    cost_price = serializers.DecimalField(
        source='product.cost_price', max_digits=15, decimal_places=2, read_only=True
    )
    selling_price_ttc = serializers.DecimalField(
        source='product.selling_price_ttc', max_digits=15, decimal_places=2, read_only=True
    )
    margin_pct = serializers.FloatField(source='product.margin_pct', read_only=True)

    class Meta:
        model = InventoryGroupMember
        fields = [
            'id', 'group', 'product', 'product_name', 'product_sku',
            'substitution_role', 'substitution_priority', 'origin_label',
            'country_name', 'product_size', 'product_size_unit',
            'stock_qty', 'cost_price', 'selling_price_ttc', 'margin_pct',
            'notes', 'is_active',
        ]
        read_only_fields = ['id']

    def get_country_name(self, obj):
        p = obj.product
        if p.country_of_origin:
            return p.country_of_origin.name
        if p.country:
            return str(p.country)
        return None

    def get_stock_qty(self, obj):
        from apps.inventory.models import Inventory
        total = Inventory.objects.filter(
            product=obj.product, organization=obj.organization
        ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))
        return total['total']


class InventoryGroupSerializer(serializers.ModelSerializer):
    """Inventory group with aggregated stock intelligence."""
    members = InventoryGroupMemberSerializer(many=True, read_only=True)
    member_count = serializers.IntegerField(read_only=True, default=0)
    total_stock = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, default=Decimal('0')
    )
    country_count = serializers.IntegerField(read_only=True, default=0)
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    low_stock_variants = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = InventoryGroup
        fields = [
            'id', 'name', 'group_type', 'brand', 'brand_name',
            'commercial_size_label', 'description', 'is_active',
            'members', 'member_count', 'total_stock', 'country_count',
            'low_stock_variants',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InventoryGroupListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view (no nested members)."""
    member_count = serializers.IntegerField(read_only=True, default=0)
    total_stock = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, default=Decimal('0')
    )
    country_count = serializers.IntegerField(read_only=True, default=0)
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    low_stock_variants = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = InventoryGroup
        fields = [
            'id', 'name', 'group_type', 'brand', 'brand_name',
            'commercial_size_label', 'is_active',
            'member_count', 'total_stock', 'country_count', 'low_stock_variants',
        ]


# ─────────────────────────────────────────────────────────────────────────
# ProductGroup (Pricing Group) Extended Serializers
# ─────────────────────────────────────────────────────────────────────────

class PricingGroupMemberSerializer(serializers.ModelSerializer):
    """Product as a member of a pricing group — shows sync status."""
    group_sync_status = serializers.CharField(read_only=True)
    group_expected_price = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    pricing_source = serializers.CharField(read_only=True)
    margin_pct = serializers.FloatField(read_only=True)
    cost_price = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'cost_price', 'cost_price_ht',
            'selling_price_ht', 'selling_price_ttc',
            'pricing_source', 'group_sync_status', 'group_expected_price',
            'margin_pct',
        ]


class PricingGroupSerializer(serializers.ModelSerializer):
    """ProductGroup with pricing mode details and member sync status."""
    members = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    broken_count = serializers.SerializerMethodField()
    avg_margin = serializers.SerializerMethodField()
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)

    class Meta:
        model = ProductGroup
        fields = [
            'id', 'name', 'brand', 'brand_name', 'parfum', 'category',
            'description', 'image',
            # Pricing
            'price_sync_enabled', 'base_selling_price_ttc', 'base_selling_price_ht',
            'pricing_mode', 'margin_floor_pct', 'max_discount_pct',
            'rounding_rule', 'price_band_values', 'override_policy',
            'margin_rule_pct', 'last_synced_at',
            'packaging_formula',
            # Computed
            'members', 'member_count', 'broken_count', 'avg_margin',
        ]
        read_only_fields = ['id', 'last_synced_at']

    def get_members(self, obj):
        products = Product.objects.filter(
            product_group=obj, organization=obj.organization
        ).order_by('name')
        return PricingGroupMemberSerializer(products, many=True).data

    def get_member_count(self, obj):
        return Product.objects.filter(
            product_group=obj, organization=obj.organization
        ).count()

    def get_broken_count(self, obj):
        return Product.objects.filter(
            product_group=obj, organization=obj.organization,
            group_sync_status='BROKEN'
        ).count()

    def get_avg_margin(self, obj):
        products = Product.objects.filter(
            product_group=obj, organization=obj.organization,
            selling_price_ht__gt=0
        )
        if not products.exists():
            return 0
        total_margin = sum(p.margin_pct for p in products)
        return round(total_margin / products.count(), 2)


class PricingGroupListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer for pricing groups."""
    member_count = serializers.SerializerMethodField()
    broken_count = serializers.SerializerMethodField()
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)

    class Meta:
        model = ProductGroup
        fields = [
            'id', 'name', 'brand_name', 'pricing_mode',
            'base_selling_price_ttc', 'price_sync_enabled',
            'override_policy', 'last_synced_at',
            'member_count', 'broken_count',
        ]

    def get_member_count(self, obj):
        return Product.objects.filter(
            product_group=obj, organization=obj.organization
        ).count()

    def get_broken_count(self, obj):
        return Product.objects.filter(
            product_group=obj, organization=obj.organization,
            group_sync_status='BROKEN'
        ).count()
