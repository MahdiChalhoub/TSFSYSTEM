"""
RBAC Permission Checking

Core permission checking logic.
"""

from typing import Optional
from django.contrib.auth import get_user_model
from .models import Role, UserRole, ResourcePermission
from kernel.tenancy.middleware import get_current_tenant

User = get_user_model()


def check_permission(user, permission_code: str, tenant=None) -> bool:
    """
    Check if user has a specific permission in current/specified tenant.

    Args:
        user: User instance
        permission_code: Permission code (e.g., 'finance.create_invoice')
        tenant: Optional tenant (defaults to current tenant)

    Returns:
        bool
    """
    if not user or not user.is_authenticated:
        return False

    # Superusers have all permissions
    if user.is_superuser:
        return True

    # Get tenant
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        return False

    # Get user's roles in this tenant
    user_roles = UserRole.objects.filter(
        user=user,
        tenant=tenant
    ).select_related('role').prefetch_related('role__permissions')

    # Check permissions in each role
    for user_role in user_roles:
        if not user_role.is_valid():
            continue

        if user_role.role.has_permission(permission_code):
            return True

    return False


def check_resource_permission(
    user,
    permission_code: str,
    resource_type: str,
    resource_id: int,
    tenant=None
) -> bool:
    """
    Check if user has permission on a specific resource.

    Args:
        user: User instance
        permission_code: Permission code
        resource_type: Type of resource (e.g., 'invoice', 'product')
        resource_id: ID of resource
        tenant: Optional tenant

    Returns:
        bool
    """
    # First check general permission
    if check_permission(user, permission_code, tenant):
        return True

    # Then check resource-specific permission
    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        return False

    try:
        resource_perm = ResourcePermission.objects.get(
            user=user,
            permission__code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
            tenant=tenant,
            granted=True
        )
        return True
    except ResourcePermission.DoesNotExist:
        return False


def get_user_permissions(user, tenant=None) -> list:
    """
    Get all permission codes for a user in tenant.

    Args:
        user: User instance
        tenant: Optional tenant

    Returns:
        List of permission codes
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        from .models import Permission
        return list(Permission.objects.values_list('code', flat=True))

    if tenant is None:
        tenant = get_current_tenant()

    if not tenant:
        return []

    user_roles = UserRole.objects.filter(
        user=user,
        tenant=tenant
    ).select_related('role').prefetch_related('role__permissions')

    perms = set()
    for user_role in user_roles:
        if user_role.is_valid():
            role_perms = user_role.role.get_all_permissions()
            perms.update(p.code for p in role_perms)

    return list(perms)


def has_any_permission(user, permission_codes: list, tenant=None) -> bool:
    """
    Check if user has ANY of the specified permissions.

    Args:
        user: User instance
        permission_codes: List of permission codes
        tenant: Optional tenant

    Returns:
        bool
    """
    return any(check_permission(user, code, tenant) for code in permission_codes)


def has_all_permissions(user, permission_codes: list, tenant=None) -> bool:
    """
    Check if user has ALL of the specified permissions.

    Args:
        user: User instance
        permission_codes: List of permission codes
        tenant: Optional tenant

    Returns:
        bool
    """
    return all(check_permission(user, code, tenant) for code in permission_codes)
