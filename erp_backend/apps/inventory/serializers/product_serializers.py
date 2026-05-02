from rest_framework import serializers
from apps.inventory.models import Product, ProductVariant, ProductAttributeValue, ComboComponent, Inventory, ProductPackaging
from django.db.models import Sum
from decimal import Decimal


# Maps human-readable procurement labels (from
# apps.inventory.services.procurement_status_service) to the canonical
# frontend enum keys in src/lib/procurement-status.ts. Module-level so it's
# defined once and the per-product status loop in get_procurement_status can
# reference it without re-creating the dict on every call.
_PROCUREMENT_LABEL_TO_KEY = {
    # Operational / Procurement requests
    'Requested to Purchase': 'REQUESTED_PURCHASE',
    'Requested to Transfer': 'REQUESTED_TRANSFER',
    'Approved to Purchase':  'REQUESTED_PURCHASE',
    'Approved to Transfer':  'REQUESTED_TRANSFER',
    'Requested · P+T':       'REQUESTED_BOTH',
    'Adjustment Pending':    'REQUESTED',
    'Adjustment Approved':   'REQUESTED',
    # PO lifecycle
    'Pending PO':            'PO_SENT',
    'Pending Approval':      'PO_SENT',
    'PO Approved':           'PO_ACCEPTED',
    'Ordered':               'PO_SENT',
    'In Transit':            'IN_TRANSIT',
    'Partially Received':    'IN_TRANSIT',
    # Terminal states
    'Received':              'NONE',
    'Failed':                'FAILED',
    'PO Rejected':           'FAILED',
    # Stock tiers (no active procurement; baseline state)
    'Available':             'NONE',
    'Out of Stock':          'NONE',
    'Low Stock':             'NONE',
}


class ProductPackagingSerializer(serializers.ModelSerializer):
    """Full serializer for ProductPackaging as a first-class object."""
    display_name = serializers.CharField(read_only=True)
    effective_selling_price = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    effective_selling_price_ht = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    effective_purchase_price = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    unit_selling_price = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    volume_cm3 = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True, allow_null=True)

    class Meta:
        model = ProductPackaging
        fields = [
            'id', 'product', 'name', 'display_name', 'sku', 'barcode', 'image_url',
            'unit', 'unit_name', 'level', 'ratio',
            'custom_selling_price', 'custom_selling_price_ht',
            'price_mode', 'discount_pct',
            'purchase_price_ht', 'purchase_price_ttc',
            'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'volume_cm3',
            'is_default_purchase', 'is_default_sale', 'is_active',
            'effective_selling_price', 'effective_selling_price_ht',
            'effective_purchase_price', 'unit_selling_price',
            'created_at',
        ]
        read_only_fields = ['organization']

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


