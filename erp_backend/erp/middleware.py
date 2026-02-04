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
        set_current_tenant_id(tenant_id)
        
        response = self.get_response(request)
        
        # Cleanup
        set_current_tenant_id(None)
        return response

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
