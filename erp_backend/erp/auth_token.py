"""
Expiring Token Authentication
==============================
Extends DRF's TokenAuthentication to add a configurable token expiration.
Tokens older than TOKEN_TTL_HOURS (default: 24h) are automatically rejected.

Usage in settings.py:
    REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'erp.auth_token.ExpiringTokenAuthentication',
            ...
        ),
    }
    TOKEN_TTL_HOURS = 24  # Optional, default is 24
"""

from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    Token auth that expires after TOKEN_TTL_HOURS (default: 24 hours).

    On each successful authentication:
    - If the token is expired, delete it and reject the request.
    - The frontend should catch 401 and redirect to login.
    """

    def authenticate_credentials(self, key):
        model = self.get_model()

        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise AuthenticationFailed('Invalid token.')

        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted.')

        # Check expiration
        ttl_hours = getattr(settings, 'TOKEN_TTL_HOURS', 24)
        token_age = timezone.now() - token.created

        if token_age > timedelta(hours=ttl_hours):
            token.delete()
            raise AuthenticationFailed('Token has expired. Please log in again.')

        return (token.user, token)


class CookieTokenAuthentication(ExpiringTokenAuthentication):
    """
    Extends ExpiringTokenAuthentication to also read token from 'auth_token' cookie.
    This enables client-side fetch() calls to work with credentials: 'include'.

    Priority:
    1. Authorization header (standard DRF behavior)
    2. auth_token cookie (for browser fetch requests)
    """

    def authenticate(self, request):
        # First try standard Authorization header
        auth_header = get_authorization_header(request)
        if auth_header:
            # Standard DRF token auth
            return super().authenticate(request)

        # Fallback to cookie
        token_key = request.COOKIES.get('auth_token')
        if not token_key:
            return None

        return self.authenticate_credentials(token_key)
