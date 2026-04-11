"""
Views for Supplier Package Pricing.
"""
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models

from erp.views_base import TenantModelViewSet
from apps.pos.models.supplier_pricing_models import SupplierPackagePrice
from apps.pos.serializers.supplier_pricing_serializers import SupplierPackagePriceSerializer


class SupplierPackagePriceViewSet(TenantModelViewSet):
    """CRUD for supplier-specific pricing per product+packaging."""
    queryset = SupplierPackagePrice.objects.select_related(
        'product_supplier__supplier', 'product_supplier__product', 'packaging'
    ).all()
    serializer_class = SupplierPackagePriceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product_supplier', 'packaging', 'is_active', 'is_default_purchase_price']
    search_fields = ['supplier_barcode', 'supplier_ref']
    ordering_fields = ['purchase_price_ttc', 'min_qty']

    @action(detail=False, methods=['get'], url_path='for-product/(?P<product_id>[0-9]+)')
    def for_product(self, request, product_id=None):
        """
        Get all supplier prices for a specific product, across all suppliers and packaging.
        Useful for procurement comparison.
        """
        prices = self.get_queryset().filter(
            product_supplier__product_id=product_id,
            is_active=True,
        ).order_by('purchase_price_ttc')
        return Response(SupplierPackagePriceSerializer(prices, many=True).data)

    @action(detail=False, methods=['get'], url_path='best-price/(?P<product_id>[0-9]+)')
    def best_price(self, request, product_id=None):
        """
        Get the best (lowest) active price for a product, optionally filtered by packaging.
        """
        qs = self.get_queryset().filter(
            product_supplier__product_id=product_id,
            is_active=True,
        )
        packaging_id = request.query_params.get('packaging')
        if packaging_id:
            qs = qs.filter(packaging_id=packaging_id)
        else:
            qs = qs.filter(packaging__isnull=True)

        # Filter by validity
        from django.utils import timezone
        today = timezone.now().date()
        qs = qs.filter(
            models.Q(valid_from__isnull=True) | models.Q(valid_from__lte=today),
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gte=today),
        )

        best = qs.order_by('purchase_price_ttc').first()
        if best:
            return Response(SupplierPackagePriceSerializer(best).data)
        return Response({'detail': 'No active price found'}, status=404)
