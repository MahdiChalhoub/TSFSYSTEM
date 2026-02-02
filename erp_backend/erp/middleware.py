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
