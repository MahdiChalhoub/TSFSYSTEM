"""
RBAC Permission Checking

Core permission checking logic.
"""

from typing import Optional
from django.contrib.auth import get_user_model
from .models import Role, UserRole, ResourcePermission
from kernel.tenancy.middleware import get_current_tenant

User = get_user_model()


def check_permission(user, permission_code: str, organization=None) -> bool:
    """
    Check if user has a specific permission in current/specified organization.

    Args:
        user: User instance
        permission_code: Permission code (e.g., 'finance.create_invoice')
        organization: Optional organization (defaults to current organization)

    Returns:
        bool
    """
    if not user or not user.is_authenticated:
        return False

    # Superusers have all permissions
    if user.is_superuser:
        return True

    # Get organization
    if organization is None:
        organization = get_current_tenant()

    if not organization:
        return False

    # Get user's roles in this organization
    user_roles = UserRole.objects.filter(
        user=user,
        organization=organization
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
    organization=None
) -> bool:
    """
    Check if user has permission on a specific resource.

    Args:
        user: User instance
        permission_code: Permission code
        resource_type: Type of resource (e.g., 'invoice', 'product')
        resource_id: ID of resource
        organization: Optional organization

    Returns:
        bool
    """
    # First check general permission
    if check_permission(user, permission_code, organization):
        return True

    # Then check resource-specific permission
    if organization is None:
        organization = get_current_tenant()

    if not organization:
        return False

    try:
        resource_perm = ResourcePermission.objects.get(
            user=user,
            permission__code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
            organization=organization,
            granted=True
        )
        return True
    except ResourcePermission.DoesNotExist:
        return False


def get_user_permissions(user, organization=None) -> list:
    """
    Get all permission codes for a user in organization.

    Args:
        user: User instance
        organization: Optional organization

    Returns:
        List of permission codes
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        from .models import Permission
        return list(Permission.objects.values_list('code', flat=True))

    if organization is None:
        organization = get_current_tenant()

    if not organization:
        return []

    user_roles = UserRole.objects.filter(
        user=user,
        organization=organization
    ).select_related('role').prefetch_related('role__permissions')

    perms = set()
    for user_role in user_roles:
        if user_role.is_valid():
            role_perms = user_role.role.get_all_permissions()
            perms.update(p.code for p in role_perms)

    return list(perms)


def has_any_permission(user, permission_codes: list, organization=None) -> bool:
    """
    Check if user has ANY of the specified permissions.

    Args:
        user: User instance
        permission_codes: List of permission codes
        organization: Optional organization

    Returns:
        bool
    """
    return any(check_permission(user, code, organization) for code in permission_codes)


def has_all_permissions(user, permission_codes: list, organization=None) -> bool:
    """
    Check if user has ALL of the specified permissions.

    Args:
        user: User instance
        permission_codes: List of permission codes
        organization: Optional organization

    Returns:
        bool
    """
    return all(check_permission(user, code, organization) for code in permission_codes)
