from .base import (
    Response, action, viewsets
)
from apps.pos.models import ProductSupplier, SupplierPriceHistory
from apps.pos.serializers import (
    ProductSupplierSerializer, SupplierPriceHistorySerializer
)
from erp.connector_registry import connector


class ProductSupplierViewSet(viewsets.ModelViewSet):
    queryset = ProductSupplier.objects.all()
    serializer_class = ProductSupplierSerializer

    def _refresh_product(self, instance):
        """Refresh the linked product's completeness level."""
        if instance and instance.product_id:
            try:
                ProductCompletenessService = connector.require(
                    'inventory.services.get_product_completeness_service',
                    org_id=getattr(instance, 'organization_id', 0) or 0,
                )
                if ProductCompletenessService is not None:
                    ProductCompletenessService.refresh(instance.product, save=True)
            except Exception:
                pass  # Non-critical — don't fail supplier ops

    def perform_create(self, serializer):
        instance = serializer.save()
        self._refresh_product(instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._refresh_product(instance)

    def perform_destroy(self, instance):
        product = instance.product  # Capture before delete
        org_id = getattr(instance, 'organization_id', 0) or 0
        instance.delete()
        if product:
            try:
                ProductCompletenessService = connector.require(
                    'inventory.services.get_product_completeness_service',
                    org_id=org_id,
                )
                if ProductCompletenessService is not None:
                    ProductCompletenessService.refresh(product, save=True)
            except Exception:
                pass

    @action(detail=False, methods=['get'], url_path='by-product/(?P<product_id>[^/.]+)')
    def by_product(self, request, product_id=None):
        qs = self.queryset.filter(product_id=product_id)
        return Response(ProductSupplierSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='comparison-dashboard')
    def comparison_dashboard(self, request):
        """Returns summarized sourcing intelligence for the dashboard."""
        from django.db.models import Avg, Min, Max
        stats = self.queryset.values('product__name').annotate(
            supplier_count=Min('id'), # placeholder for count logic if needed
            avg_price=Avg('unit_cost'),
            min_price=Min('unit_cost'),
            max_price=Max('unit_cost'),
        ).order_by('product__name')
        return Response(list(stats))


class SupplierPriceHistoryViewSet(viewsets.ModelViewSet):
    queryset = SupplierPriceHistory.objects.all()
    serializer_class = SupplierPriceHistorySerializer

    @action(detail=False, methods=['get'], url_path='trends/(?P<product_id>[^/.]+)')
    def trends(self, request, product_id=None):
        qs = self.queryset.filter(product_id=product_id).order_by('recorded_at')
        return Response(SupplierPriceHistorySerializer(qs, many=True).data)

