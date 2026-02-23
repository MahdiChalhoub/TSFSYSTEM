import logging
from contextvars import ContextVar

logger = logging.getLogger('erp.security')

_tenant_id: ContextVar[str | None] = ContextVar('_tenant_id', default=None)

def set_current_tenant_id(tenant_id):
    _tenant_id.set(tenant_id)

def get_current_tenant_id():
    return _tenant_id.get(None)


# ─── Paths that bypass tenant isolation (public endpoints) ───
_PUBLIC_PATHS = frozenset([
    '/api/auth/login/',
    '/api/auth/logout/',
    '/api/auth/config/',
    '/api/auth/register/business/',
    '/api/auth/password-reset/',
    '/api/auth/password-reset/confirm/',
    '/api/health/',
    '/api/saas/pricing/',
    '/api/tenant/resolve/',
])


def _is_public_path(path: str) -> bool:
    """Check if the request path is a public endpoint that doesn't require tenant context."""
    return any(path.startswith(p) for p in _PUBLIC_PATHS)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # ─── 1. PUBLIC PATHS: No tenant isolation needed ───
        if _is_public_path(path):
            set_current_tenant_id(None)
            request.organization_id = None
            request.organization = None
            response = self.get_response(request)
            set_current_tenant_id(None)
            return response

        # ─── 2. RESOLVE USER FROM TOKEN ───
        # DRF token auth runs AFTER middleware, so we resolve manually here.
        user = self._resolve_user_from_token(request)

        # ─── 3. DETERMINE TENANT ID ───
        # Priority: X-Tenant-Id header → user.organization_id → None
        header_tenant_id = request.headers.get('X-Tenant-Id')
        tenant_id = None

        if header_tenant_id:
            # ─── STRICT ISOLATION CHECK ───
            # Header claims a specific tenant. Verify the user is authorized.
            if not user:
                # Anonymous access with a tenant header = suspicious.
                # Deny immediately to prevent probing.
                logger.warning(
                    f"[ISOLATION] Unauthenticated request with X-Tenant-Id={header_tenant_id} "
                    f"from {request.META.get('REMOTE_ADDR')} — BLOCKED"
                )
                from django.http import JsonResponse
                return JsonResponse(
                    {"error": "Authentication required to access tenant resources."},
                    status=401
                )

            if user.is_superuser:
                # Superusers can access any tenant (SaaS admin panel)
                tenant_id = header_tenant_id
            elif str(user.organization_id) == str(header_tenant_id):
                # User matches the requested tenant — allowed
                tenant_id = header_tenant_id
            else:
                # ─── CROSS-TENANT VIOLATION ───
                # User is trying to access a different organization.
                # Log this as a security event and deny.
                logger.error(
                    f"[ISOLATION VIOLATION] User {user.id} ({user.username}) "
                    f"org={user.organization_id} attempted access to tenant={header_tenant_id} "
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
            # No header — fallback to user's own organization (normal case)
            tenant_id = str(user.organization_id)
        # else: No header, no user → tenant_id stays None (SaaS root / unauthenticated)

        # ─── 4. VALIDATE TENANT EXISTS ───
        request.organization = None
        if tenant_id:
            from erp.models import Organization
            org = Organization.objects.filter(id=tenant_id, is_active=True).first()
            if not org:
                logger.warning(
                    f"[ISOLATION] Tenant {tenant_id} not found or inactive — "
                    f"user={getattr(user, 'id', 'anon')} path={path}"
                )
                from django.http import JsonResponse
                return JsonResponse(
                    {"error": "Organization not found or inactive."},
                    status=404
                )
            request.organization = org

        set_current_tenant_id(tenant_id)
        request.organization_id = tenant_id

        # ─── 5. PROCESS REQUEST ───
        response = self.get_response(request)

        # ─── 6. CLEANUP ───
        set_current_tenant_id(None)
        return response

    def _resolve_user_from_token(self, request):
        """Manually resolve user from DRF Token auth header."""
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Token '):
            return None
        token_key = auth_header[6:].strip()
        if not token_key:
            return None
        try:
            from rest_framework.authtoken.models import Token
            token = Token.objects.select_related('user', 'user__organization').get(key=token_key)
            return token.user
        except Exception:
            return None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Enforce Read-Only Mode for Expired Subscriptions."""
        tenant_id = get_current_tenant_id()
        if tenant_id and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Whitelist auth endpoints — users must be able to login/logout even on expired tenants
            auth_safe_paths = ['/api/auth/login/', '/api/auth/logout/', '/api/auth/password-reset/']
            if any(request.path.startswith(p) for p in auth_safe_paths):
                return None

            from .models import Organization
            try:
                org = Organization.objects.get(id=tenant_id)
                if org.is_read_only:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {"error": "Subscription expired. Organization is in read-only mode."},
                        status=403
                    )
            except Organization.DoesNotExist:
                pass
        return None
