"""
Expiring Token Authentication — Performance-Optimized
======================================================
Extends DRF's TokenAuthentication to add token expiration.
Tokens older than TOKEN_TTL_HOURS (default: 24h) are automatically rejected.

Performance fix: reuses the user/token resolved by TenantMiddleware
(stored on request._cached_auth) so we don't hit the DB twice per request.
"""

from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    Token auth that expires after TOKEN_TTL_HOURS (default: 24 hours).

    On each successful authentication:
    - If the token is expired, delete it and reject the request.
    - The frontend should catch 401 and redirect to login.

    Performance: if TenantMiddleware already resolved the token (stored in
    request._cached_auth), we reuse it instead of doing a second DB lookup.
    """

    def authenticate(self, request):
        """Override to check for cached auth from TenantMiddleware first."""
        cached = getattr(request, '_cached_auth', None)
        if cached:
            user, token = cached
            if user and token:
                # Still need to validate expiration + active status
                self._validate_token(token, user)
                return (user, token)

        # Fall through to default token resolution
        return super().authenticate(request)

    def authenticate_credentials(self, key):
        model = self.get_model()

        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise AuthenticationFailed('Invalid token.')

        self._validate_token(token, token.user)
        return (token.user, token)

    @staticmethod
    def _validate_token(token, user):
        """Shared validation for both cached and fresh token paths."""
        if not user.is_active:
            raise AuthenticationFailed('User inactive or deleted.')

        # Check expiration
        ttl_hours = getattr(settings, 'TOKEN_TTL_HOURS', 24)
        token_age = timezone.now() - token.created

        if token_age > timedelta(hours=ttl_hours):
            token.delete()
            raise AuthenticationFailed('Token has expired. Please log in again.')
