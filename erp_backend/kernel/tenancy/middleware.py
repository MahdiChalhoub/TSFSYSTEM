"""
Tenancy Middleware

Automatically resolves tenant from request and sets it in context.
"""

from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponseForbidden
from .context import set_current_tenant, clear_current_tenant

# NOTE: Tenant must NOT be imported at module level — it triggers AppRegistryNotReady
# during INSTALLED_APPS population. Import lazily inside methods instead.



class TenantMiddleware(MiddlewareMixin):
    """
    Middleware that resolves tenant from request.

    Resolution order:
    1. Subdomain (tenant.tsf.ci)
    2. Custom header (X-Tenant-ID)
    3. User's default tenant
    4. Query parameter (for testing only)

    Sets tenant in thread-local context for automatic scoping.
    """

    def process_request(self, request):
        """
        Resolve tenant and set in context before view processing.
        """
        tenant = self._resolve_tenant(request)

        if tenant:
            # Set tenant in request
            request.tenant = tenant

            # Set in thread-local context for automatic QuerySet scoping
            set_current_tenant(tenant)
        else:
            # FALLBACK: If no tenant resolved, default to SAAS organization
            # The SAAS platform IS an organization - the first one!
            try:
                from erp.models import Organization
                saas_org = Organization.objects.filter(slug='saas').first()
                if saas_org:
                    request.tenant = saas_org
                    set_current_tenant(saas_org)
                else:
                    request.tenant = None
                    clear_current_tenant()
            except Exception:
                request.tenant = None
                clear_current_tenant()

        return None

    def process_response(self, request, response):
        """
        Clear tenant context after request processing.
        """
        clear_current_tenant()
        return response

    def process_exception(self, request, exception):
        """
        Clear tenant context if exception occurs.
        """
        clear_current_tenant()
        return None

    def _resolve_tenant(self, request):
        """
        Resolve tenant from various sources.

        Returns:
            Tenant instance or None
        """
        tenant = None

        # 1. Try subdomain
        tenant = self._resolve_from_subdomain(request)
        if tenant:
            return tenant

        # 2. Try custom header (for API clients)
        tenant = self._resolve_from_header(request)
        if tenant:
            return tenant

        # 3. Try authenticated user's tenant
        tenant = self._resolve_from_user(request)
        if tenant:
            return tenant

        # 4. Try query parameter (ONLY for testing/development)
        if request.GET.get('_tenant'):
            from django.conf import settings
            if settings.DEBUG:
                tenant = self._resolve_from_query(request)

        return tenant

    def _resolve_from_subdomain(self, request):
        """
        Resolve tenant from subdomain.

        Example: acme.tsf.ci → tenant with slug='acme'
        """
        from .models import Tenant  # lazy import — avoids AppRegistryNotReady
        host = request.get_host().split(':')[0]  # Remove port
        parts = host.split('.')

        # Check if subdomain exists (not www, not root domain)
        if len(parts) >= 3 and parts[0] not in ['www', 'api']:
            tenant_slug = parts[0]

            try:
                return Tenant.objects.get(slug=tenant_slug, is_active=True)
            except Tenant.DoesNotExist:
                return None

        return None

    def _resolve_from_header(self, request):
        """
        Resolve tenant from X-Tenant-ID header.

        Used by API clients, mobile apps, etc.
        """
        from .models import Tenant  # lazy import
        tenant_id = request.META.get('HTTP_X_TENANT_ID')

        if tenant_id:
            try:
                return Tenant.objects.get(id=tenant_id, is_active=True)
            except (Tenant.DoesNotExist, ValueError):
                return None

        return None

    def _resolve_from_user(self, request):
        """
        Resolve tenant from authenticated user's default tenant.
        """
        if hasattr(request, 'user') and request.user.is_authenticated:
            # Assuming user has a tenant ForeignKey
            if hasattr(request.user, 'tenant'):
                return request.user.tenant

        return None

    def _resolve_from_query(self, request):
        """
        Resolve tenant from query parameter (ONLY for development).

        SECURITY: This should NEVER be enabled in production.
        """
        from .models import Tenant  # lazy import
        tenant_id = request.GET.get('_tenant')

        if tenant_id:
            try:
                return Tenant.objects.get(id=tenant_id, is_active=True)
            except (Tenant.DoesNotExist, ValueError):
                return None

        return None


def get_current_tenant():
    """
    Get current tenant from thread-local context.

    Returns:
        Tenant instance or None
    """
    from .context import _get_current_tenant
    return _get_current_tenant()
