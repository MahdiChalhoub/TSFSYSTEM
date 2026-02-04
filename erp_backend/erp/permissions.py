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


# ============================================
# Base Module Permission Class
# ============================================

class BaseModulePermission(permissions.BasePermission):
    """
    Base class for module-specific permissions.
    Checks if user has the required permission code via role.
    """
    permission_code = None  # Override in subclass
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers always have access
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        # Check for permission code in user's role
        if self.permission_code:
            return self._check_permission(request.user, self.permission_code)
        
        return True
    
    def _check_permission(self, user, permission_code):
        """Check if user has the specific permission via their role."""
        if not hasattr(user, 'role') or not user.role:
            return False
        
        role = user.role
        
        # Check role permissions (stored as M2M or JSON)
        if hasattr(role, 'permissions'):
            perms = role.permissions
            if hasattr(perms, 'filter'):
                # M2M relationship
                return perms.filter(code=permission_code).exists()
            elif isinstance(perms, list):
                return permission_code in perms
            elif isinstance(perms, dict):
                return perms.get(permission_code, False)
        
        return False


# ============================================
# Finance/Accounting Module Permissions
# ============================================

class CanViewFinance(BaseModulePermission):
    """Permission to view financial data (COA, reports, etc.)"""
    permission_code = 'finance.view'
    message = 'You do not have permission to view financial data.'


class CanManageFinance(BaseModulePermission):
    """Permission to create/edit/delete financial records."""
    permission_code = 'finance.manage'
    message = 'You do not have permission to manage financial data.'


class CanPostJournalEntries(BaseModulePermission):
    """Permission to post journal entries."""
    permission_code = 'finance.post_entries'
    message = 'You do not have permission to post journal entries.'


class CanCloseAccounting(BaseModulePermission):
    """Permission to close fiscal periods/years."""
    permission_code = 'finance.close_period'
    message = 'You do not have permission to close accounting periods.'


# ============================================
# Inventory Module Permissions
# ============================================

class CanViewInventory(BaseModulePermission):
    """Permission to view inventory data."""
    permission_code = 'inventory.view'
    message = 'You do not have permission to view inventory.'


class CanManageInventory(BaseModulePermission):
    """Permission to manage inventory (create/edit products, adjust stock)."""
    permission_code = 'inventory.manage'
    message = 'You do not have permission to manage inventory.'


class CanAdjustStock(BaseModulePermission):
    """Permission to perform stock adjustments."""
    permission_code = 'inventory.adjust'
    message = 'You do not have permission to adjust stock levels.'


class CanTransferStock(BaseModulePermission):
    """Permission to transfer stock between warehouses."""
    permission_code = 'inventory.transfer'
    message = 'You do not have permission to transfer stock.'


# ============================================
# POS Module Permissions
# ============================================

class CanAccessPOS(BaseModulePermission):
    """Permission to access POS terminal."""
    permission_code = 'pos.access'
    message = 'You do not have permission to access the POS terminal.'


class CanProcessSales(BaseModulePermission):
    """Permission to process sales transactions."""
    permission_code = 'pos.process_sales'
    message = 'You do not have permission to process sales.'


class CanVoidSale(BaseModulePermission):
    """Permission to void sales transactions."""
    permission_code = 'pos.void'
    message = 'You do not have permission to void sales.'


class CanApplyDiscount(BaseModulePermission):
    """Permission to apply discounts."""
    permission_code = 'pos.discount'
    message = 'You do not have permission to apply discounts.'


class CanRefund(BaseModulePermission):
    """Permission to process refunds."""
    permission_code = 'pos.refund'
    message = 'You do not have permission to process refunds.'


# ============================================
# HR Module Permissions
# ============================================

class CanViewHR(BaseModulePermission):
    """Permission to view employee data."""
    permission_code = 'hr.view'
    message = 'You do not have permission to view HR data.'


class CanManageHR(BaseModulePermission):
    """Permission to manage employees/roles."""
    permission_code = 'hr.manage'
    message = 'You do not have permission to manage HR data.'


class CanViewSalary(BaseModulePermission):
    """Permission to view salary information."""
    permission_code = 'hr.view_salary'
    message = 'You do not have permission to view salary information.'


class CanManagePayroll(BaseModulePermission):
    """Permission to manage payroll."""
    permission_code = 'hr.payroll'
    message = 'You do not have permission to manage payroll.'


# ============================================
# CRM Module Permissions
# ============================================

class CanViewCRM(BaseModulePermission):
    """Permission to view CRM data (contacts, leads)."""
    permission_code = 'crm.view'
    message = 'You do not have permission to view CRM data.'


class CanManageCRM(BaseModulePermission):
    """Permission to manage CRM records."""
    permission_code = 'crm.manage'
    message = 'You do not have permission to manage CRM data.'


class CanManageLeads(BaseModulePermission):
    """Permission to manage sales leads."""
    permission_code = 'crm.leads'
    message = 'You do not have permission to manage leads.'


# ============================================
# Purchasing Module Permissions
# ============================================

class CanViewPurchasing(BaseModulePermission):
    """Permission to view purchase orders."""
    permission_code = 'purchase.view'
    message = 'You do not have permission to view purchases.'


class CanCreatePO(BaseModulePermission):
    """Permission to create purchase orders."""
    permission_code = 'purchase.create'
    message = 'You do not have permission to create purchase orders.'


class CanApprovePO(BaseModulePermission):
    """Permission to approve purchase orders."""
    permission_code = 'purchase.approve'
    message = 'You do not have permission to approve purchase orders.'


class CanReceiveGoods(BaseModulePermission):
    """Permission to receive goods against POs."""
    permission_code = 'purchase.receive'
    message = 'You do not have permission to receive goods.'


# ============================================
# Admin/System Permissions
# ============================================

class IsSaaSAdmin(permissions.BasePermission):
    """
    Permission for SaaS platform administrators.
    Checks if user belongs to the 'saas' organization.
    """
    message = 'You must be a SaaS administrator to perform this action.'
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Check if user belongs to 'saas' organization
        from .models import Organization
        try:
            saas_org = Organization.objects.get(slug='saas')
            if hasattr(request.user, 'organization_id'):
                return request.user.organization_id == saas_org.id
        except Organization.DoesNotExist:
            pass
        
        return False


class CanManageSettings(BaseModulePermission):
    """Permission to manage system settings."""
    permission_code = 'settings.manage'
    message = 'You do not have permission to manage settings.'


# ============================================
# Composite Permission Classes
# ============================================

class ReadOnlyOrManage(permissions.BasePermission):
    """
    Allows read-only access for view permission,
    requires manage permission for write operations.
    """
    view_permission_class = None  # Override
    manage_permission_class = None  # Override
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            if self.view_permission_class:
                return self.view_permission_class().has_permission(request, view)
            return True
        else:
            if self.manage_permission_class:
                return self.manage_permission_class().has_permission(request, view)
            return False


class FinanceReadOnlyOrManage(ReadOnlyOrManage):
    view_permission_class = CanViewFinance
    manage_permission_class = CanManageFinance


class InventoryReadOnlyOrManage(ReadOnlyOrManage):
    view_permission_class = CanViewInventory
    manage_permission_class = CanManageInventory


class HRReadOnlyOrManage(ReadOnlyOrManage):
    view_permission_class = CanViewHR
    manage_permission_class = CanManageHR


class CRMReadOnlyOrManage(ReadOnlyOrManage):
    view_permission_class = CanViewCRM
    manage_permission_class = CanManageCRM
