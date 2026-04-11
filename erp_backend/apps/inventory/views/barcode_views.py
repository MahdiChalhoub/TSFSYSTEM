"""
Views for Barcode Governance — policy management, barcode CRUD, generation, lookup.
"""
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views_base import TenantModelViewSet
from apps.inventory.models.barcode_models import BarcodePolicy, ProductBarcode
from apps.inventory.models import Product
from apps.inventory.serializers.barcode_serializers import (
    BarcodePolicySerializer, ProductBarcodeSerializer
)
from apps.inventory.services.barcode_service import BarcodeService


class BarcodePolicyViewSet(TenantModelViewSet):
    """
    CRUD for org-level barcode policy (singleton per org).
    """
    queryset = BarcodePolicy.objects.all()
    serializer_class = BarcodePolicySerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get or create the barcode policy for the current org."""
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        policy, _ = BarcodePolicy.objects.get_or_create(
            organization=org, defaults={'mode': 'HYBRID'}
        )
        return Response(BarcodePolicySerializer(policy).data)


class ProductBarcodeViewSet(TenantModelViewSet):
    """
    CRUD for product barcodes + lookup and generation endpoints.
    """
    queryset = ProductBarcode.objects.select_related(
        'product', 'packaging', 'generated_by'
    ).all()
    serializer_class = ProductBarcodeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product', 'barcode_type', 'source', 'is_active', 'packaging']
    search_fields = ['code', 'product__name', 'product__sku']
    ordering_fields = ['created_at', 'code']

    @action(detail=False, methods=['get'], url_path='lookup/(?P<code>[^/.]+)')
    def lookup(self, request, code=None):
        """
        POS scanner resolution: barcode → product + packaging.
        3-tier: ProductBarcode → Product.barcode → ProductPackaging.barcode
        """
        org = getattr(request, 'organization', None)
        result = BarcodeService.lookup(code, organization=org)
        if result:
            return Response(result)
        return Response(
            {'error': f'Barcode {code} not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """
        Generate a barcode for a product (or packaging) per org policy.
        Body: {product_id, packaging_id?}
        """
        product_id = request.data.get('product_id')
        packaging_id = request.data.get('packaging_id')

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        packaging = None
        if packaging_id:
            from apps.inventory.models import ProductPackaging
            try:
                packaging = ProductPackaging.objects.get(id=packaging_id, product=product)
            except ProductPackaging.DoesNotExist:
                return Response({'error': 'Packaging not found'}, status=status.HTTP_404_NOT_FOUND)

        barcode = BarcodeService.generate(product, packaging=packaging, user=request.user)
        if barcode:
            return Response({'barcode': barcode, 'product_id': product.pk})
        return Response(
            {'error': 'Barcode generation is disabled or duplicate detected'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['post'], url_path='validate')
    def validate_barcode(self, request):
        """
        Validate a barcode string (format, checksum, uniqueness).
        Body: {code, format?}
        """
        code = request.data.get('code', '')
        fmt = request.data.get('format')
        org = getattr(request, 'organization', None)
        result = BarcodeService.validate(code, organization=org, format_hint=fmt)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='change')
    def change_barcode(self, request):
        """
        Governed barcode change: deactivate old, create new, audit, trigger tasks.
        Body: {product_id, old_code, new_code}
        """
        product_id = request.data.get('product_id')
        old_code = request.data.get('old_code', '')
        new_code = request.data.get('new_code', '')

        if not new_code:
            return Response({'error': 'new_code is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        # Validate new code
        org = getattr(request, 'organization', None)
        validation = BarcodeService.validate(new_code, organization=org)
        if not validation['valid']:
            return Response({'error': 'Invalid barcode', 'details': validation['errors']},
                            status=status.HTTP_400_BAD_REQUEST)

        BarcodeService.change_barcode(product, old_code, new_code, user=request.user)
        return Response({'detail': 'Barcode changed', 'new_code': new_code})
