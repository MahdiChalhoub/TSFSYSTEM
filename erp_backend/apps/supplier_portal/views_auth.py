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
# PORTAL AUTH: Supplier login
# =============================================================================

class SupplierPortalLoginView(APIView):
    """
    Public login endpoint for the supplier portal.
    Authenticates user, verifies active SupplierPortalAccess, returns token + portal data.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        slug = request.data.get('slug', '')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=400)

        from erp.models import User
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid email or password'}, status=401)

        if not user.check_password(password):
            return Response({'error': 'Invalid email or password'}, status=401)

        if not user.is_active:
            return Response({'error': 'Account is disabled'}, status=403)

        # Verify supplier portal access
        try:
            access = user.supplier_access
        except SupplierPortalAccess.DoesNotExist:
            return Response({'error': 'No supplier portal access for this account'}, status=403)

        if access.status != 'ACTIVE':
            return Response({
                'error': f'Portal access is {access.status.lower()}. Please contact the buyer.'
            }, status=403)

        # Verify slug matches (if provided)
        if slug and access.contact.organization.slug != slug:
            return Response({'error': 'Invalid portal access'}, status=403)

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
            'portal_type': 'supplier',
            'user': {
                'id': str(user.pk),
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.email,
            },
            'contact': {
                'id': str(access.contact.pk),
                'name': access.contact.name,
                'company': access.contact.company_name or '',
                'supplier_category': access.contact.supplier_category,
            },
            'permissions': access.permissions or [],
            'organization': {
                'id': str(access.contact.organization.pk),
                'name': access.contact.organization.name,
                'slug': access.contact.organization.slug,
            },
        })
