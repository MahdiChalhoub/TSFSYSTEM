"""
Tenancy Context

Thread-local storage for current organization.
Allows automatic organization scoping in QuerySets.
"""

import threading
from contextlib import contextmanager

# Thread-local storage
_thread_locals = threading.local()


def set_current_tenant(organization):
    """
    Set current organization in thread-local context.

    Args:
        organization: Tenant instance
    """
    _thread_locals.organization = organization


def get_current_tenant():
    """
    Get current organization (Organization) from thread-local context.
    """
    return getattr(_thread_locals, 'organization', None)


def clear_current_tenant():
    """
    Clear current organization from thread-local context.
    """
    if hasattr(_thread_locals, 'organization'):
        delattr(_thread_locals, 'organization')


# Alias for middleware
_get_current_tenant = get_current_tenant


@contextmanager
def tenant_context(organization):
    """
    Context manager for temporarily switching organization.

    Useful for:
    - Background jobs
    - Admin operations
    - Testing

    Usage:
        with tenant_context(organization):
            Invoice.objects.all()  # Scoped to organization
    """
    previous_tenant = get_current_tenant()

    try:
        set_current_tenant(organization)
        yield organization
    finally:
        if previous_tenant:
            set_current_tenant(previous_tenant)
        else:
            clear_current_tenant()


@contextmanager
def switch_tenant(organization):
    """
    Alias for tenant_context (more intuitive name).

    Usage:
        with switch_tenant(other_tenant):
            # All queries scoped to other_tenant
            invoices = Invoice.objects.all()
    """
    with tenant_context(organization):
        yield organization


@contextmanager
def no_tenant_context():
    """
    Context manager for disabling organization scoping.

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
