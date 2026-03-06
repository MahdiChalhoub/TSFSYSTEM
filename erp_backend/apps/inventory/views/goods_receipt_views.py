"""
GoodsReceipt Views — ViewSet + Serializers
==========================================
Provides REST API for the Purchase Receiving Screen.

Endpoints:
  GET    /goods-receipts/              — List sessions
  POST   /goods-receipts/              — Create new session
  GET    /goods-receipts/{id}/         — Session detail with lines
  POST   /goods-receipts/{id}/add_line/      — Add product to session
  POST   /goods-receipts/{id}/receive_line/  — Accept a line
  POST   /goods-receipts/{id}/reject_line/   — Reject a line
  POST   /goods-receipts/{id}/finalize/      — Complete and post to stock
  GET    /goods-receipts/{id}/decision_preview/ — Compute metrics without saving
"""
from decimal import Decimal
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.core.exceptions import ValidationError

from erp.views_base import TenantModelViewSet
from apps.inventory.models import GoodsReceipt, GoodsReceiptLine, Product
from apps.inventory.services.goods_receipt_service import GoodsReceiptService


# ═══════════════════════════════════════════════════════════════════════════
# SERIALIZERS
# ═══════════════════════════════════════════════════════════════════════════

class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True, default='')
    product_sku = serializers.CharField(source='product.sku', read_only=True, default='')

    class Meta:
        model = GoodsReceiptLine
        fields = [
            'id', 'product', 'product_name', 'product_barcode', 'product_sku',
            'po_line', 'qty_ordered', 'qty_received', 'qty_rejected',
            'expiry_date', 'batch_number',
            'line_status', 'rejection_reason', 'rejection_notes',
            'is_unexpected', 'approval_status', 'transfer_requirement',
            # Decision engine outputs
            'stock_on_location', 'total_stock', 'avg_daily_sales',
            'remaining_shelf_life_days', 'safe_qty', 'safe_qty_after_receipt',
            'receipt_coverage_pct', 'sales_performance_score', 'adjustment_risk_score',
            'recommended_action', 'decision_warnings',
            'evidence_attachment',
            'processed_by', 'processed_at', 'created_at',
        ]
        read_only_fields = [
            'product_name', 'product_barcode', 'product_sku',
            'stock_on_location', 'total_stock', 'avg_daily_sales',
            'remaining_shelf_life_days', 'safe_qty', 'safe_qty_after_receipt',
            'receipt_coverage_pct', 'sales_performance_score', 'adjustment_risk_score',
            'recommended_action', 'decision_warnings',
            'processed_by', 'processed_at', 'created_at',
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    supplier_name = serializers.SerializerMethodField()
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True, default=None)
    line_count = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = [
            'id', 'receipt_number', 'mode', 'status',
            'purchase_order', 'po_number',
            'warehouse', 'warehouse_name',
            'supplier', 'supplier_name',
            'received_by', 'supplier_ref', 'notes',
            'started_at', 'completed_at', 'created_at', 'updated_at',
            'lines', 'line_count',
        ]
        read_only_fields = [
            'receipt_number', 'started_at', 'completed_at', 'created_at', 'updated_at',
            'lines', 'line_count', 'warehouse_name', 'supplier_name', 'po_number',
        ]

    def get_supplier_name(self, obj):
        if obj.supplier:
            return str(obj.supplier)
        if obj.purchase_order and obj.purchase_order.supplier:
            return str(obj.purchase_order.supplier)
        return None


class GoodsReceiptCreateSerializer(serializers.Serializer):
    """Simplified serializer for creating a new receiving session."""
    mode = serializers.ChoiceField(choices=['DIRECT', 'PO_BASED'])
    warehouse_id = serializers.IntegerField()
    purchase_order_id = serializers.IntegerField(required=False, allow_null=True)
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    supplier_ref = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class AddLineSerializer(serializers.Serializer):
    """Serializer for adding a product line to a session."""
    product_id = serializers.IntegerField()
    qty_received = serializers.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    qty_rejected = serializers.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    expiry_date = serializers.DateField(required=False, allow_null=True)
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')
    po_line_id = serializers.IntegerField(required=False, allow_null=True)


class ReceiveLineSerializer(serializers.Serializer):
    """Serializer for receiving a specific line."""
    line_id = serializers.IntegerField()
    qty_received = serializers.DecimalField(max_digits=15, decimal_places=2)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')


