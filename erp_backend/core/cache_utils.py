"""
Tenant-Scoped Cache Utilities
=============================
All cache keys are prefixed with org_id to prevent cross-tenant data leaks.
This follows the multi-tenancy isolation rules from architecture.md.

Usage:
    from core.cache_utils import get_cached, set_cached, cached_per_tenant

    # Simple get/set
    products = get_cached(org_id, 'products', 'list_page_1')
    set_cached(org_id, 'products', 'list_page_1', data, timeout=300)

    # Decorator for DRF ViewSet methods
    @cached_per_tenant('products', key_func=lambda r: r.query_params.get('page', '1'))
    def list(self, request, *args, **kwargs):
        ...
"""
import functools
from django.core.cache import cache


def tenant_cache_key(org_id, namespace, key):
    """Build a tenant-scoped cache key."""
    return f"org:{org_id}:{namespace}:{key}"


def get_cached(org_id, namespace, key, default=None):
    """Get a value from tenant-scoped cache."""
    return cache.get(tenant_cache_key(org_id, namespace, key), default)


def set_cached(org_id, namespace, key, value, timeout=300):
    """Set a value in tenant-scoped cache."""
    cache.set(tenant_cache_key(org_id, namespace, key), value, timeout)


def delete_cached(org_id, namespace, key):
    """Delete a value from tenant-scoped cache."""
    cache.delete(tenant_cache_key(org_id, namespace, key))


def invalidate_namespace(org_id, namespace):
    """
    Invalidate all keys in a namespace for a tenant.
    Uses cache versioning — bump the version key to invalidate.
    """
    version_key = f"org:{org_id}:{namespace}:__version__"
    current = cache.get(version_key, 0)
    cache.set(version_key, current + 1, timeout=86400)


def cached_per_tenant(namespace, key_func=None, timeout=300):
    """
    Decorator for DRF ViewSet methods. Caches response per-tenant.

    Usage:
        @cached_per_tenant('products', key_func=lambda r: r.query_params.get('page', '1'))
        def list(self, request, *args, **kwargs):
            ...
    """
    from rest_framework.response import Response

    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            org_id = getattr(request, 'tenant_id', None) or getattr(
                request.user, 'organization_id', None
            )
            if not org_id:
                return view_func(self, request, *args, **kwargs)

            extra = key_func(request) if key_func else ''
            ck = tenant_cache_key(org_id, namespace, f"{view_func.__name__}:{extra}")

            cached_data = cache.get(ck)
            if cached_data is not None:
                return Response(cached_data)

            response = view_func(self, request, *args, **kwargs)
            if response.status_code == 200:
                cache.set(ck, response.data, timeout)
            return response
        return wrapper
    return decorator
