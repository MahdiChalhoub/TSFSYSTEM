import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.utils import timezone
from django.db.models import Q, Count, Sum
from erp.views import TenantModelViewSet
from .models import (
    SupplierPortalAccess, SupplierProforma, ProformaLine,
    PriceChangeRequest, SupplierNotification, SupplierPortalConfig,
)
from .serializers import (
    SupplierPortalAccessSerializer,
    SupplierProformaSerializer, SupplierProformaListSerializer,
    ProformaLineSerializer,
    PriceChangeRequestSerializer,
    SupplierNotificationSerializer,
    SupplierDashboardSerializer,
    SupplierPOReadSerializer,
    SupplierStockReadSerializer,
    SupplierPortalConfigSerializer,
)
from .permissions import IsSupplierUser, HasSupplierPermission


# =============================================================================
# SUPPLIER-SIDE: Dashboard
# =============================================================================

class SupplierDashboardViewSet(viewsets.ViewSet):
    """Supplier portal dashboard — aggregated metrics."""
    permission_classes = [IsAuthenticated, IsSupplierUser]

    def list(self, request):
        access = request.user.supplier_access
        contact = access.contact
        org = contact.organization

        from apps.pos.purchase_order_models import PurchaseOrder

        pos = PurchaseOrder.objects.filter(organization=org, supplier=contact)
        total_orders = pos.count()
        open_orders = pos.exclude(status__in=['COMPLETED', 'CANCELLED']).count()
        total_business = pos.filter(status='COMPLETED').aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        pending_proformas = SupplierProforma.objects.filter(
            organization=org, supplier=contact,
            status__in=['SUBMITTED', 'UNDER_REVIEW']
        ).count()

        pending_price_requests = PriceChangeRequest.objects.filter(
            organization=org, supplier=contact, status='PENDING'
        ).count()

        unread_notifications = SupplierNotification.objects.filter(
            organization=org, supplier=contact, is_read=False
        ).count()

        data = {
            'total_orders': total_orders,
            'open_orders': open_orders,
            'total_business': total_business,
            'balance': contact.current_balance if hasattr(contact, 'current_balance') else contact.balance,
            'pending_proformas': pending_proformas,
            'pending_price_requests': pending_price_requests,
            'unread_notifications': unread_notifications,
            'products_count': 0,
            'low_stock_count': 0,
        }

        # Product/stock counts if permission granted
        if access.has_permission('VIEW_OWN_STOCK'):
            try:
                from apps.inventory.models import Product
                products = Product.objects.filter(
                    organization=org, supplier=contact
                )
                data['products_count'] = products.count()
                data['low_stock_count'] = products.filter(
                    current_stock__lte=models.F('min_stock_level')
                ).count()
            except Exception:
                pass

        serializer = SupplierDashboardSerializer(data)
        return Response(serializer.data)


# =============================================================================
# SUPPLIER-SIDE: My Orders (read-only PO view)
# =============================================================================

class SupplierOrdersViewSet(viewsets.ViewSet):
    """Supplier sees their POs from the organization (read-only)."""
    permission_classes = [IsAuthenticated, IsSupplierUser, HasSupplierPermission]
    supplier_permission = 'VIEW_OWN_ORDERS'

    def list(self, request):
        access = request.user.supplier_access
        contact = access.contact

        from apps.pos.purchase_order_models import PurchaseOrder

        pos = PurchaseOrder.objects.filter(
            organization=contact.organization, supplier=contact
        ).annotate(line_count=Count('lines')).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            pos = pos.filter(status=status_filter)

        data = []
        for po in pos[:100]:
            data.append({
                'id': po.id,
                'po_number': po.po_number,
                'status': po.status,
                'order_date': po.order_date,
                'expected_date': po.expected_date,
                'total_amount': po.total_amount,
                'currency': po.currency,
                'line_count': po.line_count,
                'created_at': po.created_at,
            })

        serializer = SupplierPOReadSerializer(data, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        access = request.user.supplier_access
        contact = access.contact
        from apps.pos.purchase_order_models import PurchaseOrder
        from apps.pos.purchase_order_serializers import PurchaseOrderSerializer

        try:
            po = PurchaseOrder.objects.prefetch_related('lines__product').get(
                id=pk, organization=contact.organization, supplier=contact
            )
            serializer = PurchaseOrderSerializer(po)
            return Response(serializer.data)
        except PurchaseOrder.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        access = request.user.supplier_access
        contact = access.contact
        from apps.pos.purchase_order_models import PurchaseOrder
        from django.utils import timezone

        try:
            po = PurchaseOrder.objects.get(id=pk, organization=contact.organization, supplier=contact)
            if po.status != 'ORDERED':
                return Response({'error': f'Can only acknowledge ORDERED orders. Current status: {po.status}'}, status=400)
            
            po.status = 'CONFIRMED'
            po.acknowledged_at = timezone.now()
            po.save(update_fields=['status', 'acknowledged_at'])
            return Response({'status': 'confirmed'})
        except PurchaseOrder.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

    @action(detail=True, methods=['post'])
    def dispatch_order(self, request, pk=None):
        access = request.user.supplier_access
        contact = access.contact
        from apps.pos.purchase_order_models import PurchaseOrder
        from django.utils import timezone

        try:
            po = PurchaseOrder.objects.get(id=pk, organization=contact.organization, supplier=contact)
            if po.status not in ['ORDERED', 'CONFIRMED']:
                return Response({'error': 'Order not ready for dispatch.'}, status=400)
            
            tracking_number = request.data.get('tracking_number') or request.data.get('tracking_info', '')
            tracking_url = request.data.get('tracking_url', '')

            po.status = 'IN_TRANSIT'
            po.dispatched_at = timezone.now()
            if tracking_number:
                po.tracking_number = tracking_number
            if tracking_url:
                po.tracking_url = tracking_url
            
            po.save(update_fields=['status', 'dispatched_at', 'tracking_number', 'tracking_url'])
            return Response({'status': 'dispatched', 'tracking_number': tracking_number})
        except PurchaseOrder.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)


