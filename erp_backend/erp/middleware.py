"""
Tenant Isolation Middleware — Performance-Optimized
====================================================
ContextVar-based tenant resolution with three key performance optimizations:
1. Caching the resolved token/user on the request to avoid duplicate DB lookups
2. Pre-fetching Organization.is_read_only during __call__ (single query)
   instead of re-querying in process_view for every write request
3. Tuple-based auth_safe_paths for O(1)-ish membership checks
"""

from contextvars import ContextVar

_tenant_id: ContextVar[str | None] = ContextVar('_tenant_id', default=None)
_authorized_scope: ContextVar[str | None] = ContextVar('_authorized_scope', default=None)
_tenant_read_only: ContextVar[bool] = ContextVar('_tenant_read_only', default=False)

def set_current_tenant_id(tenant_id):
    _tenant_id.set(tenant_id)

def get_current_tenant_id():
    return _tenant_id.get(None)

def set_authorized_scope(scope):
    """Set accounting scope for current request: 'official' or 'internal'."""
    _authorized_scope.set(scope)

def get_authorized_scope():
    """Get the authorized accounting scope for the current request. Defaults to 'official'."""
    return _authorized_scope.get(None) or 'official'


# ── Auth-safe paths that bypass read-only checks (tuple for fast iteration) ──
_AUTH_SAFE_PATHS = (
    '/api/auth/login/',
    '/api/auth/logout/',
    '/api/auth/password-reset/',
)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Explicit header from frontend (tenant-aware pages)
        tenant_id = request.headers.get('X-Tenant-Id')
        # Resolved Organization instance — set on the request below so views
        # can read self.request.organization without a per-view fetch.
        resolved_org = None

        # 2. No header? Resolve from auth token → user.organization
        #    Cache the resolved token + user on the request so DRF's
        #    ExpiringTokenAuthentication can reuse it (avoids duplicate DB hit).
        if not tenant_id:
            user, token = self._resolve_user_and_token(request)
            if user and user.organization_id:
                tenant_id = str(user.organization_id)
                # Cache for DRF auth reuse (Fix #3: eliminate duplicate token lookup)
                request._cached_auth = (user, token)
                # User was loaded with select_related('user__organization'),
                # so .organization is already in memory — no extra query.
                resolved_org = user.organization

        set_current_tenant_id(tenant_id)

        # Expose org on request — views/serializers consistently use
        # `self.request.organization` and `request.organization_id`. Without
        # this, those reads raise AttributeError → HTTP 500.
        request.organization_id = tenant_id
        request.organization = resolved_org or self._lookup_org(tenant_id)

        # 3. Pre-fetch read-only status in a single query (Fix #2).
        #    This avoids the per-write DB lookup that process_view was doing.
        is_read_only = False
        if tenant_id:
            is_read_only = self._check_read_only(tenant_id)
        _tenant_read_only.set(is_read_only)

        response = self.get_response(request)

        # Cleanup
        set_current_tenant_id(None)
        _tenant_read_only.set(False)
        return response

    def _resolve_user_and_token(self, request):
        """Resolve user + token from Authorization header. Returns (user, token) or (None, None)."""
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Token '):
            return None, None
        token_key = auth_header[6:].strip()
        if not token_key:
            return None, None
        try:
            from rest_framework.authtoken.models import Token
            token = Token.objects.select_related('user', 'user__organization').get(key=token_key)
            return token.user, token
        except Exception:
            return None, None

    @staticmethod
    def _lookup_org(tenant_id):
        """Resolve Organization for header-based requests (no auth token path).
        Returns None if tenant_id is missing or unresolvable."""
        if not tenant_id:
            return None
        import uuid
        try:
            from .models import Organization
            try:
                uuid.UUID(str(tenant_id))
                return Organization.objects.filter(id=tenant_id).first()
            except ValueError:
                return Organization.objects.filter(slug=tenant_id).first()
        except Exception:
            return None

    @staticmethod
    def _check_read_only(tenant_id):
        """Single-field lookup to check if the tenant is read-only. Uses .only() to minimize data transfer."""
        import uuid
        try:
            from .models import Organization
            try:
                uuid.UUID(str(tenant_id))
                result = Organization.objects.filter(id=tenant_id).values_list('is_read_only', flat=True).first()
            except ValueError:
                result = Organization.objects.filter(slug=tenant_id).values_list('is_read_only', flat=True).first()
            return bool(result)
        except Exception:
            return False

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Enforce Read-Only Mode for Expired Subscriptions.
        Uses the pre-fetched ContextVar instead of hitting the DB again."""
        if not _tenant_read_only.get(False):
            return None

        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return None

        # Whitelist auth endpoints — users must be able to login/logout even on expired tenants
        if any(request.path.startswith(p) for p in _AUTH_SAFE_PATHS):
            return None

        from django.http import JsonResponse
        return JsonResponse(
            {"error": "Subscription expired. Organization is in read-only mode."},
            status=403
        )
