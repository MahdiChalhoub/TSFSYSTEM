"""
Client Portal — DRF Permissions
"""
from rest_framework.permissions import BasePermission


class IsClientUser(BasePermission):
    """Allow only users with an active ClientPortalAccess."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'client_access') and \
            request.user.client_access.status == 'ACTIVE'


class HasClientPermission(BasePermission):
    """
    Check that the client user has a specific permission.
    Usage: set `client_permission` on the view, e.g.:
        client_permission = 'PLACE_ORDERS'
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'client_access'):
            return False

        access = request.user.client_access
        if access.status != 'ACTIVE':
            return False

        perm = getattr(view, 'client_permission', None)
        if not perm:
            return True

        return access.has_permission(perm)