class RejectLineSerializer(serializers.Serializer):
    """Serializer for rejecting a specific line."""
    line_id = serializers.IntegerField()
    qty_rejected = serializers.DecimalField(max_digits=15, decimal_places=2)
    rejection_reason = serializers.ChoiceField(choices=[
        'DAMAGED', 'EXPIRED', 'SHORT_SHELF_LIFE', 'QUALITY_ISSUE',
        'NOT_ORDERED', 'WRONG_PRODUCT', 'OTHER'
    ])
    rejection_notes = serializers.CharField(required=False, allow_blank=True, default='')
    evidence_attachment = serializers.URLField(required=False, allow_blank=True, default='')


class DecisionPreviewSerializer(serializers.Serializer):
    """Serializer for decision preview request."""
    product_id = serializers.IntegerField()
    qty_received = serializers.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    expiry_date = serializers.DateField(required=False, allow_null=True)


# ═══════════════════════════════════════════════════════════════════════════
# VIEWSET
# ═══════════════════════════════════════════════════════════════════════════

class GoodsReceiptViewSet(TenantModelViewSet):
    """
    ViewSet for Goods Receipt (Purchase Receiving Screen).
    Provides CRUD + custom actions for the receiving workflow.
    """
    serializer_class = GoodsReceiptSerializer
    queryset = GoodsReceipt.objects.all()

    def get_queryset(self):
        qs = super().get_queryset().select_related(
            'warehouse', 'supplier', 'purchase_order', 'received_by'
        ).prefetch_related('lines', 'lines__product')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        mode_filter = self.request.query_params.get('mode')
        if mode_filter:
            qs = qs.filter(mode=mode_filter)

        return qs

    def perform_create(self, serializer):
        """Override to use GoodsReceiptCreateSerializer for creation."""
        pass  # Creation is handled by start_session action

    # ── Custom Actions ──────────────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='start-session')
    def start_session(self, request):
        """Create a new receiving session (DRAFT)."""
        ser = GoodsReceiptCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        from apps.inventory.models import Warehouse
        try:
            warehouse = Warehouse.objects.get(
                id=data['warehouse_id'],
                organization=request.user.organization
            )
        except Warehouse.DoesNotExist:
            return Response({'error': 'Warehouse not found'}, status=status.HTTP_400_BAD_REQUEST)

        receipt = GoodsReceipt(
            tenant=request.user.organization,
            mode=data['mode'],
            status='IN_PROGRESS',
            warehouse=warehouse,
            received_by=request.user,
            supplier_ref=data.get('supplier_ref', ''),
            notes=data.get('notes', ''),
        )

        # Mode B — link PO
        if data['mode'] == 'PO_BASED' and data.get('purchase_order_id'):
            from apps.pos.models import PurchaseOrder
            try:
                po = PurchaseOrder.objects.get(
                    id=data['purchase_order_id'],
                    organization=request.user.organization,
                )
                receipt.purchase_order = po
                receipt.supplier = po.supplier
            except PurchaseOrder.DoesNotExist:
                return Response({'error': 'Purchase Order not found'}, status=status.HTTP_400_BAD_REQUEST)
        elif data.get('supplier_id'):
            from apps.crm.models import Contact
            try:
                receipt.supplier = Contact.objects.get(
                    id=data['supplier_id'],
                    organization=request.user.organization,
                )
            except Contact.DoesNotExist:
                pass

        receipt.save()

        # Mode B — auto-populate pending lines from PO
        if receipt.mode == 'PO_BASED' and receipt.purchase_order:
            for po_line in receipt.purchase_order.lines.all():
                remaining = po_line.quantity - po_line.qty_received
                if remaining > 0:
                    GoodsReceiptLine.objects.create(
                        tenant=request.user.organization,
                        receipt=receipt,
                        product=po_line.product,
                        po_line=po_line,
                        qty_ordered=remaining,
                        line_status='PENDING',
                    )

        return Response(
            GoodsReceiptSerializer(receipt).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a product line to the session and compute decision metrics."""
        receipt = self.get_object()

        if receipt.status not in ('DRAFT', 'IN_PROGRESS'):
            return Response(
                {'error': 'Cannot add lines to a completed/cancelled session'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ser = AddLineSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            product = Product.objects.get(
                id=data['product_id'],
                organization=request.user.organization,
            )
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if item is unexpected (Mode B — not on PO)
        is_unexpected = False
        po_line = None
        if receipt.mode == 'PO_BASED' and receipt.purchase_order:
            if data.get('po_line_id'):
                from apps.pos.models import PurchaseOrderLine
                try:
                    po_line = PurchaseOrderLine.objects.get(id=data['po_line_id'])
                except PurchaseOrderLine.DoesNotExist:
                    pass

            if not po_line:
                # Check if product is on PO at all
                from apps.pos.models import PurchaseOrderLine
                po_line = PurchaseOrderLine.objects.filter(
                    order=receipt.purchase_order,
                    product=product,
                ).first()

            if not po_line:
                is_unexpected = True

        line = GoodsReceiptLine.objects.create(
            tenant=request.user.organization,
            receipt=receipt,
            product=product,
            po_line=po_line,
            qty_ordered=po_line.quantity if po_line else Decimal('0.00'),
            qty_received=data.get('qty_received', Decimal('0.00')),
            qty_rejected=data.get('qty_rejected', Decimal('0.00')),
            expiry_date=data.get('expiry_date'),
            batch_number=data.get('batch_number', ''),
            is_unexpected=is_unexpected,
            line_status='SCANNED',
        )

        # Run decision engine
        GoodsReceiptService.compute_and_apply(line)

        return Response(
            GoodsReceiptLineSerializer(line).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='receive-line')
    def receive_line(self, request, pk=None):
        """Accept a line — set as RECEIVED."""
        receipt = self.get_object()
        ser = ReceiveLineSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            line = receipt.lines.get(id=data['line_id'])
        except GoodsReceiptLine.DoesNotExist:
            return Response({'error': 'Line not found'}, status=status.HTTP_404_NOT_FOUND)

        line.qty_received = data['qty_received']
        if data.get('expiry_date'):
            line.expiry_date = data['expiry_date']
        if data.get('batch_number'):
            line.batch_number = data['batch_number']

        # Determine status
        if line.qty_ordered > 0 and line.qty_received < line.qty_ordered:
            line.line_status = 'PARTIALLY_RECEIVED'
        else:
            line.line_status = 'RECEIVED'

        line.processed_by = request.user
        line.processed_at = timezone.now()
        line.save()

        # Recompute decision metrics
        GoodsReceiptService.compute_and_apply(line)

        return Response(GoodsReceiptLineSerializer(line).data)

    @action(detail=True, methods=['post'], url_path='reject-line')
    def reject_line(self, request, pk=None):
        """Reject a line with reason."""
        receipt = self.get_object()
        ser = RejectLineSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            line = receipt.lines.get(id=data['line_id'])
        except GoodsReceiptLine.DoesNotExist:
            return Response({'error': 'Line not found'}, status=status.HTTP_404_NOT_FOUND)

        line.qty_rejected = data['qty_rejected']
        line.rejection_reason = data['rejection_reason']
        line.rejection_notes = data.get('rejection_notes', '')
        line.evidence_attachment = data.get('evidence_attachment', '')
        line.line_status = 'REJECTED'
        line.processed_by = request.user
        line.processed_at = timezone.now()
        line.save()

        return Response(GoodsReceiptLineSerializer(line).data)

    @action(detail=True, methods=['post'], url_path='finalize')
    def finalize(self, request, pk=None):
        """Complete the receiving session — post to inventory."""
        receipt = self.get_object()

        if receipt.status in ('CLOSED', 'CANCELLED'):
            return Response(
                {'error': 'Session already closed or cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            updated = GoodsReceiptService.finalize_receipt(receipt, user=request.user)
            return Response(GoodsReceiptSerializer(updated).data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='decision-preview')
    def decision_preview(self, request, pk=None):
        """
        Preview decision metrics for a product without saving.
        Useful for the popup before committing.
        """
        receipt = self.get_object()
        ser = DecisionPreviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            product = Product.objects.get(
                id=data['product_id'],
                organization=request.user.organization,
            )
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        metrics = GoodsReceiptService.compute_decision_metrics(
            product=product,
            warehouse=receipt.warehouse,
            qty_received=data.get('qty_received', Decimal('0.00')),
            expiry_date=data.get('expiry_date'),
        )

        # Evaluate rules with a lightweight dict
        is_unexpected = False
        if receipt.mode == 'PO_BASED' and receipt.purchase_order:
            from apps.pos.models import PurchaseOrderLine
            is_unexpected = not PurchaseOrderLine.objects.filter(
                order=receipt.purchase_order, product=product
            ).exists()

        rules = GoodsReceiptService.evaluate_rules(
            line={'product': product, 'product_id': product.id,
                  'expiry_date': data.get('expiry_date'),
                  'is_unexpected': is_unexpected},
            metrics=metrics,
            warehouse=receipt.warehouse,
        )

        return Response({
            'product_id': product.id,
            'product_name': product.name,
            **{k: str(v) if isinstance(v, Decimal) else v for k, v in metrics.items()},
            **rules,
        })
