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
    ProductReview, WishlistItem,
    Coupon, CouponUsage,
    CartPromotion, CartPromotionUsage,
    ShippingRate,
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

# Valid transitions mirror (backend source of truth is ecommerce/views.py ALLOWED_TRANSITIONS)
_CLIENT_ORDER_TRANSITIONS = {
    'PLACED':     ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED':  ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['SHIPPED', 'CANCELLED'],
    'SHIPPED':    ['DELIVERED', 'RETURNED'],
    'DELIVERED':  ['RETURNED'],
    'CANCELLED':  [],
    'RETURNED':   [],
}


class ClientOrderAdminViewSet(TenantModelViewSet):
    """
    Unified admin management of ClientOrders.
    Source of truth for the admin UI — all status transitions go through here.

    Endpoints:
        GET    /api/client-portal/admin-orders/
        GET    /api/client-portal/admin-orders/{id}/
        POST   /api/client-portal/admin-orders/{id}/transition/
        POST   /api/client-portal/admin-orders/{id}/confirm-payment/
    """
    queryset = ClientOrder.objects.select_related('contact').prefetch_related('lines').all()
    serializer_class = ClientOrderSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientOrderListSerializer
        return ClientOrderSerializer

    @action(detail=True, methods=['post'], url_path='transition')
    def transition_status(self, request, pk=None):
        """
        Unified order status transition with guard rules and domain event emission.

        Body: { "status": "CONFIRMED", "note": "optional reason" }

        State machine:
            PLACED      → CONFIRMED | CANCELLED
            CONFIRMED   → PROCESSING | CANCELLED
            PROCESSING  → SHIPPED | CANCELLED
            SHIPPED     → DELIVERED | RETURNED
            DELIVERED   → RETURNED
        """
        order = self.get_object()
        new_status = request.data.get('status', '').upper()
        note = request.data.get('note', '')

        if not new_status:
            return Response({'error': 'status is required'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = _CLIENT_ORDER_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            return Response({
                'error': f"Cannot transition from '{order.status}' to '{new_status}'.",
                'current_status': order.status,
                'allowed_transitions': allowed,
            }, status=status.HTTP_400_BAD_REQUEST)

        old_status = order.status
        order.status = new_status

        # Append timestamped audit note
        if note:
            ts = timezone.now().strftime('%Y-%m-%d %H:%M')
            order.notes = (order.notes or '') + f"\n[{ts}] {old_status}→{new_status}: {note}"

        # On SHIPPED: record estimated delivery if provided
        if new_status == 'SHIPPED':
            est = request.data.get('estimated_delivery')
            if est:
                order.estimated_delivery = est

        # On DELIVERED: timestamp + loyalty points
        if new_status == 'DELIVERED':
            order.delivered_at = timezone.now()
            if order.contact:
                try:
                    from apps.client_portal.models import ClientPortalConfig
                    config = ClientPortalConfig.get_config(order.organization)
                    if config.loyalty_enabled:
                        points = config.get_points_for_amount(order.total_amount)
                        if points > 0:
                            order.contact.wallet.add_loyalty_points(points)
                            logger.info(f"[AdminOrders] +{points} pts for order {order.order_number}")
                except Exception as exc:
                    logger.warning(f"[AdminOrders] Loyalty post failed: {exc}")

        # On CANCELLED: refund wallet amount
        if new_status == 'CANCELLED' and order.wallet_amount > 0:
            try:
                order.contact.wallet.credit(
                    order.wallet_amount,
                    reason=f'Refund for order {order.order_number}',
                    reference_type='ClientOrder',
                    reference_id=order.id,
                )
            except Exception as e:
                logger.error(f"[AdminOrders] Wallet refund failed: {e}")

        # On CANCELLED: release stock reservations (non-blocking)
        if new_status == 'CANCELLED':
            try:
                from apps.inventory.services.reservation_service import StockReservationService
                from apps.client_portal.warehouse_router import WarehouseRouter
                for line in order.lines.select_related('product').all():
                    if not line.product:
                        continue
                    try:
                        wh = WarehouseRouter.select_warehouse(
                            organization=order.organization,
                            product=line.product,
                            quantity=line.quantity,
                            contact=order.contact,
                            check_mode='ALLOW_OVERSALE',  # don't fail on release
                        )
                        StockReservationService.release(order, wh, user=request.user)
                    except Exception:
                        pass  # release is best-effort
            except Exception as res_err:
                logger.warning(f"[AdminOrders] Reservation release failed: {res_err}")

        order.save(update_fields=['status', 'notes', 'estimated_delivery', 'delivered_at', 'updated_at'])
        logger.info(f"[AdminOrders] {order.order_number}: {old_status} → {new_status} by {request.user}")

        # Emit domain event (non-blocking)
        try:
            from apps.integrations.event_service import DomainEventService
            DomainEventService.emit_for_status_change(order, new_status)
        except Exception as evt_err:
            logger.warning(f"[AdminOrders] Domain event failed: {evt_err}")

        return Response({
            'order_number': order.order_number,
            'previous_status': old_status,
            'new_status': new_status,
            'allowed_next': _CLIENT_ORDER_TRANSITIONS.get(new_status, []),
        })

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """
        Admin confirms a manual payment (COD or bank transfer).
        Marks payment_status=PAID and emits payment.confirmed event.
        """
        order = self.get_object()
        if order.payment_status == 'PAID':
            return Response({'error': 'Order is already marked as paid.'}, status=400)

        from apps.finance.payment_gateway import PaymentGatewayService
        success = PaymentGatewayService.confirm_manual_payment(order, confirmed_by_user=request.user)
        if not success:
            return Response({'error': 'Failed to confirm payment.'}, status=500)

        # Domain event
        try:
            from apps.integrations.event_service import DomainEventService
            DomainEventService.emit_payment_confirmed(order)
        except Exception as evt_err:
            logger.warning(f"[AdminOrders] payment.confirmed event failed: {evt_err}")

        return Response({
            'order_number': order.order_number,
            'payment_status': 'PAID',
            'message': 'Payment confirmed successfully.',
        })


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
        ticket.status = 'REOPENED' if hasattr(ticket, 'REOPENED') else 'OPEN'
        ticket.resolved_at = None
        ticket.save(update_fields=['status', 'resolved_at', 'updated_at'])
        return Response({'status': 'reopened'})


# =============================================================================
# ADMIN: Coupon Management
# =============================================================================

class CouponAdminViewSet(TenantModelViewSet):
    """
    Admin management of discount coupons.
    Endpoint: /api/client-portal/coupons/
    """
    from rest_framework import serializers as drf_serializers

    class CouponSerializer(drf_serializers.ModelSerializer):
        class Meta:
            from apps.client_portal.models import Coupon as _Coupon
            model = _Coupon
            fields = '__all__'
            read_only_fields = ['used_count', 'created_at', 'updated_at']

    def get_queryset(self):
        from .models import Coupon as _Coupon
        org = getattr(self.request, 'organization', None)
        qs = _Coupon.objects.all()
        if org:
            qs = qs.filter(organization=org)
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        from rest_framework import serializers as drf_serializers
        class CouponSerializer(drf_serializers.ModelSerializer):
            class Meta:
                model = Coupon
                fields = '__all__'
                read_only_fields = ['used_count', 'created_at', 'updated_at']
        return CouponSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)


# =============================================================================
# ADMIN: Cart Promotion Management
# =============================================================================

class CartPromotionViewSet(TenantModelViewSet):
    """
    Admin management of automatic cart-level promotions.
    Endpoint: /api/client-portal/cart-promotions/
    """
    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        qs = CartPromotion.objects.all()
        if org:
            qs = qs.filter(organization=org)
        return qs.order_by('-priority', '-created_at')

    def get_serializer_class(self):
        from rest_framework import serializers as drf_serializers
        class CartPromotionSerializer(drf_serializers.ModelSerializer):
            class Meta:
                model = CartPromotion
                fields = '__all__'
                read_only_fields = ['used_count', 'created_at', 'updated_at']
        return CartPromotionSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)


# =============================================================================
# ADMIN: Shipping Rate Management
# =============================================================================

class ShippingRateViewSet(TenantModelViewSet):
    """
    Admin management of ShippingRate tiers per DeliveryZone.
    Endpoint: /api/client-portal/shipping-rates/

    Query params:
      ?zone_id=3   — filter by specific zone
    """
    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        qs = ShippingRate.objects.select_related('zone').all()
        if org:
            qs = qs.filter(organization=org)
        zone_id = self.request.query_params.get('zone_id')
        if zone_id:
            qs = qs.filter(zone_id=zone_id)
        return qs.order_by('zone__name', 'sort_order', 'min_order_value')

    def get_serializer_class(self):
        from rest_framework import serializers as drf_serializers
        class ShippingRateSerializer(drf_serializers.ModelSerializer):
            zone_name = drf_serializers.CharField(source='zone.name', read_only=True)
            class Meta:
                model = ShippingRate
                fields = '__all__'
                read_only_fields = ['created_at', 'updated_at']
        return ShippingRateSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)
