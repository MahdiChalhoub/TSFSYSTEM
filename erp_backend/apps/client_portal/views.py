"""
Client Portal — ViewSets
========================
Admin-side: manage client access, review orders, handle tickets.
Client-side: dashboard, catalog, cart, orders, wallet, tickets.
"""
import logging
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count

from erp.views import TenantModelViewSet
from .models import (
    ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket,
)
from .serializers import (
    ClientPortalAccessSerializer,
    ClientWalletSerializer, WalletTransactionSerializer,
    ClientOrderSerializer, ClientOrderListSerializer, ClientOrderLineSerializer,
    ClientTicketSerializer,
    ClientDashboardSerializer,
)
from .permissions import IsClientUser, HasClientPermission

logger = logging.getLogger(__name__)


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


# =============================================================================
# ADMIN-SIDE: Wallet management
# =============================================================================

class ClientWalletAdminViewSet(TenantModelViewSet):
    """Admin management of client wallets."""
    queryset = ClientWallet.objects.select_related('contact').all()
    serializer_class = ClientWalletSerializer

    @action(detail=True, methods=['post'])
    def manual_credit(self, request, pk=None):
        wallet = self.get_object()
        amount = request.data.get('amount', 0)
        reason = request.data.get('reason', 'Manual credit by admin')
        txn = wallet.credit(amount, reason=reason, reference_type='AdminCredit')
        return Response({
            'status': 'credited',
            'new_balance': str(wallet.balance),
            'transaction_id': txn.id,
        })

    @action(detail=True, methods=['post'])
    def manual_debit(self, request, pk=None):
        wallet = self.get_object()
        amount = request.data.get('amount', 0)
        reason = request.data.get('reason', 'Manual debit by admin')
        try:
            txn = wallet.debit(amount, reason=reason, reference_type='AdminDebit')
            return Response({
                'status': 'debited',
                'new_balance': str(wallet.balance),
                'transaction_id': txn.id,
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


# =============================================================================
# CLIENT-SIDE: Dashboard
# =============================================================================

class ClientDashboardViewSet(viewsets.ViewSet):
    """Client portal dashboard with aggregated metrics."""
    permission_classes = [IsAuthenticated, IsClientUser]

    def list(self, request):
        access = request.user.client_access
        contact = access.contact
        org = contact.organization

        orders = ClientOrder.objects.filter(organization=org, contact=contact)
        total_orders = orders.exclude(status='CART').count()
        active_orders = orders.exclude(status__in=['DELIVERED', 'CANCELLED', 'CART']).count()
        total_spent = orders.filter(status='DELIVERED').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0.00')

        wallet_balance = Decimal('0.00')
        loyalty_points = 0
        barcode = access.barcode or ''
        try:
            wallet = contact.wallet
            wallet_balance = wallet.balance
            loyalty_points = wallet.loyalty_points
        except ClientWallet.DoesNotExist:
            pass

        # Determine tier from CRM
        tier = 'STANDARD'
        if hasattr(contact, 'total_purchase_amount'):
            lv = contact.total_purchase_amount or 0
            if lv >= 50000:
                tier = 'WHOLESALE'
            elif lv >= 5000:
                tier = 'VIP'

        open_tickets = ClientTicket.objects.filter(
            organization=org, contact=contact,
            status__in=['OPEN', 'IN_PROGRESS']
        ).count()

        data = {
            'total_orders': total_orders,
            'active_orders': active_orders,
            'total_spent': total_spent,
            'wallet_balance': wallet_balance,
            'loyalty_points': loyalty_points,
            'loyalty_tier': tier,
            'open_tickets': open_tickets,
            'barcode': barcode,
        }

        serializer = ClientDashboardSerializer(data)
        return Response(serializer.data)


# =============================================================================
# CLIENT-SIDE: My Orders
# =============================================================================

class ClientMyOrdersViewSet(viewsets.ModelViewSet):
    """Client views and manages their own orders."""
    serializer_class = ClientOrderSerializer
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'PLACE_ORDERS'

    def get_queryset(self):
        if not hasattr(self.request.user, 'client_access'):
            return ClientOrder.objects.none()
        contact = self.request.user.client_access.contact
        return ClientOrder.objects.filter(
            organization=contact.organization, contact=contact
        ).prefetch_related('lines')

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientOrderListSerializer
        return ClientOrderSerializer

    def perform_create(self, serializer):
        access = self.request.user.client_access
        serializer.save(
            organization=access.contact.organization,
            contact=access.contact,
        )

    @action(detail=True, methods=['post'])
    def add_to_cart(self, request, pk=None):
        order = self.get_object()
        if order.status != 'CART':
            return Response({'error': 'Order is not in CART status'}, status=400)
        line_data = request.data
        line_data['order'] = order.id
        line_data['organization'] = order.organization_id
        if 'product' in line_data and not line_data.get('product_name'):
            try:
                from apps.inventory.models import Product
                product = Product.objects.get(id=line_data['product'])
                line_data['product_name'] = product.name
                line_data['unit_price'] = str(product.selling_price_ttc)
                line_data['tax_rate'] = str(product.tva_rate)
            except Exception:
                pass
        serializer = ClientOrderLineSerializer(data=line_data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=order.organization)
        order.recalculate_totals()
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'])
    def place_order(self, request, pk=None):
        order = self.get_object()
        if order.status != 'CART':
            return Response({'error': 'Order is not in CART status'}, status=400)
        if not order.lines.exists():
            return Response({'error': 'Cart is empty'}, status=400)

        order.recalculate_totals()

        # Handle wallet payment
        wallet_amount = Decimal(str(request.data.get('wallet_amount', 0)))
        if wallet_amount > 0:
            try:
                wallet = order.contact.wallet
                wallet.debit(wallet_amount, reason=f'Payment for {order.order_number}',
                            reference_type='ClientOrder', reference_id=order.id)
                order.wallet_amount = wallet_amount
            except (ValueError, ClientWallet.DoesNotExist) as e:
                return Response({'error': str(e)}, status=400)

        order.status = 'PLACED'
        order.placed_at = timezone.now()
        order.delivery_address = request.data.get('delivery_address', order.delivery_address)
        order.delivery_phone = request.data.get('delivery_phone', order.delivery_phone)
        order.delivery_notes = request.data.get('delivery_notes', order.delivery_notes)
        order.save()
        return Response({'status': 'placed', 'order_number': order.order_number})

    @action(detail=True, methods=['post'])
    def rate_delivery(self, request, pk=None):
        order = self.get_object()
        if order.status != 'DELIVERED':
            return Response({'error': 'Can only rate delivered orders'}, status=400)
        order.delivery_rating = request.data.get('rating')
        order.delivery_feedback = request.data.get('feedback', '')
        order.save(update_fields=['delivery_rating', 'delivery_feedback', 'updated_at'])
        return Response({'status': 'rated'})


# =============================================================================
# CLIENT-SIDE: Wallet
# =============================================================================

class ClientWalletViewSet(viewsets.ViewSet):
    """Client views their wallet and transaction history."""
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'VIEW_WALLET'

    def list(self, request):
        access = request.user.client_access
        wallet, _ = ClientWallet.objects.get_or_create(
            organization=access.contact.organization,
            contact=access.contact,
        )
        serializer = ClientWalletSerializer(wallet)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        access = request.user.client_access
        try:
            wallet = access.contact.wallet
            txns = wallet.transactions.all()[:50]
            serializer = WalletTransactionSerializer(txns, many=True)
            return Response(serializer.data)
        except ClientWallet.DoesNotExist:
            return Response([])

    @action(detail=False, methods=['post'])
    def redeem_points(self, request):
        if not request.user.client_access.has_permission('REDEEM_LOYALTY'):
            return Response({'error': 'No REDEEM_LOYALTY permission'}, status=403)
        access = request.user.client_access
        points = int(request.data.get('points', 0))
        try:
            wallet = access.contact.wallet
            # 100 points = 1 currency unit
            discount = Decimal(str(points)) / 100
            txn = wallet.redeem_loyalty_points(points, discount)
            return Response({
                'status': 'redeemed',
                'points_used': points,
                'discount': str(discount),
                'new_balance': str(wallet.balance),
                'remaining_points': wallet.loyalty_points,
            })
        except (ValueError, ClientWallet.DoesNotExist) as e:
            return Response({'error': str(e)}, status=400)


# =============================================================================
# CLIENT-SIDE: Tickets
# =============================================================================

class ClientMyTicketsViewSet(viewsets.ModelViewSet):
    """Client creates and tracks support tickets."""
    serializer_class = ClientTicketSerializer
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'SUBMIT_TICKETS'

    def get_queryset(self):
        if not hasattr(self.request.user, 'client_access'):
            return ClientTicket.objects.none()
        contact = self.request.user.client_access.contact
        return ClientTicket.objects.filter(
            organization=contact.organization, contact=contact
        )

    def perform_create(self, serializer):
        access = self.request.user.client_access
        serializer.save(
            organization=access.contact.organization,
            contact=access.contact,
        )

    @action(detail=True, methods=['post'])
    def rate_resolution(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status not in ('RESOLVED', 'CLOSED'):
            return Response({'error': 'Can only rate resolved/closed tickets'}, status=400)
        ticket.satisfaction_rating = request.data.get('rating')
        ticket.satisfaction_feedback = request.data.get('feedback', '')
        ticket.save(update_fields=['satisfaction_rating', 'satisfaction_feedback', 'updated_at'])
        return Response({'status': 'rated'})


# =============================================================================
# ADMIN: Order lines
# =============================================================================

class ClientOrderLineViewSet(TenantModelViewSet):
    """Admin management of client order lines."""
    queryset = ClientOrderLine.objects.select_related('product').all()
    serializer_class = ClientOrderLineSerializer
