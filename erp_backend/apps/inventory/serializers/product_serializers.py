from rest_framework import serializers
from apps.inventory.models import Product, ProductVariant, ProductAttributeValue, ComboComponent, Inventory
from django.db.models import Sum
from decimal import Decimal

class ProductAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(source='attribute.name', read_only=True)
    
    class Meta:
        model = ProductAttributeValue
        fields = ['id', 'attribute', 'attribute_name', 'value', 'code']


class ProductVariantSerializer(serializers.ModelSerializer):
    attribute_values = ProductAttributeValueSerializer(many=True, read_only=True)
    option_values = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    price = serializers.DecimalField(source='selling_price_ttc', max_digits=15, decimal_places=2, read_only=True)

    class Meta:
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

    def get_name(self, obj):
        attrs = obj.attribute_values.all().select_related('attribute')
        if not attrs: return obj.sku
        return ", ".join([f"{av.attribute.name}: {av.value}" for av in attrs])

    def get_stock_quantity(self, obj):
        return float(Inventory.objects.filter(variant=obj).aggregate(
            total=Sum('quantity'))['total'] or 0)


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
    # ── Gap 3: Reservation-aware stock quantities ──
    on_hand_qty   = serializers.SerializerMethodField()
    reserved_qty  = serializers.SerializerMethodField()
    available_qty = serializers.SerializerMethodField()

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
            # Gap 3 stock fields
            'on_hand_qty', 'reserved_qty', 'available_qty',
        ]
        read_only_fields = ['organization']

    def _resolve_warehouse(self, obj):
        """Resolve warehouse from request query param ?warehouse=<id>."""
        request = self.context.get('request')
        if request:
            wh_id = request.query_params.get('warehouse') or request.query_params.get('site')
            if wh_id:
                try:
                    from apps.inventory.models import Warehouse
                    return Warehouse.objects.filter(
                        id=int(wh_id), organization=obj.organization
                    ).first()
                except (ValueError, TypeError):
                    pass
        return None

    def get_on_hand_qty(self, obj):
        warehouse = self._resolve_warehouse(obj)
        if warehouse:
            inv = Inventory.objects.filter(
                product=obj, warehouse=warehouse, organization=obj.organization
            ).first()
            return float(inv.quantity if inv else Decimal('0'))
        # Fallback: sum across all warehouses
        return float(
            Inventory.objects.filter(product=obj, organization=obj.organization)
            .aggregate(t=Sum('quantity'))['t'] or 0
        )

    def get_reserved_qty(self, obj):
        warehouse = self._resolve_warehouse(obj)
        if not warehouse:
            return 0.0
        try:
            from apps.inventory.services import StockReservationService
            summary = StockReservationService.get_stock_summary(obj, warehouse, obj.organization)
            return float(summary['reserved'])
        except Exception:
            return 0.0

    def get_available_qty(self, obj):
        warehouse = self._resolve_warehouse(obj)
        if not warehouse:
            # No warehouse context — return raw on_hand as best available estimate
            return self.get_on_hand_qty(obj)
        try:
            from apps.inventory.services import StockReservationService
            summary = StockReservationService.get_stock_summary(obj, warehouse, obj.organization)
            return float(summary['available'])
        except Exception:
            return self.get_on_hand_qty(obj)


class ProductCreateSerializer(serializers.ModelSerializer):
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
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    variants = ProductVariantSerializer(many=True, read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'description', 'image_url',
            'selling_price_ttc', 'category_name', 'brand_name',
            'variants', 'status'
        ]


class ComboComponentSerializer(serializers.ModelSerializer):
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


class ProductAnalyticsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    sku = serializers.CharField()
    barcode = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    category_name = serializers.CharField(allow_null=True)
    brand_name = serializers.CharField(allow_null=True)
    unit_code = serializers.CharField(allow_null=True)
    total_stock = serializers.FloatField()
    min_stock_level = serializers.IntegerField()
    cost_price = serializers.FloatField()
    selling_price_ttc = serializers.FloatField()
    avg_daily_sales = serializers.FloatField()
    avg_monthly_sales = serializers.FloatField()
    total_sold_30d = serializers.FloatField()
    total_purchased_30d = serializers.FloatField()
    avg_unit_cost = serializers.FloatField()
    health_score = serializers.IntegerField()
    stock_days_remaining = serializers.FloatField(allow_null=True)
    request_status = serializers.CharField(allow_null=True)
    request_type = serializers.CharField(allow_null=True)
    request_id = serializers.IntegerField(allow_null=True)
    request_priority = serializers.CharField(allow_null=True)
    order_type = serializers.CharField(allow_null=True)
    order_id = serializers.IntegerField(allow_null=True)
    rejection_reason = serializers.CharField(allow_null=True)
