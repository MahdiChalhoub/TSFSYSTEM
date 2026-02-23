"""
Client Portal — ViewSets
========================
Admin-side: manage client access, review orders, handle tickets.
Client-side: dashboard, catalog, cart, orders, wallet, tickets.
Portal-side: auth (login/register), public storefront config.
"""
import logging
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Sum, Count

from erp.views import TenantModelViewSet
from .models import (
    ClientPortalConfig, ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket, QuoteRequest, QuoteItem
)
from .serializers import (
    ClientPortalAccessSerializer,
    ClientWalletSerializer, WalletTransactionSerializer,
    ClientOrderSerializer, ClientOrderListSerializer, ClientOrderLineSerializer,
    ClientTicketSerializer, QuoteRequestSerializer,
    ClientDashboardSerializer,
)
from .permissions import IsClientUser, HasClientPermission

logger = logging.getLogger(__name__)


# =============================================================================
# PORTAL AUTH: Client login from storefront
# =============================================================================

class ClientPortalLoginView(APIView):
    """
    Public login endpoint for the client storefront.
    Authenticates user, verifies active ClientPortalAccess, returns token + portal data.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        slug = request.data.get('slug', '')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=400)

        # Authenticate
        from erp.models import User
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email or password'}, status=401)

        if not user.check_password(password):
            return Response({'error': 'Invalid email or password'}, status=401)

        if not user.is_active:
            return Response({'error': 'Account is disabled'}, status=403)

        # Verify client portal access
        try:
            access = user.client_access
        except ClientPortalAccess.DoesNotExist:
            return Response({'error': 'No portal access configured for this account'}, status=403)

        if access.status != 'ACTIVE':
            return Response({
                'error': f'Portal access is {access.status.lower()}. Please contact support.'
            }, status=403)

        # Verify slug matches (if provided)
        if slug and access.contact.organization.slug != slug:
            return Response({'error': 'Invalid store access'}, status=403)

        # Update last login
        access.last_login = timezone.now()
        access.save(update_fields=['last_login'])

        # Issue token
        Token.objects.filter(user=user).delete()
        try:
            token = Token.objects.create(user=user)
        except Exception:
            token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'token': token.key,
            'portal_type': 'client',
            'user': {
                'id': str(user.pk),
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.email,
            },
            'contact': {
                'id': str(access.contact.pk),
                'name': access.contact.name,
                'tier': access.contact.customer_tier,
                'loyalty_points': access.contact.loyalty_points,
            },
            'permissions': access.permissions or [],
            'organization': {
                'id': str(access.contact.organization.pk),
                'name': access.contact.organization.name,
                'slug': access.contact.organization.slug,
            },
        })


class StorefrontPublicConfigView(APIView):
    """
    Public endpoint to get storefront configuration for a given slug.
    Returns store mode, branding, and feature flags (no auth required).
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        slug = request.query_params.get('slug', '')
        if not slug:
            return Response({'error': 'slug parameter required'}, status=400)

        from erp.models import Organization
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=404)

        config = ClientPortalConfig.get_config(org)

        return Response({
            'organization': {
                'id': str(org.pk),
                'name': org.name,
                'slug': org.slug,
            },
            'store_mode': config.store_mode,
            'storefront_title': config.storefront_title or org.name,
            'storefront_tagline': config.storefront_tagline,
            'storefront_theme': config.storefront_theme or 'midnight',
            'storefront_type': config.storefront_type or 'PRODUCT_STORE',
            'show_stock_levels': config.show_stock_levels,
            'allow_guest_browsing': config.allow_guest_browsing,
            'ecommerce_enabled': config.ecommerce_enabled,
            'loyalty_enabled': config.loyalty_enabled,
            'wallet_enabled': config.wallet_enabled,
            'tickets_enabled': config.tickets_enabled,
            'require_approval_for_orders': config.require_approval_for_orders,
            'stripe_publishable_key': self._get_stripe_key(org),
        })

    def _get_stripe_key(self, org):
        from apps.finance.gateway_models import GatewayConfig
        stripe_cfg = GatewayConfig.objects.filter(
            organization=org, gateway_type='STRIPE', is_active=True
        ).first()
        return stripe_cfg.publishable_key if stripe_cfg else None


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

        # Include org config for client-side display
        config = ClientPortalConfig.get_config(org)

        data = {
            'total_orders': total_orders,
            'active_orders': active_orders,
            'total_spent': total_spent,
            'wallet_balance': wallet_balance,
            'loyalty_points': loyalty_points,
            'loyalty_tier': tier,
            'open_tickets': open_tickets,
            'barcode': barcode,
            # Per-org config for client UI
            'loyalty_enabled': config.loyalty_enabled,
            'loyalty_earn_rate': str(config.loyalty_earn_rate),
            'loyalty_redemption_ratio': str(config.loyalty_redemption_ratio),
            'loyalty_min_redeem': config.loyalty_min_redeem,
            'wallet_enabled': config.wallet_enabled,
            'ecommerce_enabled': config.ecommerce_enabled,
            'tickets_enabled': config.tickets_enabled,
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
        order = serializer.save(
            organization=access.contact.organization,
            contact=access.contact,
        )

        # If order is created as PLACED with CARD payment, trigger Stripe
        if order.status == 'PLACED' and order.payment_method == 'CARD':
            try:
                from apps.finance.stripe_gateway import StripeGatewayService
                service = StripeGatewayService(order.organization_id)
                
                amount_to_charge = order.total_amount - order.wallet_amount
                if amount_to_charge > 0:
                    intent = service.create_payment_intent(
                        amount=amount_to_charge,
                        currency=order.currency.lower(),
                        metadata={
                            'order_id': order.id,
                            'order_number': order.order_number,
                            'contact_id': order.contact_id,
                            'type': 'CLIENT_ORDER'
                        },
                        customer_email=self.request.user.email
                    )
                    if 'error' not in intent:
                        # Attach as temporary attribute so serializer can access it
                        order.stripe_client_secret = intent['client_secret']
                        order.stripe_payment_intent_id = intent['payment_intent_id']
            except Exception as e:
                logger.error(f"Stripe error in perform_create: {e}")


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

        # Use org config for delivery fee and minimum order
        config = ClientPortalConfig.get_config(order.organization)

        if not config.ecommerce_enabled:
            return Response({'error': 'eCommerce is disabled for this organization'}, status=403)

        order.recalculate_totals()

        if config.min_order_amount > 0 and order.subtotal < config.min_order_amount:
            return Response({
                'error': f'Minimum order amount is {config.min_order_amount}'
            }, status=400)

        # Apply org delivery fee
        order.delivery_fee = config.get_delivery_fee(order.subtotal)
        order.recalculate_totals()

        # Handle wallet payment
        wallet_amount = Decimal(str(request.data.get('wallet_amount', 0)))
        if wallet_amount > 0:
            if not config.allow_wallet_payment:
                return Response({'error': 'Wallet payment is disabled'}, status=400)
            try:
                wallet = order.contact.wallet
                wallet.debit(wallet_amount, reason=f'Payment for {order.order_number}',
                            reference_type='ClientOrder', reference_id=order.id)
                order.wallet_amount = wallet_amount
            except (ValueError, ClientWallet.DoesNotExist) as e:
                return Response({'error': str(e)}, status=400)

        order.status = 'PLACED'
        order.placed_at = timezone.now()
        order.payment_method = request.data.get('payment_method', order.payment_method)
        order.delivery_address = request.data.get('delivery_address', order.delivery_address)
        order.delivery_phone = request.data.get('delivery_phone', order.delivery_phone)
        order.delivery_notes = request.data.get('delivery_notes', order.delivery_notes)
        order.save()

        response_data = {'status': 'placed', 'order_number': order.order_number}

        # Handle Stripe Card Payment
        if order.payment_method == 'CARD':
            try:
                from apps.finance.stripe_gateway import StripeGatewayService
                service = StripeGatewayService(order.organization_id)
                
                amount_to_charge = order.total_amount - order.wallet_amount
                if amount_to_charge > 0:
                    intent = service.create_payment_intent(
                        amount=amount_to_charge,
                        currency=order.currency.lower(),
                        metadata={
                            'order_id': order.id,
                            'order_number': order.order_number,
                            'contact_id': order.contact_id,
                            'type': 'CLIENT_ORDER'
                        },
                        customer_email=self.request.user.email
                    )
                    if 'error' in intent:
                        return Response({'error': intent['error']}, status=400)
                    
                    response_data['stripe_client_secret'] = intent['client_secret']
                    response_data['stripe_payment_intent_id'] = intent['payment_intent_id']
            except Exception as e:
                return Response({'error': f"Stripe integration error: {str(e)}"}, status=400)

        return Response(response_data)

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
        org = access.contact.organization
        config = ClientPortalConfig.get_config(org)

        if not config.loyalty_enabled:
            return Response({'error': 'Loyalty system is disabled for this organization'}, status=403)

        points = int(request.data.get('points', 0))

        if points < config.loyalty_min_redeem:
            return Response({
                'error': f'Minimum redemption is {config.loyalty_min_redeem} points'
            }, status=400)

        try:
            wallet = access.contact.wallet
            # Use org-configured redemption ratio
            discount = config.get_loyalty_value(points)
            txn = wallet.redeem_loyalty_points(points, discount)
            return Response({
                'status': 'redeemed',
                'points_used': points,
                'discount': str(discount),
                'redemption_ratio': str(config.loyalty_redemption_ratio),
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


# =============================================================================
# ADMIN: Portal Configuration
# =============================================================================

class ClientPortalConfigViewSet(TenantModelViewSet):
    """Admin management of per-org Client Portal configuration."""
    queryset = ClientPortalConfig.objects.all()
    serializer_class = None  # will use generic serializer below

    def get_serializer_class(self):
        from .serializers import ClientPortalConfigSerializer
        return ClientPortalConfigSerializer

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current org's config (auto-creates with defaults if none exists)."""
        from erp.middleware import get_current_tenant_id
        from erp.models import Organization
        
        org = request.user.organization
        if not org:
            tenant_id = get_current_tenant_id()
            if tenant_id:
                try:
                    org = Organization.objects.get(id=tenant_id)
                except Organization.DoesNotExist:
                    pass
        
        if not org:
            return Response({"error": "No organization context found"}, status=400)

        config = ClientPortalConfig.get_config(org)
        from .serializers import ClientPortalConfigSerializer
        return Response(ClientPortalConfigSerializer(config).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Returns e-commerce analytics for the current organization."""
        org = request.user.organization
        # Real stats from ClientOrder
        total_orders = ClientOrder.objects.filter(organization=org).exclude(status='CART').count()
        total_revenue = ClientOrder.objects.filter(organization=org, payment_status='PAID').aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        pending_orders = ClientOrder.objects.filter(organization=org, status='PENDING').count()
        
        last_month = timezone.now() - timezone.timedelta(days=30)
        monthly_orders = ClientOrder.objects.filter(organization=org, created_at__gte=last_month).exclude(status='CART').count()
        monthly_revenue = ClientOrder.objects.filter(
            organization=org, payment_status='PAID', created_at__gte=last_month
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        
        # Breakdown by status
        status_counts = ClientOrder.objects.filter(organization=org).values('status').annotate(count=Count('id'))
        status_map = {s['status']: s['count'] for s in status_counts}

        return Response({
            'total_orders': total_orders,
            'monthly_orders': monthly_orders,
            'monthly_revenue': str(monthly_revenue),
            'total_revenue': str(total_revenue),
            'pending': status_map.get('PENDING', 0),
            'processing': status_map.get('PROCESSING', 0),
            'shipped': status_map.get('SHIPPED', 0),
            'delivered': status_map.get('DELIVERED', 0),
        })

    @action(detail=False, methods=['get'])
    def abandoned_carts(self, request):
        """List orders stuck in 'CART' status for more than 24 hours."""
        org = request.user.organization
        cutoff = timezone.now() - timezone.timedelta(hours=24)
        carts = ClientOrder.objects.filter(
            organization=org, status='CART', created_at__lt=cutoff
        ).select_related('contact').order_by('-created_at')
        
        return Response([{
            'id': c.id,
            'order_number': c.order_number,
            'contact_name': c.contact.name if c.contact else 'Guest',
            'email': c.contact.email if c.contact else 'Unknown',
            'amount': str(c.total_amount),
            'created_at': c.created_at,
        } for c in carts])
# =============================================================================
# QUOTE REQUESTS (CATALOGUE MODE)
# =============================================================================

class QuoteRequestViewSet(TenantModelViewSet):
    """
    ViewSet for handling Quote Requests.
    Creation is public (AllowAny), while viewing and managing is restricted to staff.
    """
    queryset = QuoteRequest.objects.all()
    serializer_class = QuoteRequestSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        org = None
        # Try to resolve organization from authenticated user
        if self.request.user.is_authenticated and hasattr(self.request.user, 'organization'):
            org = self.request.user.organization
        else:
            # Resolve from header X-Tenant-Id (slug) for guest visitors
            org_slug = self.request.headers.get('X-Tenant-Id')
            if org_slug:
                from erp.models import Organization
                org = Organization.objects.filter(slug=org_slug).first()

        if org:
            # Handle contact linking for logged-in clients
            contact = None
            if self.request.user.is_authenticated:
                try:
                    contact = self.request.user.client_access.contact
                except:
                    pass

            serializer.save(organization=org, contact=contact)
        else:
            # If organization cannot be determined, let it fail with validation error or use default logic
            super().perform_create(serializer)
