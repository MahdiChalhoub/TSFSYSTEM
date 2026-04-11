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



class ProductSerialViewSet(TenantModelViewSet):
    queryset = ProductSerial.objects.all()
    serializer_class = ProductSerialSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        serial_number = self.request.query_params.get('serial_number')
        if product_id:
            qs = qs.filter(product_id=product_id)
        if serial_number:
            qs = qs.filter(serial_number__icontains=serial_number)
        return qs

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        serial = self.get_object()
        logs = serial.logs.all()
        from apps.inventory.serializers import SerialLogSerializer
        serializer = SerialLogSerializer(logs, many=True)
        return Response(serializer.data)


class SerialLogViewSet(TenantModelViewSet):
    queryset = SerialLog.objects.all()
    serializer_class = SerialLogSerializer
