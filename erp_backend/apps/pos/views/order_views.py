from .base import (
    TenantModelViewSet
)
from apps.pos.models import Order
from apps.pos.serializers import OrderSerializer

class OrderViewSet(TenantModelViewSet):
    """CRUD for sales/purchase orders."""
    queryset = Order.objects.select_related('contact', 'user', 'site').prefetch_related(
        'lines', 'payments_received', 'payments_made', 'deliveries', 'returns', 'purchase_returns'
    ).all()
    serializer_class = OrderSerializer
    filterset_fields = ['type', 'status', 'contact', 'user']
    search_fields = ['ref_code', 'invoice_number', 'notes']
    ordering_fields = ['created_at', 'total_amount']
