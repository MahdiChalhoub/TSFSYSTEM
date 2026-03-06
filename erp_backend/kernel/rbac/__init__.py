"""
RBAC Engine — role-based access control.

Import guide:
    from kernel.rbac import require_permission, check_permission
    from kernel.rbac.models import Role, Permission, UserRole  # if model access needed
"""

# NOTE: Role/Permission/UserRole are concrete models — NOT imported here.
# Import from kernel.rbac.models directly to avoid AppRegistryNotReady.

from .decorators import require_permission, require_any_permission, require_all_permissions  # noqa: F401
from .permissions import check_permission, check_resource_permission  # noqa: F401
from .policies import PolicyEngine, register_policy  # noqa: F401

__all__ = [
    'require_permission',
    'require_any_permission',
    'require_all_permissions',
    'check_permission',
    'check_resource_permission',
    'PolicyEngine',
    'register_policy',
]
