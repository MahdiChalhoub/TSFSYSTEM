from rest_framework import permissions

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
