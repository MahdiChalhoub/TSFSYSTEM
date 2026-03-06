"""
Tenancy Context

Thread-local storage for current tenant.
Allows automatic tenant scoping in QuerySets.
"""

import threading
from contextlib import contextmanager

# Thread-local storage
_thread_locals = threading.local()


def set_current_tenant(tenant):
    """
    Set current tenant in thread-local context.

    Args:
        tenant: Tenant instance
    """
    _thread_locals.tenant = tenant


def get_current_tenant():
    """
    Get current tenant (Organization) from thread-local context.
    """
    return getattr(_thread_locals, 'tenant', None)


def clear_current_tenant():
    """
    Clear current tenant from thread-local context.
    """
    if hasattr(_thread_locals, 'tenant'):
        delattr(_thread_locals, 'tenant')


# Alias for middleware
_get_current_tenant = get_current_tenant


@contextmanager
def tenant_context(tenant):
    """
    Context manager for temporarily switching tenant.

    Useful for:
    - Background jobs
    - Admin operations
    - Testing

    Usage:
        with tenant_context(tenant):
            Invoice.objects.all()  # Scoped to tenant
    """
    previous_tenant = get_current_tenant()

    try:
        set_current_tenant(tenant)
        yield tenant
    finally:
        if previous_tenant:
            set_current_tenant(previous_tenant)
        else:
            clear_current_tenant()


@contextmanager
def switch_tenant(tenant):
    """
    Alias for tenant_context (more intuitive name).

    Usage:
        with switch_tenant(other_tenant):
            # All queries scoped to other_tenant
            invoices = Invoice.objects.all()
    """
    with tenant_context(tenant):
        yield tenant


@contextmanager
def no_tenant_context():
    """
    Context manager for disabling tenant scoping.

    Use with EXTREME CAUTION - only for system-level operations.

    Usage:
        with no_tenant_context():
            # Queries all tenants
            all_invoices = Invoice.all_objects.all()
    """
    previous_tenant = get_current_tenant()

    try:
        clear_current_tenant()
        yield
    finally:
        if previous_tenant:
            set_current_tenant(previous_tenant)
