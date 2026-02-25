from .base import (
    Response, action, timezone, TenantModelViewSet
)
from apps.pos.models import DeliveryZone, DeliveryOrder
from apps.pos.serializers import DeliveryZoneSerializer, DeliveryOrderSerializer

class DeliveryZoneViewSet(TenantModelViewSet):
    """CRUD for delivery zones."""
    queryset = DeliveryZone.objects.all()
    serializer_class = DeliveryZoneSerializer


class DeliveryOrderViewSet(TenantModelViewSet):
    """CRUD for delivery orders + status transitions."""
    queryset = DeliveryOrder.objects.select_related('order', 'zone', 'driver').all()
    serializer_class = DeliveryOrderSerializer

    @action(detail=True, methods=['post'])
    def dispatch(self, request, pk=None):
        """Mark delivery as dispatched / in transit."""
        delivery = self.get_object()
        if delivery.status not in ('PENDING', 'PREPARING'):
            return Response({'error': f'Cannot dispatch from {delivery.status}'}, status=400)
        
        delivery.status = 'IN_TRANSIT'
        delivery.dispatched_at = timezone.now()
        delivery.save(update_fields=['status', 'dispatched_at'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """Mark delivery as completed."""
        delivery = self.get_object()
        if delivery.status != 'IN_TRANSIT':
            return Response({'error': 'Only IN_TRANSIT deliveries can be delivered'}, status=400)
        
        delivery.status = 'DELIVERED'
        delivery.delivered_at = timezone.now()
        delivery.save(update_fields=['status', 'delivered_at'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def fail(self, request, pk=None):
        """Mark delivery as failed."""
        delivery = self.get_object()
        if delivery.status in ('DELIVERED', 'CANCELLED'):
            return Response({'error': 'Cannot fail this delivery'}, status=400)
        delivery.status = 'FAILED'
        delivery.notes = request.data.get('reason', delivery.notes)
        delivery.save(update_fields=['status', 'notes'])
        return Response(DeliveryOrderSerializer(delivery).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a delivery."""
        delivery = self.get_object()
        if delivery.status == 'DELIVERED':
            return Response({'error': 'Cannot cancel delivered orders'}, status=400)
        delivery.status = 'CANCELLED'
        delivery.save(update_fields=['status'])
        return Response(DeliveryOrderSerializer(delivery).data)
