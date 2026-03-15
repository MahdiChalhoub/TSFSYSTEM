import logging
from contextvars import ContextVar
try:
    from kernel.tenancy.middleware import set_current_tenant, clear_current_tenant
except ImportError:
    # Kernel not available
    def set_current_tenant(t): pass
    def clear_current_tenant(): pass

logger = logging.getLogger('erp.security')

_tenant_id: ContextVar[str | None] = ContextVar('_tenant_id', default=None)
_authorized_scope: ContextVar[str | None] = ContextVar('_authorized_scope', default=None)

def set_current_tenant_id(organization_id):
    _tenant_id.set(organization_id)

def get_current_tenant_id():
    return _tenant_id.get(None)

def set_authorized_scope(scope):
    _authorized_scope.set(scope)

def get_authorized_scope():
    return _authorized_scope.get(None)


# ─── Paths that bypass organization isolation (public endpoints) ───
_PUBLIC_PATHS = frozenset([
    '/api/auth/login/',
    '/api/auth/logout/',
    '/api/auth/config/',
    '/api/auth/register/business/',
    '/api/auth/password-reset/',
    '/api/auth/password-reset/confirm/',
    '/api/health/',
    '/api/saas/pricing/',
    '/api/organization/resolve/',
    '/api/domains/resolve/',
])


