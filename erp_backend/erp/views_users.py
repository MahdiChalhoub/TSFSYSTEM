"""
Kernel Views — Infrastructure & Cross-Cutting Concerns Only
============================================================
This file contains ONLY the kernel-level ViewSets:
 - TenantModelViewSet (base class for all tenant-scoped views, with AuditLogMixin)
 - UserViewSet, OrganizationViewSet, SiteViewSet, CountryViewSet, RoleViewSet
 - TenantResolutionView, SettingsViewSet, DashboardViewSet, health_check

All business-domain ViewSets live in their canonical module locations:
 - apps.finance.views
 - apps.inventory.views
 - apps.pos.views
 - apps.crm.views
 - apps.hr.views

Backward-compatible re-exports are provided at the bottom of this file.
"""
from django.db import transaction
from django.db.models import Q, Sum, F, Avg
from rest_framework import viewsets, status, serializers, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from django.utils import timezone
from .middleware import get_current_tenant_id
from .mixins import AuditLogMixin, TenantFilterMixin, UDLEViewSetMixin
from .throttles import TenantResolveRateThrottle

# --- Kernel Models ---
from .models import (
    Organization, Site, User, Country, Role, Permission,
    SystemModule, OrganizationModule, GlobalCurrency,
    ManagerOverrideLog, Notification
)

# --- Business Module Models (optional — modules may be uninstalled) ---
try:
    from .models import FinancialAccount, ChartOfAccount, JournalEntryLine, Transaction
except ImportError:
    FinancialAccount = ChartOfAccount = JournalEntryLine = Transaction = None

try:
    from .models import Product, Inventory, OrderLine, Brand
except ImportError:
    Product = Inventory = OrderLine = Brand = None

try:
    from .models import Contact
except ImportError:
    Contact = None
# --- Kernel Serializers ---
from .serializers import (
    OrganizationSerializer, SiteSerializer, UserSerializer,
    CountrySerializer, RoleSerializer, NotificationSerializer, PermissionSerializer,
)
from .serializers.core import GlobalCurrencySerializer
try:
    from .serializers import ProductSerializer, BrandSerializer
except ImportError:
    ProductSerializer = BrandSerializer = None

# --- Kernel Services ---
from .services import ProvisioningService, ConfigurationService
try:
    from .services import LedgerService, InventoryService
except ImportError:
    LedgerService = InventoryService = None

# ============================================================================
#  KERNEL BASE CLASS
# ============================================================================


from .views_base import TenantModelViewSet

