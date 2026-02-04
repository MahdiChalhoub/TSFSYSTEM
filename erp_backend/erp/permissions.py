from rest_framework import permissions
from functools import wraps


class IsOrgAdmin(permissions.BasePermission):
    """
    Custom permission to only allow organization admins to access the view.
    """
    def has_permission(self, request, view):
        # 1. Platform Admins (Superusers) bypass role checks
        if request.user.is_superuser or request.user.is_staff:
            return True

        # 2. Regular users must have a role
        if not request.user.role:
            return False
            
        # 3. Role must be admin
        return "Admin" in request.user.role.name


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission to only allow platform superadmins.
    Used for Connector configuration and system-level operations.
    """
    def has_permission(self, request, view):
        return request.user.is_superuser or request.user.is_staff


class HasPermission(permissions.BasePermission):
    """
    Granular permission check using the Permission Registry pattern.
    
    Usage in ViewSet:
        permission_classes = [IsAuthenticated, HasPermission]
        required_permissions = {
            'list': 'inventory.view_products',
            'create': 'inventory.add_product',
            'update': 'inventory.edit_product',
            'destroy': 'inventory.delete_product',
        }
    """
    def has_permission(self, request, view):
        # Superusers bypass all checks
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        # Get the required permission for this action
        required_permissions = getattr(view, 'required_permissions', {})
        action = getattr(view, 'action', None)
        
        if not action or action not in required_permissions:
            # No permission defined for this action, allow by default
            return True
        
        required_code = required_permissions[action]
        return self.user_has_permission(request.user, required_code)
    
    @staticmethod
    def user_has_permission(user, permission_code):
        """Check if a user has a specific permission."""
        if not user or not user.role:
            return False
        
        # Check if the role has this permission
        return user.role.permissions.filter(code=permission_code).exists()


def permission_required(permission_code):
    """
    Decorator for ViewSet actions to require a specific permission.
    
    Usage:
        @action(detail=True, methods=['post'])
        @permission_required('inventory.adjust_stock')
        def adjust_stock(self, request, pk=None):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            # Superusers bypass
            if request.user.is_superuser or request.user.is_staff:
                return func(self, request, *args, **kwargs)
            
            # Check permission
            if not HasPermission.user_has_permission(request.user, permission_code):
                from rest_framework.response import Response
                from rest_framework import status
                return Response(
                    {'error': f'Permission denied: {permission_code} required'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return func(self, request, *args, **kwargs)
        return wrapper
    return decorator


def get_user_permissions(user):
    """
    Get all permission codes for a user.
    Useful for sending to the frontend.
    """
    if not user or not user.role:
        return []
    
    return list(user.role.permissions.values_list('code', flat=True))