def _is_public_path(path: str) -> bool:
    """Check if the request path is a public endpoint that doesn't require organization context."""
    # Normalize paths: remove optional '/erp' prefix if present from /api/erp/...
    normalized_path = path
    if path.startswith('/api/erp/'):
        normalized_path = '/api/' + path[len('/api/erp/'):]
    
    return any(normalized_path.startswith(p) for p in _PUBLIC_PATHS)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # ─── 1. RESOLVE USER FROM TOKEN ───
        # DRF token auth runs AFTER middleware, so we resolve manually here.
        user = self._resolve_user_from_token(request)

        # ─── 2. DETERMINE TENANT ID ───
        # Priority: X-Tenant-Id header → user.organization_id → None
        header_tenant_id = request.headers.get('X-Tenant-Id')
        
        # ── Normalize Header: ID or Slug ──
        if header_tenant_id:
            from .tenant_utils import resolve_tenant_header
            header_tenant_id = resolve_tenant_header(header_tenant_id)

        organization_id = None

        # ─── 3. PUBLIC PATHS HANDLING ───
        if _is_public_path(path):
            # For public paths, we don't ENFORCE isolation, but we DO establish context
            # if the header is provided (important for login/register).
            if header_tenant_id:
                # establish context if header is provided
                organization_id = header_tenant_id
            
            set_current_tenant_id(organization_id)
            request.organization_id = organization_id
            response = self.get_response(request)
            set_current_tenant_id(None) # Cleanup
            return response

        if header_tenant_id:
            # ─── STRICT ISOLATION CHECK ───
            # Header claims a specific organization. Verify the user is authorized.
            if not user:
                # Anonymous access with a organization header = suspicious.
                logger.warning(
                    f"[ISOLATION] Unauthenticated request with X-Tenant-Id={header_tenant_id} "
                    f"from {request.META.get('REMOTE_ADDR')} — BLOCKED"
                )
                from django.http import JsonResponse
                return JsonResponse(
                    {"error": "Authentication required to access organization resources."},
                    status=401
                )

            if user.is_superuser and user.organization and user.organization.slug == 'saas':
                # Superusers can access any organization for management ONLY if they come from the 'saas' org.
                organization_id = header_tenant_id
                logger.info(f"[ISOLATION] SaaS Superuser {user.username} accessing organization {organization_id}")
            elif str(user.organization_id) == str(header_tenant_id):
                # User matches the requested organization — allowed
                organization_id = header_tenant_id
            else:
                # ─── CROSS-TENANT VIOLATION ───
                logger.error(
                    f"[ISOLATION VIOLATION] User {user.id} ({user.username}) "
                    f"org={user.organization_id} attempted access to organization={header_tenant_id} "
                    f"from IP={request.META.get('REMOTE_ADDR')} path={path}"
                )
                from django.http import JsonResponse
                return JsonResponse(
                    {
                        "error": "Isolation Violation",
                        "detail": "You are not authorized to access this organization's data."
                    },
                    status=403
                )
        elif user and user.organization_id:
            # No header — fallback to user's own organization
            organization_id = str(user.organization_id)
        
        request.organization = None
        if organization_id:
            from erp.models import Organization
            request.organization = Organization.objects.filter(id=organization_id, is_active=True).first()
            if not request.organization:
                # Fail if context was requested but not found
                from django.http import JsonResponse
                return JsonResponse({"error": "Organization not found or inactive."}, status=404)

        set_current_tenant_id(organization_id)
        set_current_tenant(request.organization)
        request.organization_id = organization_id

        # ─── 4. RESOLVE AUTHORIZED SCOPE ───
        authorized_scope = 'official' # Default to strict
        token_key = self._get_token_key(request)
        if token_key:
            from django.core.cache import cache
            authorized_scope = cache.get(f"token_scope:{token_key}")
            
        if not authorized_scope:
             if user and (user.is_staff or user.is_superuser):
                 authorized_scope = 'internal'
             else:
                 authorized_scope = 'official'
        
        set_authorized_scope(authorized_scope)
        request.authorized_scope = authorized_scope

        try:
            response = self.get_response(request)
        finally:
            set_current_tenant_id(None)
            clear_current_tenant()
            set_authorized_scope(None)

        return response

    def _get_token_key(self, request):
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Token '):
            return auth_header[6:].strip()
        return None

    def _resolve_user_from_token(self, request):
        """Manually resolve user from DRF Token auth header or existing session."""
        # Check if user is already authenticated (e.g., via force_authenticate in tests,
        # or session-based auth from SessionMiddleware)
        if hasattr(request, 'user') and hasattr(request.user, 'is_authenticated'):
            if request.user.is_authenticated:
                return request.user

        # Fall back to Token-based auth
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Token '):
            return None
        token_key = auth_header[6:].strip()
        if not token_key:
            return None
        try:
            from rest_framework.authtoken.models import Token
            from django.conf import settings
            import datetime
            from django.utils import timezone
            
            token = Token.objects.select_related('user', 'user__organization').get(key=token_key)
            
            # Explicit TTL check: match DRF ExpiringTokenAuthentication
            ttl_days = getattr(settings, 'EXPIRING_AUTH_TOKEN_DURATION', 14)
            if timezone.now() > token.created + datetime.timedelta(days=ttl_days):
                return None
                
            return token.user
        except Exception:
            return None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Enforce Read-Only Mode for Expired Subscriptions."""
        organization_id = get_current_tenant_id()
        if organization_id and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Whitelist auth endpoints — users must be able to login/logout even on expired tenants
            auth_safe_paths = ['/api/auth/login/', '/api/auth/logout/', '/api/auth/password-reset/']
            if any(request.path.startswith(p) for p in auth_safe_paths):
                return None

            from .models import Organization
            try:
                org = Organization.objects.get(id=organization_id)
                if org.is_read_only:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {"error": "Subscription expired. Organization is in read-only mode."},
                        status=403
                    )
            except Organization.DoesNotExist:
                pass
        return None


# ═══════════════════════════════════════════════════════════════
# Request Logging Middleware
# Structured JSON request/response logging for observability.
# Logs: method, path, status, duration_ms, user, tenant, IP.
# ═══════════════════════════════════════════════════════════════
import time

_request_logger = logging.getLogger('tsfsystem.request')

_SKIP_PATHS = ['/health/', '/static/', '/media/', '/favicon.ico']


class RequestLoggingMiddleware:
    """Log every API request with structured JSON metadata."""

    def __init__(self, get_response):
        self.get_response = get_response
        from django.conf import settings as _s
        self.enabled = getattr(_s, 'REQUEST_LOGGING_ENABLED', not _s.DEBUG)

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        path = request.path
        if any(path.startswith(skip) for skip in _SKIP_PATHS):
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        user = getattr(request, 'user', None)
        user_str = str(user) if user and user.is_authenticated else 'anonymous'
        tenant = getattr(request, 'tenant', None)
        tenant_str = str(tenant) if tenant else '-'

        log_data = {
            'method': request.method,
            'path': path,
            'status': response.status_code,
            'duration_ms': duration_ms,
            'user': user_str,
            'tenant': tenant_str,
            'ip': self._get_client_ip(request),
        }

        if response.status_code >= 500:
            _request_logger.error("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)
        elif response.status_code >= 400:
            _request_logger.warning("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)
        else:
            _request_logger.info("%(method)s %(path)s → %(status)s (%(duration_ms)sms)", log_data, extra=log_data)

        return response

    @staticmethod
    def _get_client_ip(request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '-')
