import logging
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Sum, Count
from erp.views import TenantModelViewSet
from .models import (
    ClientPortalConfig, ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket, QuoteRequest, QuoteItem,
    ProductReview, WishlistItem
)
from .services import IntegratedCheckoutService
from .serializers import (
    ClientPortalAccessSerializer,
    ClientWalletSerializer, WalletTransactionSerializer,
    ClientOrderSerializer, ClientOrderListSerializer, ClientOrderLineSerializer,
    ClientTicketSerializer, QuoteRequestSerializer,
    ProductReviewSerializer, WishlistItemSerializer,
    ClientDashboardSerializer,
)
from .permissions import IsClientUser, HasClientPermission


# =============================================================================
# ADMIN-SIDE: Manage client access
# =============================================================================

class ClientPortalAccessViewSet(TenantModelViewSet):
    """Admin management of client portal access."""
    queryset = ClientPortalAccess.objects.select_related('contact', 'user', 'granted_by').all()
    serializer_class = ClientPortalAccessSerializer

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        access = self.get_object()
        access.status = 'ACTIVE'
        access.save(update_fields=['status'])
        # Auto-create wallet if none exists
        ClientWallet.objects.get_or_create(
            organization=access.contact.organization,
            contact=access.contact,
        )
        # Auto-generate barcode
        access.generate_barcode()
        return Response({'status': 'activated', 'barcode': access.barcode})

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
        access = self.get_object()
        perms = request.data.get('permissions', [])
        valid_perms = [p[0] for p in ClientPortalAccess.PERMISSION_CHOICES]
        invalid = [p for p in perms if p not in valid_perms]
        if invalid:
            return Response({'error': f'Invalid permissions: {invalid}'}, status=400)
        access.permissions = perms
        access.save(update_fields=['permissions'])
        return Response({'status': 'permissions_updated', 'permissions': perms})

    @action(detail=True, methods=['post'])
    def generate_barcode(self, request, pk=None):
        access = self.get_object()
        barcode = access.generate_barcode()
        return Response({'barcode': barcode})


# =============================================================================
# ADMIN-SIDE: Order management
# =============================================================================

class ClientOrderAdminViewSet(TenantModelViewSet):
    """Admin review/management of client eCommerce orders."""
    queryset = ClientOrder.objects.select_related('contact').prefetch_related('lines').all()
    serializer_class = ClientOrderSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientOrderListSerializer
        return ClientOrderSerializer

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        if order.status != 'PLACED':
            return Response({'error': 'Only PLACED orders can be confirmed'}, status=400)
        order.status = 'CONFIRMED'
        order.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'confirmed'})

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        order = self.get_object()
        if order.status != 'CONFIRMED':
            return Response({'error': 'Only CONFIRMED orders can be processed'}, status=400)
        order.status = 'PROCESSING'
        order.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'processing'})

    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        order = self.get_object()
        if order.status != 'PROCESSING':
            return Response({'error': 'Only PROCESSING orders can be shipped'}, status=400)
        order.status = 'SHIPPED'
        est = request.data.get('estimated_delivery')
        if est:
            order.estimated_delivery = est
        order.save(update_fields=['status', 'estimated_delivery', 'updated_at'])
        return Response({'status': 'shipped'})

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        order = self.get_object()
        if order.status != 'SHIPPED':
            return Response({'error': 'Only SHIPPED orders can be marked delivered'}, status=400)
        order.status = 'DELIVERED'
        order.delivered_at = timezone.now()
        order.save(update_fields=['status', 'delivered_at', 'updated_at'])
        return Response({'status': 'delivered'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in ('DELIVERED', 'CANCELLED'):
            return Response({'error': f'Cannot cancel {order.status} orders'}, status=400)
        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])
        # Refund wallet if paid
        if order.wallet_amount > 0:
            try:
                wallet = order.contact.wallet
                wallet.credit(order.wallet_amount, reason=f'Refund for {order.order_number}',
                             reference_type='ClientOrder', reference_id=order.id)
            except Exception as e:
                logger.error(f"Wallet refund failed: {e}")
        return Response({'status': 'cancelled'})


# =============================================================================
# ADMIN-SIDE: Ticket management
# =============================================================================

class ClientTicketAdminViewSet(TenantModelViewSet):
    """Admin management of client support tickets."""
    queryset = ClientTicket.objects.select_related('contact', 'assigned_to', 'related_order').all()
    serializer_class = ClientTicketSerializer

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        user_id = request.data.get('assigned_to')
        ticket.assigned_to_id = user_id
        ticket.status = 'IN_PROGRESS'
        ticket.save(update_fields=['assigned_to', 'status', 'updated_at'])
        return Response({'status': 'assigned'})

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'RESOLVED'
        ticket.resolution_notes = request.data.get('notes', '')
        ticket.resolved_at = timezone.now()
        ticket.save(update_fields=['status', 'resolution_notes', 'resolved_at', 'updated_at'])
        return Response({'status': 'resolved'})

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'CLOSED'
        ticket.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'closed'})

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = 'OPEN'
        ticket.resolved_at = None
        ticket.save(update_fields=['status', 'resolved_at', 'updated_at'])
        return Response({'status': 'reopened'})
