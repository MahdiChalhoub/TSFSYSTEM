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
# ADMIN-SIDE: Module Configuration
# =============================================================================

class SupplierPortalConfigViewSet(TenantModelViewSet):
    """Admin management of supplier portal configuration."""
    queryset = SupplierPortalConfig.objects.all()
    serializer_class = SupplierPortalConfigSerializer

    @action(detail=False, methods=['get'])
    def current(self, request):
        config = SupplierPortalConfig.get_config(request.user.organization)
        return Response(SupplierPortalConfigSerializer(config).data)


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
            from erp.connector_registry import connector
            PurchaseOrder = connector.require('pos.purchase_orders.get_model', org_id=0, source='supplier_portal')
            PurchaseOrderLine = connector.require('pos.purchase_order_lines.get_model', org_id=0, source='supplier_portal')
            if not PurchaseOrder or not PurchaseOrderLine:
                return Response({'error': 'Purchase module not available.'}, status=503)

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
