from apps.inventory.models import (
    Inventory,
    InventoryMovement,
    OperationalRequest,
    OperationalRequestLine,
    Product,
    ProductGroup,
    ProductSerial,
    SerialLog,
    StockAdjustmentLine,
    StockAdjustmentOrder,
    StockTransferLine,
    StockTransferOrder,
    Warehouse,
)
from apps.inventory.serializers import (
    InventoryMovementSerializer,
    InventorySerializer,
    OperationalRequestLineSerializer,
    OperationalRequestSerializer,
    ProductGroupSerializer,
    ProductSerialSerializer,
    SerialLogSerializer,
    StockAdjustmentLineSerializer,
    StockAdjustmentOrderSerializer,
    StockTransferLineSerializer,
    StockTransferOrderSerializer,
)
from apps.inventory.services import InventoryService
from .base import (
    F,
    Organization,
    Q,
    Response,
    Sum,
    TenantModelViewSet,
    _get_org_or_400,
    action,
    get_current_tenant_id,
    status,
    timezone,
)
from erp.mixins import UDLEViewSetMixin
from erp.lifecycle_mixin import LifecycleViewSetMixin
from apps.inventory.models import StockAlert, StockAlertService
from apps.inventory.serializers import StockAlertSerializer
from apps.inventory.models import StockAlert, StockAlertService
from apps.inventory.serializers import StockAlertSerializer



class StockAlertViewSet(TenantModelViewSet):
    queryset = StockAlert.objects.select_related(
        'product', 'warehouse', 'acknowledged_by', 'purchase_order'
    ).all()
    serializer_class = StockAlertSerializer
    filterset_fields = ['alert_type', 'severity', 'status', 'product']
    search_fields = ['product__name', 'product__sku', 'message']
    ordering_fields = ['created_at', 'severity', 'current_stock']

    def get_queryset(self):
        qs = super().get_queryset()
        alert_status = self.request.query_params.get('status')
        alert_type = self.request.query_params.get('alert_type')
        severity = self.request.query_params.get('severity')
        if alert_status:
            qs = qs.filter(status=alert_status)
        if alert_type:
            qs = qs.filter(alert_type=alert_type)
        if severity:
            qs = qs.filter(severity=severity)
        return qs

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        if alert.status != 'ACTIVE':
            return Response({'error': 'Only ACTIVE alerts can be acknowledged'}, status=400)
        alert.acknowledge(request.user)
        return Response(StockAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        if alert.status in ('RESOLVED',):
            return Response({'error': 'Alert already resolved'}, status=400)
        alert.resolve(note=request.data.get('note', ''))
        return Response(StockAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        alert = self.get_object()
        until = request.data.get('until')
        if not until:
            return Response({'error': 'until datetime required'}, status=400)
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(until)
        if not dt:
            return Response({'error': 'Invalid datetime format'}, status=400)
        alert.snooze(dt)
        return Response(StockAlertSerializer(alert).data)

    @action(detail=False, methods=['post'], url_path='scan-all')
    def scan_all(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=400)
        org = Organization.objects.get(id=organization_id)
        service = StockAlertService(org)
        alerts = service.scan_all()
        return Response({
            'message': f'Scan complete. {len(alerts)} new alerts created.',
            'new_alerts': StockAlertSerializer(alerts, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=400)

        from django.db.models import Count
        qs = StockAlert.objects.filter(organization_id=organization_id)

        stats = {
            'total': qs.count(),
            'by_status': dict(qs.values_list('status').annotate(c=Count('id')).values_list('status', 'c')),
            'by_type': dict(qs.values_list('alert_type').annotate(c=Count('id')).values_list('alert_type', 'c')),
            'by_severity': dict(qs.values_list('severity').annotate(c=Count('id')).values_list('severity', 'c')),
            'active_critical': qs.filter(status='ACTIVE', severity='CRITICAL').count(),
            'active_warning': qs.filter(status='ACTIVE', severity='WARNING').count(),
        }
        return Response(stats)
