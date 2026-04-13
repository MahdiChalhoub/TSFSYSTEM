from contextvars import ContextVar

_tenant_id: ContextVar[str | None] = ContextVar('_tenant_id', default=None)
_authorized_scope: ContextVar[str | None] = ContextVar('_authorized_scope', default=None)

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

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Explicit header from frontend (tenant-aware pages)
        tenant_id = request.headers.get('X-Tenant-Id')
        
        # 2. No header? Resolve from auth token → user.organization
        #    Since every user MUST have an org, this always works for authenticated users.
        #    NOTE: DRF token auth runs AFTER middleware, so we resolve manually here.
        if not tenant_id:
            user = self._resolve_user_from_token(request)
            if user and user.organization_id:
                tenant_id = str(user.organization_id)
        
        set_current_tenant_id(tenant_id)
        
        response = self.get_response(request)
        
        # Cleanup
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
        # Enforce Read-Only Mode for Expired Subscriptions
        tenant_id = get_current_tenant_id()
        if tenant_id and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Whitelist auth endpoints — users must be able to login/logout even on expired tenants
            auth_safe_paths = ['/api/auth/login/', '/api/auth/logout/', '/api/auth/password-reset/']
            if any(request.path.startswith(p) for p in auth_safe_paths):
                return None

            from .models import Organization
            import uuid
            try:
                # X-Tenant-Id may be a slug string (sent by the proxy) or a UUID string
                # (resolved from the auth token). Try UUID lookup first, fall back to slug.
                try:
                    uuid.UUID(str(tenant_id))
                    org = Organization.objects.get(id=tenant_id)
                except ValueError:
                    org = Organization.objects.filter(slug=tenant_id).first()

                if org and org.is_read_only:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {"error": "Subscription expired. Organization is in read-only mode."},
                        status=403
                    )
            except Organization.DoesNotExist:
                pass
        return None