# =============================================================================
# SUPPLIER-SIDE: My Stock (permission-gated)
# =============================================================================

class SupplierStockViewSet(viewsets.ViewSet):
    """Supplier views stock levels of their authorized products."""
    permission_classes = [IsAuthenticated, IsSupplierUser, HasSupplierPermission]
    supplier_permission = 'VIEW_OWN_STOCK'

    def list(self, request):
        access = request.user.supplier_access
        contact = access.contact

        try:
            from apps.inventory.models import Product

            products = Product.objects.filter(
                organization=contact.organization, supplier=contact
            ).order_by('name')

            data = []
            for p in products[:200]:
                current_stock = getattr(p, 'current_stock', 0) or 0
                min_stock = getattr(p, 'min_stock_level', 0) or 0
                data.append({
                    'product_id': p.id,
                    'product_name': p.name,
                    'sku': getattr(p, 'sku', '') or '',
                    'current_stock': current_stock,
                    'min_stock': min_stock,
                    'is_low_stock': current_stock <= min_stock if min_stock > 0 else False,
                    'last_restocked': getattr(p, 'updated_at', None),
                })

            serializer = SupplierStockReadSerializer(data, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Supplier stock view error: {e}")
            return Response([], status=200)


# =============================================================================
# SUPPLIER-SIDE: Proforma CRUD
# =============================================================================

class SupplierProformaViewSet(TenantModelViewSet):
    """Supplier creates and manages their own proformas."""
    serializer_class = SupplierProformaSerializer
    permission_classes = [IsAuthenticated, IsSupplierUser, HasSupplierPermission]
    supplier_permission = 'CREATE_PROFORMA'

    def get_queryset(self):
        if not hasattr(self.request.user, 'supplier_access'):
            return SupplierProforma.objects.none()
        contact = self.request.user.supplier_access.contact
        return SupplierProforma.objects.filter(
            organization=contact.organization, supplier=contact
        ).prefetch_related('lines')

    def get_serializer_class(self):
        if self.action == 'list':
            return SupplierProformaListSerializer
        return SupplierProformaSerializer

    def perform_create(self, serializer):
        access = self.request.user.supplier_access
        serializer.save(
            organization=access.contact.organization,
            supplier=access.contact,
            created_by_supplier=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        proforma = self.get_object()
        try:
            proforma.transition_to('SUBMITTED')
            proforma.recalculate_totals()
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response({'status': 'submitted'})

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        proforma = self.get_object()
        if proforma.status not in ('DRAFT', 'NEGOTIATING'):
            return Response({'error': 'Can only add lines to DRAFT or NEGOTIATING proformas'}, status=400)
        serializer = ProformaLineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=proforma.organization, proforma=proforma)
        proforma.recalculate_totals()
        return Response(serializer.data, status=201)


# =============================================================================
# SUPPLIER-SIDE: Price change requests
# =============================================================================

class SupplierPriceChangeViewSet(TenantModelViewSet):
    """Supplier creates and tracks price change requests."""
    serializer_class = PriceChangeRequestSerializer
    permission_classes = [IsAuthenticated, IsSupplierUser, HasSupplierPermission]
    supplier_permission = 'REQUEST_PRICE_CHANGE'

    def get_queryset(self):
        if not hasattr(self.request.user, 'supplier_access'):
            return PriceChangeRequest.objects.none()
        contact = self.request.user.supplier_access.contact
        return PriceChangeRequest.objects.filter(
            organization=contact.organization, supplier=contact
        )

    def perform_create(self, serializer):
        access = self.request.user.supplier_access
        serializer.save(
            organization=access.contact.organization,
            supplier=access.contact,
            requested_by=self.request.user,
        )

    @action(detail=True, methods=['post'])
    def accept_counter(self, request, pk=None):
        """Supplier accepts a counter-proposal."""
        pcr = self.get_object()
        if pcr.status != 'COUNTER':
            return Response({'error': 'No counter-proposal to accept'}, status=400)
        pcr.status = 'ACCEPTED'
        pcr.save(update_fields=['status'])
        return Response({'status': 'accepted', 'final_price': str(pcr.counter_price)})


# =============================================================================
# SUPPLIER-SIDE: Notifications
# =============================================================================

class SupplierNotificationViewSet(viewsets.ModelViewSet):
    """Supplier views and manages their notifications."""
    serializer_class = SupplierNotificationSerializer
    permission_classes = [IsAuthenticated, IsSupplierUser]

    def get_queryset(self):
        if not hasattr(self.request.user, 'supplier_access'):
            return SupplierNotification.objects.none()
        contact = self.request.user.supplier_access.contact
        return SupplierNotification.objects.filter(
            organization=contact.organization, supplier=contact
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_read()
        return Response({'status': 'read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(is_read=False)
        count = qs.update(is_read=True, read_at=timezone.now())
        return Response({'status': 'done', 'marked': count})


# =============================================================================
# ADMIN-SIDE: Proforma line management
# =============================================================================

class ProformaLineViewSet(TenantModelViewSet):
    """Admin management of proforma line items."""
    queryset = ProformaLine.objects.select_related('product').all()
    serializer_class = ProformaLineSerializer
