from .base import (
    Response, action, viewsets
)
from apps.pos.sourcing_models import ProductSupplier, SupplierPriceHistory
from apps.pos.serializers import (
    ProductSupplierSerializer, SupplierPriceHistorySerializer
)

class ProductSupplierViewSet(viewsets.ModelViewSet):
    queryset = ProductSupplier.objects.all()
    serializer_class = ProductSupplierSerializer

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
