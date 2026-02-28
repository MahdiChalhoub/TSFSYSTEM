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



class StockAdjustmentOrderViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = StockAdjustmentOrder.objects.select_related(
        'warehouse', 'supplier', 'created_by', 'locked_by'
    ).prefetch_related('lines__product', 'lines__warehouse', 'lines__added_by').all()
    serializer_class = StockAdjustmentOrderSerializer
    lifecycle_transaction_type = 'STOCK_ADJUSTMENT'

    def get_queryset(self):
        qs = super().get_queryset()
        lifecycle_status = self.request.query_params.get('status')
        warehouse_id = self.request.query_params.get('warehouse')
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'STOCK_ADJ')
        serializer.save(
            organization=org,
            created_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable (locked/verified)'}, status=400)
            
        product_id = request.data.get('product')
        warehouse_id = request.data.get('warehouse', order.warehouse_id)
        
        # Prevent cross-tenant product injection
        if not Product.objects.filter(id=product_id, organization=order.organization).exists():
            return Response({'error': 'Product not found or access denied'}, status=403)
            
        if warehouse_id and not Warehouse.objects.filter(id=warehouse_id, organization=order.organization).exists():
            return Response({'error': 'Warehouse not found or access denied'}, status=403)
            
        try:
            line = StockAdjustmentLine.objects.create(
                order=order,
                product_id=product_id,
                qty_adjustment=request.data['qty_adjustment'],
                amount_adjustment=request.data.get('amount_adjustment', 0),
                warehouse_id=warehouse_id,
                reason=request.data.get('reason', ''),
                recovered_amount=request.data.get('recovered_amount', 0),
                reflect_transfer_id=request.data.get('reflect_transfer'),
                added_by=request.user,
            )
            self._update_totals(order)
            return Response(StockAdjustmentLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['delete'], url_path='remove_line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable'}, status=400)
        try:
            StockAdjustmentLine.objects.filter(id=line_id, order=order).delete()
            self._update_totals(order)
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_order(self, request, pk=None):
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED' and order.status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)

        try:
            InventoryService.process_adjustment_order(
                organization=order.organization,
                order=order,
                user=request.user
            )
            return Response({'message': f'Posted {order.lines.count()} adjustments successfully.'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        agg = order.lines.aggregate(
            total_qty=Sum('qty_adjustment'),
            total_amt=Sum('amount_adjustment')
        )
        order.total_qty_adjustment = agg['total_qty'] or 0
        order.total_amount_adjustment = agg['total_amt'] or 0
        order.save(update_fields=['total_qty_adjustment', 'total_amount_adjustment'])


class StockTransferOrderViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = StockTransferOrder.objects.select_related(
        'from_warehouse', 'to_warehouse', 'supplier', 'created_by', 'locked_by'
    ).prefetch_related('lines__product', 'lines__from_warehouse', 'lines__to_warehouse', 'lines__added_by').all()
    serializer_class = StockTransferOrderSerializer
    lifecycle_transaction_type = 'STOCK_TRANSFER'

    def get_queryset(self):
        qs = super().get_queryset()
        lifecycle_status = self.request.query_params.get('status')
        from_wh = self.request.query_params.get('from_warehouse')
        to_wh = self.request.query_params.get('to_warehouse')
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)
        if from_wh:
            qs = qs.filter(from_warehouse_id=from_wh)
        if to_wh:
            qs = qs.filter(to_warehouse_id=to_wh)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'STOCK_TRF')
        serializer.save(
            organization=org,
            created_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable (locked/verified)'}, status=400)
            
        product_id = request.data.get('product')
        from_warehouse_id = request.data.get('from_warehouse', order.from_warehouse_id)
        to_warehouse_id = request.data.get('to_warehouse', order.to_warehouse_id)
        
        # Prevent cross-tenant product/warehouse injection
        if not Product.objects.filter(id=product_id, organization=order.organization).exists():
            return Response({'error': 'Product not found or access denied'}, status=403)
            
        if not Warehouse.objects.filter(id__in=[from_warehouse_id, to_warehouse_id], organization=order.organization).count() == 2:
            return Response({'error': 'Source or Destination warehouse not found or access denied'}, status=403)
            
        try:
            line = StockTransferLine.objects.create(
                order=order,
                product_id=product_id,
                qty_transferred=request.data['qty_transferred'],
                from_warehouse_id=from_warehouse_id,
                to_warehouse_id=to_warehouse_id,
                reason=request.data.get('reason', ''),
                recovered_amount=request.data.get('recovered_amount', 0),
                added_by=request.user,
            )
            self._update_totals(order)
            return Response(StockTransferLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['delete'], url_path='remove_line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        order = self.get_object()
        if not order.is_editable:
            return Response({'error': 'Order is not editable'}, status=400)
        try:
            StockTransferLine.objects.filter(id=line_id, order=order).delete()
            self._update_totals(order)
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_order(self, request, pk=None):
        order = self.get_object()
        if order.lifecycle_status != 'CONFIRMED' and order.status != 'CONFIRMED':
            return Response({'error': 'Order must be CONFIRMED before posting'}, status=400)
        if order.is_posted:
            return Response({'error': 'Order already posted'}, status=400)

        try:
            InventoryService.process_transfer_order(
                organization=order.organization,
                order=order,
                user=request.user
            )
            return Response({'message': f'Posted {order.lines.count()} transfers successfully.'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    def _update_totals(self, order):
        agg = order.lines.aggregate(total_qty=Sum('qty_transferred'))
        order.total_qty_transferred = agg['total_qty'] or 0
        order.save(update_fields=['total_qty_transferred'])


class OperationalRequestViewSet(TenantModelViewSet):
    queryset = OperationalRequest.objects.select_related(
        'requested_by', 'approved_by'
    ).prefetch_related('lines__product', 'lines__warehouse').all()
    serializer_class = OperationalRequestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        req_type = self.request.query_params.get('type')
        req_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        if req_type:
            qs = qs.filter(request_type=req_type)
        if req_status:
            qs = qs.filter(status=req_status)
        if priority:
            qs = qs.filter(priority=priority)
        return qs

    def perform_create(self, serializer):
        from apps.finance.models import TransactionSequence
        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)
        ref = TransactionSequence.next_value(org, 'OP_REQ')
        serializer.save(
            organization=org,
            requested_by=self.request.user,
            reference=ref
        )

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        req = self.get_object()
        if req.status not in ('PENDING', 'APPROVED'):
            return Response({'error': 'Cannot add lines to this request'}, status=400)
            
        product_id = request.data.get('product')
        warehouse_id = request.data.get('warehouse')
        
        # Prevent cross-tenant injection
        if not Product.objects.filter(id=product_id, organization=req.organization).exists():
            return Response({'error': 'Product not found or access denied'}, status=403)
            
        if warehouse_id and not Warehouse.objects.filter(id=warehouse_id, organization=req.organization).exists():
            return Response({'error': 'Warehouse not found or access denied'}, status=403)
            
        try:
            line = OperationalRequestLine.objects.create(
                request=req,
                product_id=product_id,
                quantity=request.data['quantity'],
                warehouse_id=warehouse_id,
                reason=request.data.get('reason', ''),
            )
            return Response(OperationalRequestLineSerializer(line).data, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response({'error': 'Only PENDING requests can be approved'}, status=400)
        req.status = 'APPROVED'
        req.approved_by = request.user
        req.approved_at = timezone.now()
        req.save(update_fields=['status', 'approved_by', 'approved_at'])
        return Response(OperationalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response({'error': 'Only PENDING requests can be rejected'}, status=400)
        req.status = 'REJECTED'
        req.rejection_reason = request.data.get('reason', '')
        req.save(update_fields=['status', 'rejection_reason'])
        return Response(OperationalRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        req = self.get_object()
        if req.status != 'APPROVED':
            return Response({'error': 'Only APPROVED requests can be converted'}, status=400)

        from apps.finance.models import TransactionSequence
        organization = req.organization
        lines = req.lines.all()

        if req.request_type == 'STOCK_ADJUSTMENT':
            warehouse_id = request.data.get('warehouse')
            if not warehouse_id and lines.exists():
                warehouse_id = lines.first().warehouse_id
            if not warehouse_id:
                return Response({'error': 'warehouse is required for adjustment orders'}, status=400)

            ref = TransactionSequence.next_value(organization, 'STOCK_ADJ')
            order = StockAdjustmentOrder.objects.create(
                organization=organization,
                reference=ref,
                date=timezone.now().date(),
                warehouse_id=warehouse_id,
                reason=req.description or '',
                created_by=request.user,
            )
            for line in lines:
                StockAdjustmentLine.objects.create(
                    order=order,
                    product=line.product,
                    qty_adjustment=line.quantity,
                    warehouse_id=line.warehouse_id or warehouse_id,
                    reason=line.reason or '',
                    added_by=request.user,
                )
            req.converted_to_type = 'stock_adjustment'
            req.converted_to_id = order.pk

        elif req.request_type == 'STOCK_TRANSFER':
            from_wh = request.data.get('from_warehouse')
            to_wh = request.data.get('to_warehouse')
            if not from_wh or not to_wh:
                return Response({'error': 'from_warehouse and to_warehouse required'}, status=400)

            ref = TransactionSequence.next_value(organization, 'STOCK_TRF')
            order = StockTransferOrder.objects.create(
                organization=organization,
                reference=ref,
                date=timezone.now().date(),
                from_warehouse_id=from_wh,
                to_warehouse_id=to_wh,
                reason=req.description or '',
                created_by=request.user,
            )
            for line in lines:
                StockTransferLine.objects.create(
                    order=order,
                    product=line.product,
                    qty_transferred=line.quantity,
                    from_warehouse_id=from_wh,
                    to_warehouse_id=to_wh,
                    reason=line.reason or '',
                    added_by=request.user,
                )
            req.converted_to_type = 'stock_transfer'
            req.converted_to_id = order.pk

        else:
            return Response({'error': f'Conversion for {req.request_type} not yet supported'}, status=400)

        req.status = 'CONVERTED'
        req.save(update_fields=['status', 'converted_to_type', 'converted_to_id'])
        return Response({
            'message': f'Request converted to {req.converted_to_type} #{req.converted_to_id}',
            'order_id': req.converted_to_id,
            'order_type': req.converted_to_type,
        })
