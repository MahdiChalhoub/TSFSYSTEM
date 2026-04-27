"""
Procurement Request ViewSet
Lifecycle: PENDING → APPROVED → EXECUTED  or  REJECTED / CANCELLED.
Referenced by the PO Intelligence Grid's per-row Transfer ⇄ / Request 📨 actions.
"""
from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status as drf_status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views import TenantModelViewSet
from apps.pos.models.procurement_request_models import ProcurementRequest
from apps.pos.serializers.procurement_request_serializers import ProcurementRequestSerializer


class ProcurementRequestViewSet(TenantModelViewSet):
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            requested_by=self.request.user,
            status='PENDING',
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot approve — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'APPROVED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != 'PENDING':
            return Response(
                {'detail': f'Cannot reject — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'REJECTED'
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.notes = (req.notes or '') + f"\nRejected: {request.data.get('reason', '')}"
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'notes'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Mark approved request as executed — does NOT auto-create the transfer/PO,
        that's the operator's decision. Just flips the lifecycle state."""
        req = self.get_object()
        if req.status != 'APPROVED':
            return Response(
                {'detail': f'Cannot execute — current status is {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'EXECUTED'
        req.save(update_fields=['status'])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=['post'], url_path='convert-to-po')
    def convert_to_po(self, request, pk=None):
        """
        Build a DRAFT PurchaseOrder from this request, link it via source_po,
        flip request to EXECUTED. Only valid for PURCHASE-type, APPROVED requests.
        Returns {po_id, po_url} for the frontend to navigate to.
        """
        from decimal import Decimal as D
        from django.db import transaction
        from apps.pos.models.purchase_order_models import PurchaseOrder, PurchaseOrderLine

        req = self.get_object()
        if req.request_type != 'PURCHASE':
            return Response({'detail': 'Only PURCHASE requests convert to a PO.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if req.status != 'APPROVED':
            return Response({'detail': f'Cannot convert — current status is {req.status}.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if req.source_po_id:
            return Response({'detail': 'Already linked to PO.', 'po_id': req.source_po_id})

        with transaction.atomic():
            unit_price = req.suggested_unit_price or getattr(req.product, 'cost_price_ht', None) or D('0')
            tax_rate = getattr(req.product, 'tva_rate', None) or D('0')
            po = PurchaseOrder.objects.create(
                organization=req.organization,
                supplier=req.supplier,
                supplier_name=getattr(req.supplier, 'name', '') or '',
                status='DRAFT',
                priority=req.priority,
                notes=f"Auto-generated from procurement request #{req.id}.\n{req.reason or ''}".strip(),
            )
            PurchaseOrderLine.objects.create(
                organization=req.organization,
                order=po,
                product=req.product,
                product_name=req.product.name,
                product_sku=req.product.sku,
                quantity=req.quantity,
                unit_price=unit_price,
                discount_percent=D('0'),
                tax_rate=tax_rate,
            )
            req.source_po = po
            req.status = 'EXECUTED'
            req.reviewed_by = request.user
            req.reviewed_at = timezone.now()
            req.save(update_fields=['source_po', 'status', 'reviewed_by', 'reviewed_at'])

        return Response({
            'po_id': po.id,
            'po_url': f'/purchases/purchase-orders/{po.id}',
            **self.get_serializer(req).data,
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        req = self.get_object()
        if req.status in ('EXECUTED', 'CANCELLED'):
            return Response(
                {'detail': f'Already in terminal state {req.status}.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'CANCELLED'
        req.save(update_fields=['status'])
        return Response(self.get_serializer(req).data)

    @action(detail=False, methods=['get'], url_path='suggest-quantity')
    def suggest_quantity(self, request):
        """
        GET /procurement-requests/suggest-quantity/?product_id=N
        Returns the proposed order quantity using the active PurchaseAnalyticsConfig:
            avg_daily_sales × proposed_qty_lead_days × proposed_qty_safety_multiplier
        Avg daily sales is computed from InventoryMovement (type='OUT') over the
        configured sales_avg_period_days window (default 180).
        Falls back to product.reorder_quantity, then min_stock_level × safety, then 1.
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id required'}, status=drf_status.HTTP_400_BAD_REQUEST)
        try:
            product_id = int(product_id)
        except (TypeError, ValueError):
            return Response({'error': 'product_id must be an integer'}, status=drf_status.HTTP_400_BAD_REQUEST)

        try:
            from apps.inventory.models import Product, InventoryMovement
        except ImportError:
            return Response({'suggested_qty': 1, 'source': 'fallback', 'reason': 'inventory module unavailable'})

        org = request.user.organization
        try:
            product = Product.objects.get(id=product_id, organization=org)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=drf_status.HTTP_404_NOT_FOUND)

        try:
            from erp.services import ConfigurationService
            cfg = ConfigurationService.get_setting(org, 'purchase_analytics_config', {}) or {}
        except Exception:
            cfg = {}

        period = int(cfg.get('sales_avg_period_days') or 180)
        lead_days = int(cfg.get('proposed_qty_lead_days') or 14)
        safety = Decimal(str(cfg.get('proposed_qty_safety_multiplier') or '1.5'))

        cutoff = timezone.now() - timedelta(days=period)
        total_out = InventoryMovement.objects.filter(
            product=product, organization=org, type='OUT', created_at__gte=cutoff,
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
        avg_daily = total_out / Decimal(period) if period > 0 else Decimal('0')

        suggested = avg_daily * Decimal(lead_days) * safety
        source = 'formula'
        reason = f'avg_daily ({avg_daily:.4f}) × lead_days ({lead_days}) × safety ({safety})'

        if suggested <= 0:
            reorder = getattr(product, 'reorder_quantity', None)
            if reorder and reorder > 0:
                suggested = Decimal(str(reorder))
                source = 'reorder_quantity'
                reason = 'no recent sales — used product.reorder_quantity'
            else:
                min_stock = getattr(product, 'min_stock_level', None) or 0
                if min_stock and min_stock > 0:
                    suggested = Decimal(str(min_stock)) * safety
                    source = 'min_stock'
                    reason = f'no recent sales — used min_stock ({min_stock}) × safety ({safety})'
                else:
                    suggested = Decimal('1')
                    source = 'fallback'
                    reason = 'no sales history, no thresholds configured'

        from math import ceil
        return Response({
            'product_id': product.id,
            'suggested_qty': int(ceil(float(suggested))),
            'source': source,
            'reason': reason,
            'inputs': {
                'avg_daily_sales': float(avg_daily),
                'sales_avg_period_days': period,
                'proposed_qty_lead_days': lead_days,
                'proposed_qty_safety_multiplier': float(safety),
            },
        })
