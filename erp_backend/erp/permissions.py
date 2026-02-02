from rest_framework import permissions

class IsOrgAdmin(permissions.BasePermission):
    """
    Custom permission to only allow organization admins to access the view.
    """
    def has_permission(self, request, view):
        # 1. User must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
            
        # 2. User must have a role
        if not request.user.role:
            return False
            
        # 3. Role must be admin (checking name 'Super Admin' for now, or a flag)
        # Ideally, we should have a flag on the Role model like 'is_admin' or check specific permissions.
        # For this basic restart, checking if role name contains 'Admin' or explicitly 'Super Admin'.
        return "Admin" in request.user.role.name