class UserViewSet(TenantModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    pagination_class = None  # User model uses date_joined, not created_at — skip cursor pagination


    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by registration_status if provided
        status_filter = self.request.query_params.get('registration_status')
        if status_filter:
            qs = qs.filter(registration_status=status_filter)
        # Filter by is_driver tag (e.g. ?is_driver=true)
        is_driver = self.request.query_params.get('is_driver')
        if is_driver is not None:
            qs = qs.filter(is_driver=(is_driver.lower() == 'true'))
        # Filter by role name (e.g. ?role=Admin) — kept for admin tooling
        role_name = self.request.query_params.get('role')
        if role_name:
            qs = qs.filter(role__name__iexact=role_name)
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() == 'true'))
        return qs

    @action(detail=True, methods=['post'], url_path='set-scope-pin')
    def set_scope_pin(self, request, pk=None):
        """Admin-only: Set or clear a scope PIN for a user.
        Body: { "scope": "official"|"internal", "pin": "1234" | null }
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        scope = request.data.get('scope', '').lower()
        pin = request.data.get('pin')

        if scope not in ('official', 'internal'):
            return Response({"error": "Scope must be 'official' or 'internal'"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_scope_pin(scope, pin)
        user.save(update_fields=[f'scope_pin_{scope}'])

        action_label = 'set' if pin else 'cleared'
        return Response({"message": f"{scope.title()} PIN {action_label} for {user.username}"})

    @action(detail=False, methods=['post'], url_path='verify-scope-pin')
    def verify_scope_pin(self, request):
        """Verify the current user's scope PIN.
        Body: { "scope": "official"|"internal", "pin": "1234" }
        Returns: { "verified": true/false, "has_pin": true/false }
        
        Scope semantics:
          - official PIN → user sees ONLY Official data (no toggle, Internal is invisible)
          - internal PIN → user sees BOTH scopes with toggle
        """
        user = request.user
        scope = request.data.get('scope', '').lower()
        pin = request.data.get('pin', '')

        if scope not in ('official', 'internal'):
            return Response({"error": "Scope must be 'official' or 'internal'"}, status=status.HTTP_400_BAD_REQUEST)

        has_pin = bool(getattr(user, f'scope_pin_{scope}', None))

        if not has_pin:
            return Response({"verified": True, "has_pin": False})

        verified = user.check_scope_pin(scope, pin)
        return Response({"verified": verified, "has_pin": True})

    @action(detail=False, methods=['get'], url_path='my-permissions')
    def my_permissions(self, request):
        """Return the current user's permissions based on their role.
        Used by the frontend RBAC system (kernel/permissions.ts).
        GET /api/users/my-permissions/
        Returns: { "permissions": ["inventory.view_products", ...], "role": "Admin" }
        """
        user = request.user
        if not user.is_authenticated:
            return Response({"permissions": [], "role": None})

        # Superusers get all permissions
        if user.is_superuser:
            all_perms = list(Permission.objects.values_list('code', flat=True))
            return Response({"permissions": all_perms, "role": "superuser", "is_superuser": True})

        # Get permissions from user's role
        role = user.role
        if role:
            perms = list(role.permissions.values_list('code', flat=True))
            return Response({"permissions": perms, "role": role.name, "is_superuser": False})

        return Response({"permissions": [], "role": None, "is_superuser": False})

    @action(detail=False, methods=['get'], url_path='permissions-matrix')
    def permissions_matrix(self, request):
        """
        Return a matrix of all users and their assigned permissions in the current org.
        Also returns the available SALES_PERMISSION_CODES for generating the UI headers.
        """
        from apps.pos.services.permission_service import SALES_PERMISSION_CODES
        
        users = self.get_queryset().select_related('role').prefetch_related('role__permissions')
        
        user_list = []
        for u in users:
            # Superusers implicitly have all permissions
            if u.is_superuser:
                codes = list(SALES_PERMISSION_CODES.keys())
            elif u.role:
                codes = list(u.role.permissions.values_list('code', flat=True))
            else:
                codes = []
                
            user_list.append({
                'id': u.id,
                'username': u.username,
                'is_superuser': u.is_superuser,
                'role_name': u.role.name if u.role else None,
                'permissions': codes
            })
            
        return Response({
            'available_permissions': SALES_PERMISSION_CODES,
            'users': user_list
        })

    @action(detail=False, methods=['post'], url_path='update-permissions')
    def update_permissions(self, request):
        """
        Admin action to update a user's permissions.
        Because TSFSYSTEM relies on Roles, we create/assign a custom role for the user 
        if their permissions deviate from standard roles.
        Body: { "user_id": 5, "permissions": ["sales.confirm_order", ...] }
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)
            
        user_id = request.data.get('user_id')
        perm_codes = request.data.get('permissions', [])
        
        try:
            target_user = self.get_queryset().get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if target_user.is_superuser:
            return Response({"error": "Cannot modify permissions of a superuser"}, status=status.HTTP_400_BAD_REQUEST)
            
        from erp.models import Role, Permission
        
        # 1. Fetch requested permission objects
        new_perms = Permission.objects.filter(code__in=perm_codes)
        
        # 2. Check if a role already exists with EXACTLY these permissions
        # (For simplicity and to avoid thousands of roles, we'll create a "Custom: {user}" role if needed)
        custom_role_name = f"Custom Role - {target_user.username}"
        
        with transaction.atomic():
            role, created = Role.objects.get_or_create(
                organization=target_user.organization,
                name=custom_role_name,
                defaults={'description': f'Custom role specific to {target_user.username}'}
            )
            
            # Sync permissions
            role.permissions.set(new_perms)
            
            # Assign role to user
            target_user.role = role
            target_user.save(update_fields=['role'])
            
        return Response({"message": f"Permissions updated for {target_user.username}", "role": role.name})

    @action(detail=True, methods=['post'], url_path='set-override-pin')
    def set_override_pin(self, request, pk=None):
        """Admin-only: Set or clear a manager override PIN.
        Body: { "pin": "1234" | null }
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

        user = self.get_object()
        pin = request.data.get('pin')
        user.set_override_pin(pin)
        user.save(update_fields=['override_pin'])

        label = 'set' if pin else 'cleared'
        return Response({"message": f"Override PIN {label} for {user.username}", "has_override_pin": bool(pin)})

    @action(detail=False, methods=['post'], url_path='verify-override')
    def verify_override(self, request):
        """Verify a manager override PIN and log the action.
        Body: { "pin": "1234", "action": "VOID_ORDER", "order_id": 5, "details": "..." }
        Returns: { "verified": true/false }
        """
        pin = request.data.get('pin', '')
        override_action = request.data.get('action', 'OTHER')
        order_id = request.data.get('order_id')
        details = request.data.get('details', '')

        user = request.user
        verified = user.check_override_pin(pin) if hasattr(user, 'check_override_pin') else False

        if verified:
            # Log the override
            ManagerOverrideLog.objects.create(
                organization=user.organization,
                action=override_action,
                manager=user,
                order_id=order_id,
                details=details,
                ip_address=request.META.get('REMOTE_ADDR'),
            )

        return Response({"verified": verified})

    @action(detail=False, methods=['get'], url_path='override-log')
    def override_log(self, request):
        """Get recent manager override log entries."""
        logs = ManagerOverrideLog.objects.filter(
            organization=request.user.organization
        ).select_related('manager').order_by('-performed_at')[:50]
        data = [{
            'id': log.id,
            'action': log.action,
            'action_display': log.get_action_display(),
            'manager_name': str(log.manager) if log.manager else None,
            'order_id': log.order_id,
            'details': log.details,
            'performed_at': log.performed_at.isoformat() if log.performed_at else None,
        } for log in logs]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """SaaS Admin: Approve a pending business registration."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        user.registration_status = 'APPROVED'
        user.is_active = True
        user.save(update_fields=['registration_status', 'is_active'])

        # Create a notification for the user
        Notification.objects.create(
            user=user,
            title="Account Approved",
            message=f"Welcome! Your workspace '{user.organization.name}' has been approved.",
            type='SUCCESS'
        )

        return Response({"message": f"User {user.username} approved."})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """SaaS Admin: Reject a pending business registration."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        user.registration_status = 'REJECTED'
        user.is_active = False
        user.save(update_fields=['registration_status', 'is_active'])
        return Response({"message": f"User {user.username} rejected."})

    @action(detail=True, methods=['post'], url_path='request-correction')
    def request_correction(self, request, pk=None):
        """SaaS Admin: Request corrections on a business registration."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        
        notes = request.data.get('notes', '')
        if not notes:
            return Response({"error": "Correction notes are required"}, status=status.HTTP_400_BAD_REQUEST)

        user = self.get_object()
        user.registration_status = 'CORRECTION_NEEDED'
        user.correction_notes = notes
        user.save(update_fields=['registration_status', 'correction_notes'])

        Notification.objects.create(
            user=user,
            title="Correction Needed",
            message=f"Please update your registration: {notes}",
            type='WARNING'
        )

        return Response({"message": f"Correction requested for {user.username}."})
class RoleViewSet(TenantModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List all available permissions in the system.
    Used by the Role Manager UI.
    """
    queryset = Permission.objects.all().order_by('code')
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow filtering by module/prefix if needed
        qs = super().get_queryset()
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(code__startswith=f"{module}.")
        return qs
