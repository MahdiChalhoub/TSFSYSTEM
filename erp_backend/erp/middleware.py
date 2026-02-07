import threading

_thread_locals = threading.local()

def set_current_tenant_id(tenant_id):
    _thread_locals.tenant_id = tenant_id

def get_current_tenant_id():
    return getattr(_thread_locals, 'tenant_id', None)

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Capture from Proxy Header
        tenant_id = request.headers.get('X-Tenant-Id')
        
        # [SAAS FIX] If no tenant header, resolve user from auth token
        # and fall back to their organization. This ensures SaaS admin users
        # (on saas.localhost with no subdomain context) can access business data.
        # NOTE: DRF token auth runs AFTER middleware, so we resolve manually here.
        if not tenant_id:
            user = self._resolve_user_from_token(request)
            if user:
                # Try the user's own organization
                org = getattr(user, 'organization', None)
                if org:
                    tenant_id = str(org.id)
                # Superuser fallback: use the first active organization
                elif user.is_superuser:
                    try:
                        from .models import Organization
                        first_org = Organization.objects.filter(is_active=True).first()
                        if first_org:
                            tenant_id = str(first_org.id)
                    except Exception:
                        pass
        
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
        # We need to fetch the Organization object efficiently.
        # Since middleware runs on every request, we should be careful.
        # However, for rigorous enforcement, we must check.
        tenant_id = get_current_tenant_id()
        if tenant_id and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            # Allow login/logout/safe endpoints if necessary? 
            # For now, strict block on API write methods.
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