class ProductLiteSerializer(serializers.ModelSerializer):
    """
    Lightweight product payload for pickers / dropdowns. Drops the
    variants + packaging_levels nested serializers and every
    SerializerMethodField (on_hand_qty, reserved_qty, …) — those each
    issue a separate query per row and turn a 200-row list into ~1200
    queries. Use with ``?lite=1`` on the product viewset.
    """
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)

    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'barcode', 'brand_name', 'category_name', 'is_active']
        read_only_fields = fields


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
    packaging_levels = ProductPackagingSerializer(many=True, read_only=True)
    # ── Gap 3: Reservation-aware stock quantities ──
    on_hand_qty   = serializers.SerializerMethodField()
    reserved_qty  = serializers.SerializerMethodField()
    available_qty = serializers.SerializerMethodField()
    # ── Gap 6: Transfer Tracking Visibility ──
    incoming_transfer_qty = serializers.SerializerMethodField()
    outgoing_transfer_qty = serializers.SerializerMethodField()
    # ── Product Lifecycle Management — computed fields ──
    completeness_label = serializers.SerializerMethodField()
    is_sellable = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()
    # ── Product Grouping — governance fields ──
    product_group_name = serializers.CharField(source='product_group.name', read_only=True, default=None)
    # ── Procurement lifecycle (derived from latest ProcurementRequest) ──
    procurement_status = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'base_name', 'description',
            'product_type', 'variants', 'packaging_levels',
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
            # Product Lifecycle Management — 3 separate dimensions
            'data_completeness_level', 'completeness_label',   # maturity
            'is_sellable',                                      # commercial
            'is_verified', 'verified_at', 'verified_by',        # governance
            'is_complete',
            # Gap 3 stock fields
            'on_hand_qty', 'reserved_qty', 'available_qty',
            # Gap 6 transfer fields
            'incoming_transfer_qty', 'outgoing_transfer_qty',
            # Product Grouping — governance
            'product_group_name', 'pricing_source',
            'group_sync_status', 'group_broken_since', 'group_expected_price',
            # COA Link Fields (Gap 2A.7)
            'revenue_account', 'cogs_account', 'inventory_account',
            # Procurement lifecycle
            'procurement_status',
        ]
        read_only_fields = ['organization', 'data_completeness_level',
                            'completeness_label', 'is_sellable', 'is_complete']

    def get_completeness_label(self, obj):
        return obj.completeness_label

    def get_is_sellable(self, obj):
        return obj.is_sellable

    def get_is_complete(self, obj):
        return obj.is_complete

    def get_procurement_status(self, obj):
        from apps.inventory.services.procurement_status_service import (
            get_procurement_status_batch, get_product_display_status
        )
        # Use request-level cache if available to avoid N+1 in list views.
        # Previously this called get_procurement_status_batch with [obj.id]
        # PER PRODUCT — 3 SQL queries × N products = 300+ queries on a 100-
        # product page. Now: on first call we batch-resolve every product in
        # the parent ListSerializer instance and seed the cache, so we run
        # 3 queries total regardless of page size.
        cache_key = '_procurement_status_cache'
        request = self.context.get('request')

        if request:
            if not hasattr(request, cache_key):
                setattr(request, cache_key, {})

            cache = getattr(request, cache_key)
            if obj.id in cache:
                return cache[obj.id]

            # Pre-warm: gather ids from the parent ListSerializer if we're
            # serializing a queryset (list view). Falls back to single-product
            # batch when called from detail view.
            sibling_ids = [obj.id]
            parent = getattr(self, 'parent', None)
            if parent is not None and hasattr(parent, 'instance'):
                instances = parent.instance
                if instances is not None and hasattr(instances, '__iter__'):
                    sibling_ids = [getattr(p, 'id', None) for p in instances]
                    sibling_ids = [pid for pid in sibling_ids if pid is not None]

            batch_res = get_procurement_status_batch(obj.organization, sibling_ids)

            # Resolve & cache every sibling so the remaining N-1 calls are
            # cache hits. Stock tier inputs (on_hand, in_transit, min_stock)
            # are resolved from each sibling's product instance.
            id_to_product = {}
            if parent is not None and hasattr(parent, 'instance') and parent.instance is not None and hasattr(parent.instance, '__iter__'):
                for p in parent.instance:
                    if getattr(p, 'id', None) is not None:
                        id_to_product[p.id] = p
            id_to_product[obj.id] = obj  # always include current

            for pid, p in id_to_product.items():
                entry = batch_res.get(pid)
                status, _detail = get_product_display_status(
                    entry,
                    float(getattr(p, 'on_hand_qty', 0) or 0),
                    float(getattr(p, 'incoming_transfer_qty', 0) or 0),
                    getattr(p, 'min_stock_level', 0)
                )
                cache[pid] = _PROCUREMENT_LABEL_TO_KEY.get(status, 'NONE')

            return cache.get(obj.id, 'NONE')

        return 'NONE'

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

    def get_incoming_transfer_qty(self, obj):
        warehouse = self._resolve_warehouse(obj)
        from apps.inventory.models import StockMoveLine
        qs = StockMoveLine.objects.filter(
            product=obj,
            organization=obj.organization,
            move__status__in=['PENDING', 'IN_TRANSIT']
        )
        if warehouse:
            qs = qs.filter(move__to_warehouse=warehouse)
        return float(qs.aggregate(t=Sum('quantity'))['t'] or 0)

    def get_outgoing_transfer_qty(self, obj):
        warehouse = self._resolve_warehouse(obj)
        from apps.inventory.models import StockMoveLine
        qs = StockMoveLine.objects.filter(
            product=obj,
            organization=obj.organization,
            move__status__in=['PENDING', 'IN_TRANSIT']
        )
        if warehouse:
            qs = qs.filter(move__from_warehouse=warehouse)
        return float(qs.aggregate(t=Sum('quantity'))['t'] or 0)


class ProductCreateSerializer(serializers.ModelSerializer):
    attribute_value_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True,
        help_text='IDs of ProductAttribute child nodes to assign to this product'
    )

    class Meta:
        model = Product
        fields = [
            'sku', 'barcode', 'name', 'base_name', 'description',
            'product_type',
            'category', 'brand', 'unit', 'country', 'parfum',
            'product_group', 'size', 'size_unit',
            'cost_price', 'cost_price_ht', 'cost_price_ttc',
            'selling_price_ht', 'selling_price_ttc', 'tva_rate',
            'min_stock_level', 'is_expiry_tracked',
            'attribute_value_ids',
            # COA Link Fields (Gap 2A.7)
            'revenue_account', 'cogs_account', 'inventory_account',
        ]
        read_only_fields = ['organization']

    def create(self, validated_data):
        attr_ids = validated_data.pop('attribute_value_ids', [])
        product = super().create(validated_data)
        if attr_ids:
            from apps.inventory.models import ProductAttribute
            valid_attrs = ProductAttribute.objects.filter(
                id__in=attr_ids,
                parent__isnull=False,  # Only child/value nodes
                organization=product.organization,
            )
            product.attribute_values.set(valid_attrs)

            # Auto-generate display name if base_name is set
            if product.base_name:
                generated = product.compute_display_name()
                if generated and generated != product.name:
                    product.name = generated
                    product.save(update_fields=['name'])
        return product


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
