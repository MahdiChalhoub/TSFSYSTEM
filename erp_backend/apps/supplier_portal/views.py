"""
Supplier Portal — ViewSets
==========================
Admin-side ViewSets for managing supplier access, proformas, and price requests.
Supplier-side ViewSets for portal dashboard, orders, stock, and proforma creation.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q, Count, Sum

from erp.views import TenantModelViewSet
from .models import (
    SupplierPortalAccess, SupplierProforma, ProformaLine,
    PriceChangeRequest, SupplierNotification,
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
)
from .permissions import IsSupplierUser, HasSupplierPermission

logger = logging.getLogger(__name__)


# =============================================================================
# ADMIN-SIDE: Manage supplier portal access
# =============================================================================

class SupplierPortalAccessViewSet(TenantModelViewSet):
    """Admin management of supplier portal access grants."""
    queryset = SupplierPortalAccess.objects.select_related('contact', 'user', 'granted_by').all()
    serializer_class = SupplierPortalAccessSerializer

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        access = self.get_object()
        access.status = 'ACTIVE'
        access.save(update_fields=['status'])
        return Response({'status': 'activated'})

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        access = self.get_object()
        access.status = 'SUSPENDED'
        access.save(update_fields=['status'])
        return Response({'status': 'suspended'})

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        access = self.get_object()
        access.status = 'REVOKED'
        access.save(update_fields=['status'])
        return Response({'status': 'revoked'})

    @action(detail=True, methods=['post'])
    def set_permissions(self, request, pk=None):
        """Set all permissions at once. Body: { "permissions": ["VIEW_OWN_ORDERS", ...] }"""
        access = self.get_object()
        perms = request.data.get('permissions', [])
        valid_perms = [p[0] for p in SupplierPortalAccess.PERMISSION_CHOICES]
        invalid = [p for p in perms if p not in valid_perms]
        if invalid:
            return Response({'error': f'Invalid permissions: {invalid}'}, status=400)
        access.permissions = perms
        access.save(update_fields=['permissions'])
        return Response({'status': 'permissions_updated', 'permissions': perms})


# =============================================================================
# ADMIN-SIDE: Proforma review
# =============================================================================

class SupplierProformaAdminViewSet(TenantModelViewSet):
    """Admin review and management of supplier proformas."""
    queryset = SupplierProforma.objects.select_related('supplier', 'reviewed_by').prefetch_related('lines').all()
    serializer_class = SupplierProformaSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return SupplierProformaListSerializer
        return SupplierProformaSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        proforma = self.get_object()
        try:
            proforma.transition_to('APPROVED', user=request.user)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response({'status': 'approved', 'proforma_id': proforma.id})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        proforma = self.get_object()
        reason = request.data.get('reason', '')
        try:
            proforma.transition_to('REJECTED', user=request.user, reason=reason)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def negotiate(self, request, pk=None):
        proforma = self.get_object()
        notes = request.data.get('notes', '')
        try:
            proforma.transition_to('NEGOTIATING', user=request.user, reason=notes)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response({'status': 'negotiating'})

    @action(detail=True, methods=['post'])
    def convert_to_po(self, request, pk=None):
        """Convert an approved proforma into a PurchaseOrder."""
        proforma = self.get_object()
        if proforma.status != 'APPROVED':
            return Response({'error': 'Proforma must be APPROVED to convert'}, status=400)

        try:
            from apps.pos.purchase_order_models import PurchaseOrder, PurchaseOrderLine

            po = PurchaseOrder.objects.create(
                organization=proforma.organization,
                supplier=proforma.supplier,
                status='DRAFT',
                currency=proforma.currency,
                created_by=request.user,
                notes=f'Auto-created from Proforma {proforma.proforma_number}',
            )

            for line in proforma.lines.all():
                PurchaseOrderLine.objects.create(
                    organization=proforma.organization,
                    order=po,
                    product=line.product,
                    description=line.description,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    tax_rate=line.tax_rate,
                    discount_percent=line.discount_percent,
                )

            po.recalculate_totals()
            proforma.purchase_order = po
            proforma.transition_to('CONVERTED', user=request.user)

            return Response({
                'status': 'converted',
                'proforma_id': proforma.id,
                'purchase_order_id': po.id,
                'po_number': po.po_number,
            })
        except Exception as e:
            logger.error(f"Proforma→PO conversion failed: {e}")
            return Response({'error': str(e)}, status=500)


# =============================================================================
# ADMIN-SIDE: Price change review
# =============================================================================

class PriceChangeRequestAdminViewSet(TenantModelViewSet):
    """Admin review of supplier price change requests."""
    queryset = PriceChangeRequest.objects.select_related('supplier', 'product', 'reviewed_by').all()
    serializer_class = PriceChangeRequestSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        pcr = self.get_object()
        pcr.status = 'APPROVED'
        pcr.reviewed_by = request.user
        pcr.reviewed_at = timezone.now()
        pcr.review_notes = request.data.get('notes', '')
        pcr.save()

        # Notify supplier
        SupplierNotification.objects.create(
            organization=pcr.organization,
            supplier=pcr.supplier,
            notification_type='PRICE_RESPONSE',
            title=f'Price change APPROVED for {pcr.product}',
            message=f'Your {pcr.get_request_type_display()} request was approved. New price: {pcr.proposed_price}',
            related_object_type='PriceChangeRequest',
            related_object_id=pcr.id,
        )
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        pcr = self.get_object()
        pcr.status = 'REJECTED'
        pcr.reviewed_by = request.user
        pcr.reviewed_at = timezone.now()
        pcr.review_notes = request.data.get('notes', '')
        pcr.save()

        SupplierNotification.objects.create(
            organization=pcr.organization,
            supplier=pcr.supplier,
            notification_type='PRICE_RESPONSE',
            title=f'Price change REJECTED for {pcr.product}',
            message=f'Your {pcr.get_request_type_display()} request was rejected. Reason: {pcr.review_notes}',
            related_object_type='PriceChangeRequest',
            related_object_id=pcr.id,
        )
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def counter_propose(self, request, pk=None):
        pcr = self.get_object()
        counter_price = request.data.get('counter_price')
        if not counter_price:
            return Response({'error': 'counter_price is required'}, status=400)
        pcr.status = 'COUNTER'
        pcr.counter_price = counter_price
        pcr.reviewed_by = request.user
        pcr.reviewed_at = timezone.now()
        pcr.review_notes = request.data.get('notes', '')
        pcr.save()

        SupplierNotification.objects.create(
            organization=pcr.organization,
            supplier=pcr.supplier,
            notification_type='PRICE_RESPONSE',
            title=f'Counter-proposal for {pcr.product}',
            message=f'A counter-proposal of {counter_price} was sent for your {pcr.get_request_type_display()} request.',
            related_object_type='PriceChangeRequest',
            related_object_id=pcr.id,
        )
        return Response({'status': 'counter_proposed', 'counter_price': counter_price})


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
