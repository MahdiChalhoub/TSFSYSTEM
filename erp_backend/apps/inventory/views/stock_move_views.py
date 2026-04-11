"""
StockMoveViewSet — Gap 4 (Multi-Warehouse Logic)
================================================
REST API for inter-warehouse transfer management.

Endpoints:
  GET    /inventory/stock-moves/           — list all moves (current org)
  POST   /inventory/stock-moves/           — create a new DRAFT move
  GET    /inventory/stock-moves/{id}/      — detail
  POST   /inventory/stock-moves/{id}/action/ — lifecycle transitions
  GET    /inventory/warehouses/{id}/stock/ — per-product stock across warehouses
"""
from rest_framework import serializers, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.exceptions import ValidationError

from erp.views import TenantModelViewSet
from kernel.lifecycle.viewsets import LifecycleViewSetMixin
from apps.inventory.models import StockMove, StockMoveLine
from apps.inventory.services.warehouse_transfer_service import WarehouseTransferService


# ── Serializers ────────────────────────────────────────────────────────────────

class StockMoveLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model  = StockMoveLine
        fields = ['id', 'product', 'product_name', 'quantity', 'quantity_done', 'unit_cost']


class StockMoveSerializer(serializers.ModelSerializer):
    lines              = StockMoveLineSerializer(many=True, read_only=True)
    from_warehouse_name= serializers.ReadOnlyField(source='from_warehouse.name')
    to_warehouse_name  = serializers.ReadOnlyField(source='to_warehouse.name')
    requested_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = StockMove
        fields = [
            'id', 'ref_code', 'move_type', 'status',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse',   'to_warehouse_name',
            'order', 'notes', 'scheduled_date',
            'dispatched_at', 'received_at',
            'requested_by', 'requested_by_name',
            'lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'ref_code', 'status', 'dispatched_at', 'received_at',
            'requested_by', 'lines', 'created_at', 'updated_at',
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None


from apps.inventory.mixins.branch_scoped import StockMoveBranchScopedMixin


# ── ViewSet ────────────────────────────────────────────────────────────────────

class StockMoveViewSet(StockMoveBranchScopedMixin, LifecycleViewSetMixin, TenantModelViewSet):
    """
    Branch-scoped viewset — validates both source and destination warehouses.
    Registered at router.register(r'stock-moves', StockMoveViewSet, basename='stock-moves').
    """
    queryset         = StockMove.objects.select_related(
        'from_warehouse', 'to_warehouse', 'order', 'requested_by',
        'source_branch', 'dest_branch'
    ).prefetch_related('lines__product').all()
    serializer_class = StockMoveSerializer
    filterset_fields = ['status', 'move_type', 'from_warehouse', 'to_warehouse']
    search_fields    = ['ref_code', 'notes']
    ordering_fields  = ['created_at', 'status', 'scheduled_date']

    def perform_create(self, serializer):
        """Extract lines from request.data and call WarehouseTransferService.create_transfer."""
        lines_data  = self.request.data.get('lines', [])
        org         = self.request.organization
        from_wh     = serializer.validated_data.get('from_warehouse')
        to_wh       = serializer.validated_data.get('to_warehouse')
        move_type   = serializer.validated_data.get('move_type', 'TRANSFER')
        notes       = serializer.validated_data.get('notes', '')
        sched_date  = serializer.validated_data.get('scheduled_date')
        order_obj   = serializer.validated_data.get('order')

        if not lines_data:
            from rest_framework.exceptions import ValidationError as DRFValError
            raise DRFValError({'lines': 'At least one product line is required.'})

        parsed_lines = []
        for l in lines_data:
            parsed_lines.append({
                'product_id': int(l['product']),
                'quantity':   l['quantity'],
            })

        WarehouseTransferService.create_transfer(
            organization=org,
            from_warehouse=from_wh,
            to_warehouse=to_wh,
            lines=parsed_lines,
            move_type=move_type,
            order=order_obj,
            notes=notes,
            scheduled_date=sched_date,
            user=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        move = self.get_object()
        try:
            WarehouseTransferService.submit(move, user=request.user)
            return Response(StockMoveSerializer(move).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def dispatch(self, request, pk=None):
        """Map dispatch to standard 'verify' level 1 in lifecycle logic."""
        move = self.get_object()
        try:
            WarehouseTransferService.dispatch(move, user=request.user)
            return Response(StockMoveSerializer(move).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Map receive to standard 'post' action in lifecycle logic."""
        move = self.get_object()
        qty_override = request.data.get('quantities')
        try:
            WarehouseTransferService.receive(move, user=request.user, quantities=qty_override)
            return Response(StockMoveSerializer(move).data)
        except ValidationError as e:
            return Response({'error': str(e)}, status=http_status.HTTP_400_BAD_REQUEST)


class WarehouseStockView(APIView):
    """
    GET /inventory/warehouses/{id}/stock/?product_id=<int>
    Returns per-warehouse breakdown of stock for a given product.
    """
    def get(self, request, pk=None):
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id is required.'}, status=http_status.HTTP_400_BAD_REQUEST)

        org = request.auth_context.get('organization')
        breakdown = WarehouseTransferService.get_stock_by_warehouse(org, int(product_id))
        return Response({'results': breakdown, 'count': len(breakdown)}, status=http_status.HTTP_200_OK)
