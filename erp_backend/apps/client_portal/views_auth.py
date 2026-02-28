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
            'layout': config.layout,
            'stripe_publishable_key': self._get_stripe_key(org),
        })

    def _get_stripe_key(self, org):
        from apps.finance.gateway_models import GatewayConfig
        stripe_cfg = GatewayConfig.objects.filter(
            organization=org, gateway_type='STRIPE', is_active=True
        ).first()
        return stripe_cfg.publishable_key if stripe_cfg else None
