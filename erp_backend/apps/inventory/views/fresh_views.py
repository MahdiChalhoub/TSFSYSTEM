"""
Views and serializers for Fresh/Weighted Products and PLM Rollout.
"""
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers

from erp.views_base import TenantModelViewSet
from apps.inventory.models.fresh_models import WeightedProductPolicy, ProductFreshProfile


# ── Serializers ──────────────────────────────────────────────────────

class WeightedProductPolicySerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = WeightedProductPolicy
        fields = [
            'id', 'encoding_mode', 'scale_unit', 'prefix',
            'default_tare_grams', 'require_tare_entry',
            'default_shelf_life_days', 'require_best_before', 'require_use_by',
            'label_template', 'show_price_per_kg', 'show_ingredients', 'show_allergens',
            'organization',
        ]
        read_only_fields = ['organization']


class ProductFreshProfileSerializer(drf_serializers.ModelSerializer):
    product_name = drf_serializers.SerializerMethodField()
    net_weight_grams = drf_serializers.ReadOnlyField()
    estimated_unit_price = drf_serializers.ReadOnlyField()

    class Meta:
        model = ProductFreshProfile
        fields = [
            'id', 'product', 'product_name',
            'typical_weight_grams', 'tare_weight_grams',
            'min_weight_grams', 'max_weight_grams',
            'price_per_kg', 'plu_code',
            'shelf_life_days', 'use_by_days',
            'ingredients', 'allergens', 'storage_instructions', 'origin_country',
            'net_weight_grams', 'estimated_unit_price',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None


# ── ViewSets ─────────────────────────────────────────────────────────

class WeightedProductPolicyViewSet(TenantModelViewSet):
    """CRUD for org-level weighted product policy (singleton)."""
    queryset = WeightedProductPolicy.objects.all()
    serializer_class = WeightedProductPolicySerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        policy, _ = WeightedProductPolicy.objects.get_or_create(
            organization=org,
            defaults={'encoding_mode': 'PRICE_EMBEDDED'}
        )
        return Response(WeightedProductPolicySerializer(policy).data)


class ProductFreshProfileViewSet(TenantModelViewSet):
    """CRUD for per-product fresh/weighted attributes."""
    queryset = ProductFreshProfile.objects.select_related('product').all()
    serializer_class = ProductFreshProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product']

    @action(detail=False, methods=['get'], url_path='for-product/(?P<product_id>[0-9]+)')
    def for_product(self, request, product_id=None):
        """Get or 404 the fresh profile for a specific product."""
        try:
            profile = ProductFreshProfile.objects.get(product_id=product_id)
            return Response(ProductFreshProfileSerializer(profile).data)
        except ProductFreshProfile.DoesNotExist:
            return Response({'detail': 'No fresh profile for this product'}, status=status.HTTP_404_NOT_FOUND)
