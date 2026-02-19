"""
Supplier Portal — DRF Permissions
"""
from rest_framework.permissions import BasePermission


class IsSupplierUser(BasePermission):
    """Allow only users with an active SupplierPortalAccess."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'supplier_access') and \
            request.user.supplier_access.status == 'ACTIVE'


class HasSupplierPermission(BasePermission):
    """
    Check that the supplier user has a specific permission.
    Usage: set `supplier_permission` on the view, e.g.:
        supplier_permission = 'VIEW_OWN_ORDERS'
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'supplier_access'):
            return False

        access = request.user.supplier_access
        if access.status != 'ACTIVE':
            return False

        perm = getattr(view, 'supplier_permission', None)
        if not perm:
            return True  # No specific permission required

        return access.has_permission(perm)
