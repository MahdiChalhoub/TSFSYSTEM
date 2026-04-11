"""
Views for Label Governance and Product Readiness.
"""
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers

from erp.views_base import TenantModelViewSet
from apps.inventory.models.label_models import LabelPolicy, LabelRecord
from apps.inventory.models.readiness_models import ProductReadiness
from apps.inventory.services.label_service import LabelService
from apps.inventory.services.readiness_service import ReadinessService


# ── Serializers (inline to keep Priority 3 compact) ──────────────────

class LabelPolicySerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = LabelPolicy
        fields = [
            'id', 'auto_invalidate_on',
            'require_reprint_after_price_change', 'require_reprint_after_barcode_change',
            'default_shelf_template', 'default_packaging_template', 'default_fresh_template',
            'retention_days', 'organization',
        ]
        read_only_fields = ['organization']


class LabelRecordSerializer(drf_serializers.ModelSerializer):
    product_name = drf_serializers.SerializerMethodField()
    printed_by_name = drf_serializers.SerializerMethodField()

    class Meta:
        model = LabelRecord
        fields = [
            'id', 'product', 'product_name', 'packaging',
            'label_type', 'template_name', 'status', 'reason',
            'printed_name', 'printed_barcode', 'printed_price', 'printed_unit',
            'version', 'printed_at', 'printed_by', 'printed_by_name',
            'invalidated_at', 'invalidated_reason',
            'organization',
        ]
        read_only_fields = ['organization', 'printed_at', 'printed_by', 'version', 'status']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_printed_by_name(self, obj):
        return obj.printed_by.username if obj.printed_by else None


class ProductReadinessSerializer(drf_serializers.ModelSerializer):
    score = drf_serializers.ReadOnlyField()
    status = drf_serializers.ReadOnlyField()
    missing = drf_serializers.ReadOnlyField()

    class Meta:
        model = ProductReadiness
        fields = [
            'id', 'product',
            'is_scan_ready', 'is_label_ready', 'is_shelf_ready',
            'is_purchase_ready', 'is_replenishment_ready', 'is_catalog_ready',
            'score', 'status', 'missing',
            'last_assessed_at', 'last_assessed_by',
            'organization',
        ]
        read_only_fields = ['organization', 'last_assessed_at', 'last_assessed_by']


# ── ViewSets ─────────────────────────────────────────────────────────

class LabelPolicyViewSet(TenantModelViewSet):
    """CRUD for org-level label policy (singleton)."""
    queryset = LabelPolicy.objects.all()
    serializer_class = LabelPolicySerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        policy, _ = LabelPolicy.objects.get_or_create(
            organization=org,
            defaults={'auto_invalidate_on': 'BOTH'}
        )
        return Response(LabelPolicySerializer(policy).data)


class LabelRecordViewSet(TenantModelViewSet):
    """Label print/reprint history. Mostly read-only — prints are created via service."""
    queryset = LabelRecord.objects.select_related('product', 'packaging', 'printed_by').all()
    serializer_class = LabelRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product', 'packaging', 'label_type', 'status', 'reason']
    ordering_fields = ['printed_at', 'version']

    @action(detail=False, methods=['post'], url_path='print')
    def print_label(self, request):
        """
        Print a label for a product (or packaging).
        Body: {product_id, packaging_id?, label_type?, reason?, template?}
        """
        from apps.inventory.models import Product, ProductPackaging

        product_id = request.data.get('product_id')
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        packaging = None
        pkg_id = request.data.get('packaging_id')
        if pkg_id:
            try:
                packaging = ProductPackaging.objects.get(id=pkg_id, product=product)
            except ProductPackaging.DoesNotExist:
                return Response({'error': 'Packaging not found'}, status=status.HTTP_404_NOT_FOUND)

        record = LabelService.print_label(
            product=product,
            packaging=packaging,
            label_type=request.data.get('label_type', 'SHELF'),
            reason=request.data.get('reason', 'MANUAL'),
            user=request.user,
            template=request.data.get('template'),
        )

        # Refresh readiness after label print
        ReadinessService.refresh(product, trigger='label_print')

        return Response(LabelRecordSerializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='invalidate')
    def invalidate(self, request):
        """
        Invalidate all valid labels for a product.
        Body: {product_id, reason?}
        """
        from apps.inventory.models import Product

        product_id = request.data.get('product_id')
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'Manual invalidation')
        count = LabelService.invalidate_labels(product, reason=reason)

        # Refresh readiness after label invalidation
        ReadinessService.refresh(product, trigger='label_invalidation')

        return Response({'detail': f'{count} labels invalidated'})


class ProductReadinessViewSet(TenantModelViewSet):
    """Product operational readiness. Read-only with refresh action."""
    queryset = ProductReadiness.objects.select_related('product').all()
    serializer_class = ProductReadinessSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['is_scan_ready', 'is_label_ready', 'is_shelf_ready',
                        'is_purchase_ready', 'is_replenishment_ready']
    http_method_names = ['get', 'head', 'options']

    @action(detail=False, methods=['post'], url_path='refresh/(?P<product_id>[0-9]+)')
    def refresh(self, request, product_id=None):
        """Recompute readiness for a specific product."""
        from apps.inventory.models import Product
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        readiness = ReadinessService.refresh(product, trigger=request.user.username)
        return Response(ProductReadinessSerializer(readiness).data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Org-wide readiness summary: counts per dimension."""
        qs = self.get_queryset()
        total = qs.count()
        return Response({
            'total': total,
            'scan_ready': qs.filter(is_scan_ready=True).count(),
            'label_ready': qs.filter(is_label_ready=True).count(),
            'shelf_ready': qs.filter(is_shelf_ready=True).count(),
            'purchase_ready': qs.filter(is_purchase_ready=True).count(),
            'replenishment_ready': qs.filter(is_replenishment_ready=True).count(),
            'fully_ready': qs.filter(
                is_scan_ready=True, is_label_ready=True, is_shelf_ready=True,
                is_purchase_ready=True, is_replenishment_ready=True,
            ).count(),
        })
