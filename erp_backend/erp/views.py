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
from django.db.models import Q, Sum, F
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

class TenantModelViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Base ViewSet that automatically enforces organizational isolation (multi-tenancy).
    Ensures users can ONLY interact with data belonging to their own organization.
    
    DAJINGO RULES ENFORCED:
    - Rule 3: All queries MUST be scoped by organization_id.
    - Rule 5: organization_id derived from auth user context or secure tenant header.
    - Rule 6: APIs automatically inject organization_id; manual override forbidden.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        tenant_id = get_current_tenant_id()

        # 1. Global Platform Admin Access (Managed Scope)
        if user.is_staff or user.is_superuser:
            if tenant_id and hasattr(self.queryset.model, 'organization'):
                return self.queryset.filter(organization=tenant_id)
            # SaaS Root & Global Admin: Allow cross-tenant data visibility
            return self.queryset.all()
        
        # 2. Strict Tenant Isolation for Regular Users
        if not user.organization_id:
             return self.queryset.none()
        
        if hasattr(self.queryset.model, 'organization'):
            return self.queryset.filter(organization=user.organization_id)
        return self.queryset.all()

    def perform_create(self, serializer):
        user = self.request.user
        header_tenant_id = get_current_tenant_id()
        
        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
             raise serializers.ValidationError({
                 "error": "Organization context missing. Please ensure you are within a valid tenant environment."
             })
        serializer.save(organization_id=organization_id)

    def perform_update(self, serializer):
        if 'organization' in self.request.data or 'organization_id' in self.request.data:
             pass 
        super().perform_update(serializer)  # Triggers AuditLogMixin

    def perform_destroy(self, instance):
        super().perform_destroy(instance)  # Triggers AuditLogMixin

# ============================================================================
#  KERNEL VIEWSETS
# ============================================================================

class UserViewSet(TenantModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        # Extend base scoping with registration_status filtering for the SaaS Admin queue
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('registration_status')
        if status_filter:
            qs = qs.filter(registration_status=status_filter)
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


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Endpoints for current user notifications.
    [RESILIENCE] Wrapped with try/except to prevent 500 HTML errors on SaaS pages
    where tenant context may not be fully resolved.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        try:
            return Notification.objects.filter(user=self.request.user)
        except Exception:
            return Notification.objects.none()

    def list(self, request, *args, **kwargs):
        """Resilient list — returns empty array on any backend error."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import logging
            logging.getLogger('erp').warning(f"NotificationViewSet.list failed: {e}")
            return Response([], status=200)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        try:
            Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        except Exception:
            pass
        return Response({"message": "All notifications marked as read."})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.mark_as_read()
        return Response({"message": "Notification marked as read."})

    @action(detail=False, methods=['get'], url_path='preferences')
    def get_preferences(self, request):
        """Get notification preferences for the current user."""
        from erp.notification_service import NotificationService
        prefs = NotificationService.get_user_preferences(request.user)
        return Response(prefs)

    @action(detail=False, methods=['post'], url_path='update-preference')
    def update_preference(self, request):
        """Update a single notification preference.
        Body: { "notification_type": "invoice_overdue", "channel": "EMAIL", "is_enabled": true }
        """
        from erp.notification_service import NotificationService
        ntype = request.data.get('notification_type')
        channel = request.data.get('channel')
        is_enabled = request.data.get('is_enabled', True)
        if not ntype or not channel:
            return Response({"error": "notification_type and channel are required"}, status=400)
        pref = NotificationService.update_preference(request.user, ntype, channel, is_enabled)
        return Response({
            "notification_type": pref.notification_type,
            "channel": pref.channel,
            "is_enabled": pref.is_enabled,
        })

    @action(detail=False, methods=['get'], url_path='delivery-log')
    def delivery_log(self, request):
        """Get notification delivery log for the current user."""
        from erp.notification_models import NotificationLog
        logs = NotificationLog.objects.filter(user=request.user)[:50]
        data = [{
            'id': log.id,
            'channel': log.channel,
            'subject': log.subject,
            'status': log.status,
            'sent_at': log.sent_at.isoformat() if log.sent_at else None,
            'created_at': log.created_at.isoformat() if log.created_at else None,
        } for log in logs]
        return Response(data)


class TenantResolutionView(viewsets.ViewSet):
    """
    Public endpoint to resolve tenant slug to ID.
    Used by Next.js middleware/context to avoid direct DB access.
    """
    permission_classes = [] 
    authentication_classes = []
    throttle_classes = [TenantResolveRateThrottle]

    @action(detail=False, methods=['get'])
    def resolve(self, request):
        slug = request.query_params.get('slug')
        if not slug:
            return Response({"error": "Slug required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = Organization.objects.get(slug=slug)
            return Response({
                "id": str(org.id),
                "slug": org.slug,
                "name": org.name
            })
        except Organization.DoesNotExist:
            return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)


class SettingsViewSet(viewsets.ViewSet):
    """Handles system-wide configuration."""
    @action(detail=False, methods=['get', 'post'])
    def posting_rules(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_posting_rules(organization, request.data)
            return Response({"message": "Posting rules saved successfully"})
        
        rules = ConfigurationService.get_posting_rules(organization)
        return Response(rules)

    @action(detail=False, methods=['post'])
    def smart_apply(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        config = ConfigurationService.apply_smart_posting_rules(organization)
        return Response(config)

    @action(detail=False, methods=['get', 'post'])
    def global_financial(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_global_settings(organization, request.data)
            return Response({"message": "Settings saved successfully"})
        
        settings = ConfigurationService.get_global_settings(organization)
        return Response(settings)

    @action(detail=False, methods=['get', 'post'], url_path='item/(?P<key>[^/.]+)')
    def item(self, request, key=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        if request.method == 'POST':
            ConfigurationService.save_setting(organization, key, request.data)
            return Response({"message": f"Setting '{key}' saved successfully"})
        
        value = ConfigurationService.get_setting(organization, key)
        return Response(value)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    from erp.latency_middleware import LatencyStore
    store = LatencyStore()
    latency = store.get_stats()

    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None'),
        "organization_id": get_current_tenant_id(),
        "latency": {
            "avg_ms": latency['avg_ms'],
            "p50_ms": latency['p50_ms'],
            "p95_ms": latency['p95_ms'],
            "p99_ms": latency['p99_ms'],
            "max_ms": latency['max_ms'],
            "min_ms": latency.get('min_ms', 0),
        },
        "traffic": {
            "total_requests": latency['total_requests'],
            "tracked_window": latency['tracked_window'],
            "requests_last_5min": latency.get('requests_last_5min', 0),
            "status_breakdown": latency.get('status_breakdown', {}),
        },
        "slow_endpoints": latency.get('slow_endpoints', []),
        "uptime_seconds": latency.get('uptime_seconds', 0),
    })


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    SaaS level view of organizations.
    Admin staff can see all. Regular users see only their bound org.
    
    Permissions:
      - LIST/RETRIEVE: Authenticated (scoped by role)
      - CREATE/UPDATE/DELETE: Staff or Superuser only
    
    Delete Safety Rules:
      1. Cannot delete the master SaaS organization (slug='saas')
      2. Must deactivate first (is_active=False)
      3. After deactivation, must wait 24 hours before deletion
      4. If org has data, deletion is blocked (must backup first)
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        user = self.request.user
        
        # 1. PLATFORM ADMIN (Global SaaS View)
        if user.is_superuser or user.is_staff:
            return Organization.objects.all().order_by('-created_at')

        # 2. CROSS-TENANT IDENTITY (Federated View)
        if user.email:
            org_ids = User.objects.filter(email=user.email).values_list('organization_id', flat=True)
            return Organization.objects.filter(id__in=org_ids)
            
        # 3. JAILED VIEW (regular user sees only their org)
        return Organization.objects.filter(id=user.organization_id)

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        name = request.data.get('name', '').strip()
        slug = request.data.get('slug', '').strip().lower()
        business_type_id = request.data.get('business_type')
        base_currency_id = request.data.get('base_currency')
        
        if not name or not slug:
            return Response({"error": "Business name and slug are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if Organization.objects.filter(slug=slug).exists():
            return Response({"error": f"Slug '{slug}' is already taken."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = ProvisioningService.provision_organization(
                name=name, 
                slug=slug, 
                business_type_id=business_type_id,
                base_currency_id=base_currency_id
            )
            
            # Update optional fields after provisioning
            extra_fields = {}
            for field in ['business_email', 'phone', 'country', 'timezone', 'address', 'city', 'website']:
                val = request.data.get(field, '').strip()
                if val:
                    extra_fields[field] = val
            
            if extra_fields:
                for k, v in extra_fields.items():
                    setattr(org, k, v)
                org.save(update_fields=list(extra_fields.keys()))
            
            # ── Auto-create SaaSClient (account owner) ──
            from erp.models import SaaSClient
            client_email = extra_fields.get('business_email', f'{slug}@tenant.local')
            client_phone = extra_fields.get('phone', '')
            client_country = extra_fields.get('country', '')
            client_city = extra_fields.get('city', '')
            
            # Split org name into first/last for the client record
            name_parts = name.split(' ', 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else 'Admin'
            
            # Reuse existing client if email matches, or create new
            client, created = SaaSClient.objects.get_or_create(
                email=client_email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'company_name': name,
                    'phone': client_phone,
                    'city': client_city,
                    'country': client_country,
                }
            )
            org.client = client
            org.save(update_fields=['client'])

            # Sync client to CRM Contact in SaaS org
            client.sync_to_crm_contact()
            
            return Response(self.get_serializer(org).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        """Handle suspend/activate and other field updates."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        org = self.get_object()
        
        # Protect master SaaS org from suspension
        if org.slug == 'saas' and 'is_active' in request.data:
            return Response(
                {"error": "Cannot change the status of the master SaaS organization."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Delete with safety rules:
        1. Cannot delete master SaaS org
        2. Must be deactivated first
        3. Must wait 24h after deactivation
        4. Block if org has meaningful data without backup
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        org = self.get_object()
        
        # Rule 1: Protect SaaS master org
        if org.slug == 'saas':
            return Response(
                {"error": "Cannot delete the master SaaS organization."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Rule 2: Must be deactivated first
        if org.is_active:
            return Response(
                {"error": "Organization must be deactivated before deletion. Suspend it first."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Rule 3: 24h cooldown after deactivation
        from django.utils import timezone as tz
        if org.updated_at and (tz.now() - org.updated_at).total_seconds() < 86400:
            hours_left = 24 - int((tz.now() - org.updated_at).total_seconds() / 3600)
            return Response(
                {"error": f"Organization was recently deactivated. Please wait ~{hours_left}h before deletion."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Rule 4: Check for data existence
        has_data = (
            Product.objects.filter(organization=org).exists() or
            Contact.objects.filter(organization=org).exists() or
            Transaction.objects.filter(organization=org).exists()
        )
        
        if has_data:
            return Response(
                {"error": "Organization has existing data. Please create a backup before deletion, or contact support."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        org_name = org.name
        org.delete()
        return Response({"message": f"Organization '{org_name}' has been permanently deleted."})

    @action(detail=True, methods=['get'])
    def permissions_list(self, request, pk=None):
        """Returns what the current user is allowed to do with this org."""
        org = self.get_object()
        is_admin = request.user.is_staff or request.user.is_superuser
        is_saas_org = org.slug == 'saas'
        
        return Response({
            "can_suspend": is_admin and not is_saas_org,
            "can_activate": is_admin and not is_saas_org,
            "can_delete": is_admin and not is_saas_org,
            "can_manage_features": is_admin,
            "can_edit": is_admin,
            "is_protected": is_saas_org,
        })


class SiteViewSet(TenantModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer


class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=400)
        
        brands = Brand.objects.filter(
            products__country_id=pk,
            organization_id=organization_id
        ).distinct().prefetch_related(
            'products', 'products__inventory', 'products__unit'
        )

        data = []
        for brand in brands:
            products_data = []
            products = brand.products.filter(country_id=pk)
            brand_total_stock = 0
            for p in products:
                stock = sum(i.quantity for i in p.inventory.all())
                brand_total_stock += stock
                products_data.append({
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "size": float(p.size) if hasattr(p, 'size') and p.size else 0,
                    "unitShortName": p.unit.short_name if p.unit else None,
                    "categoryName": p.category.name if p.category else None,
                    "stock": float(stock)
                })
            
            data.append({
                "id": brand.id,
                "name": brand.name,
                "logo": "",
                "products": products_data,
                "totalStock": brand_total_stock
            })

        return Response(data)





class RoleViewSet(TenantModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer


class CurrencyViewSet(viewsets.ModelViewSet):
    """
    SaaS-level CRUD for GlobalCurrency.
    All authenticated users can read. Staff/Superuser can write.
    """
    queryset = GlobalCurrency.objects.all().order_by('code')
    serializer_class = GlobalCurrencySerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=status.HTTP_403_FORBIDDEN)
        # Prevent deleting a currency if it's used as base_currency by any org
        currency = self.get_object()
        if Organization.objects.filter(base_currency=currency).exists():
            return Response(
                {"error": "Cannot delete currency: it is currently in use as a base currency."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

# ============================================================================
#  RECORD HISTORY & ENTITY GRAPH (Audit APIs)
# ============================================================================

class RecordHistoryViewSet(viewsets.ViewSet):
    """
    Record History API — Retrieves the full audit trail for any entity.
    GET /api/record-history/?table=Product&id=<uuid>
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def trail(self, request):
        from .models_audit import AuditLog
        table = request.query_params.get('table', '')
        record_id = request.query_params.get('id', '')
        limit = min(int(request.query_params.get('limit', 50)), 200)

        if not table or not record_id:
            return Response({"error": "Both 'table' and 'id' params required"}, status=status.HTTP_400_BAD_REQUEST)

        tenant_id = get_current_tenant_id()
        qs = AuditLog.objects.filter(table_name=table, record_id=record_id)
        if tenant_id:
            qs = qs.filter(organization_id=tenant_id)
        
        entries = qs[:limit]
        data = [{
            "id": str(e.id),
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "action": e.action,
            "actor": e.actor.username if e.actor else "system",
            "old_value": e.old_value,
            "new_value": e.new_value,
            "ip_address": str(e.ip_address) if e.ip_address else None,
            "description": e.description,
        } for e in entries]

        return Response({"table": table, "record_id": record_id, "history": data})


class EntityGraphViewSet(viewsets.ViewSet):
    """
    Entity Graph API — Shows relationships between entities.
    GET /api/entity-graph/?table=Product&id=<uuid>
    Returns the entity and all related audit/approval/task references.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def relations(self, request):
        from .models_audit import AuditLog, ApprovalRequest, TaskQueue
        table = request.query_params.get('table', '')
        record_id = request.query_params.get('id', '')

        if not table or not record_id:
            return Response({"error": "Both 'table' and 'id' params required"}, status=status.HTTP_400_BAD_REQUEST)

        tenant_id = get_current_tenant_id()

        # Audit entries for this entity
        audit_qs = AuditLog.objects.filter(table_name=table, record_id=record_id)
        if tenant_id:
            audit_qs = audit_qs.filter(organization_id=tenant_id)
        audit_ids = list(audit_qs.values_list('id', flat=True)[:50])

        # Approval requests linked to this entity
        approval_qs = ApprovalRequest.objects.filter(target_table=table, target_id=record_id)
        if tenant_id:
            approval_qs = approval_qs.filter(organization_id=tenant_id)
        approvals = [{
            "id": str(a.id),
            "status": a.status,
            "requested_by": a.requested_by.username if a.requested_by else None,
            "reviewed_by": a.reviewed_by.username if a.reviewed_by else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        } for a in approval_qs[:20]]

        # Tasks linked via audit logs
        tasks_qs = TaskQueue.objects.filter(source_audit_log_id__in=audit_ids)
        tasks = [{
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        } for t in tasks_qs[:20]]

        return Response({
            "entity": {"table": table, "id": record_id},
            "audit_count": len(audit_ids),
            "approvals": approvals,
            "tasks": tasks,
        })


# ============================================================================
#  DASHBOARD (Cross-Cutting Concern — Reads from multiple modules)
# ============================================================================

class DashboardViewSet(viewsets.ViewSet):
    """Dashboard Aggregation ViewSet"""
    
    @action(detail=False, methods=['get'])
    def admin_stats(self, request):
        organization_id = get_current_tenant_id()
        
        if organization_id:
            try:
                org = Organization.objects.get(id=organization_id)
                total_products = Product.objects.filter(organization=org, is_active=True).count()
                total_customers = Contact.objects.filter(organization=org, type='CUSTOMER').count()
                latest_sales = Transaction.objects.filter(
                    organization=org, type__in=['IN', 'SALE']
                ).order_by('-created_at')[:5]
            except Organization.DoesNotExist:
                return Response({"error": "Organization not found"}, status=404)
        else:
            if not (request.user.is_staff or request.user.is_superuser):
                 return Response({"error": "Access Denied. Tenant context required."}, status=403)
            total_products = Product.objects.filter(is_active=True).count()
            total_customers = Contact.objects.filter(type='CUSTOMER').count()
            latest_sales = Transaction.objects.filter(type__in=['IN', 'SALE']).order_by('-created_at')[:5]

        from .serializers import TransactionSerializer
        latest_sales_data = TransactionSerializer(latest_sales, many=True).data

        return Response({
            "totalSales": 0,
            "activeOrders": 0,
            "totalProducts": total_products,
            "totalCustomers": total_customers,
            "latestSales": latest_sales_data
        })

    @action(detail=False, methods=['get'])
    def saas_stats(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=403)
            
        from django.utils import timezone
        total_tenants = Organization.objects.count()
        active_tenants = Organization.objects.filter(is_active=True).count()
        total_modules = SystemModule.objects.count()
        total_deployments = OrganizationModule.objects.filter(is_enabled=True).count()
        pending_registrations = User.objects.filter(registration_status='PENDING').count()
        
        latest_tenants = Organization.objects.order_by('-created_at')[:5]
        latest_tenants_data = [{
            'id': str(o.id),
            'name': o.name,
            'slug': o.slug,
            'created_at': o.created_at.strftime("%Y-%m-%d"),
            'is_active': o.is_active
        } for o in latest_tenants]
        
        return Response({
            "tenants": total_tenants,
            "activeTenants": active_tenants,
            "pendingRegistrations": pending_registrations,
            "modules": total_modules,
            "deployments": total_deployments,
            "systemLoad": "Optimal",
            "lastSync": timezone.now().strftime("%H:%M"),
            "latestTenants": latest_tenants_data
        })

    @action(detail=False, methods=['get'])
    def financial_stats(self, request):
        organization_id = get_current_tenant_id()
        scope = request.query_params.get('scope', 'INTERNAL')
        
        from django.utils import timezone
        from decimal import Decimal
        
        if organization_id:
            try:
                organization = Organization.objects.get(id=organization_id)
            except Organization.DoesNotExist:
                return Response({"error": "Organization not found"}, status=404)
        else:
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({"error": "Access Denied. Tenant context required."}, status=403)
            organization = None

        # 1. Cash Position
        if organization:
            cash_accounts = FinancialAccount.objects.filter(organization=organization)
            total_cash = sum(acc.balance for acc in cash_accounts)
        else:
            total_cash = FinancialAccount.objects.aggregate(total=Sum('balance'))['total'] or 0

        # 2. P&L (Monthly)
        now = timezone.now()
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        lines_qs = JournalEntryLine.objects.filter(
            journal_entry__transaction_date__gte=start_month,
            journal_entry__status='POSTED'
        )
        
        if organization:
            lines_qs = lines_qs.filter(journal_entry__organization=organization)
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')

        monthly_income = lines_qs.filter(account__type='INCOME').aggregate(
            val=Sum(F('credit') - F('debit'))
        )['val'] or 0
        
        monthly_expense = lines_qs.filter(account__type='EXPENSE').aggregate(
            val=Sum(F('debit') - F('credit'))
        )['val'] or 0

        # 3. Trends (Last 6 months)
        trends = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timezone.timedelta(days=30*i)).replace(day=1)
            next_month_start = (month_start + timezone.timedelta(days=32)).replace(day=1)
            
            month_lines = JournalEntryLine.objects.filter(
                journal_entry__transaction_date__gte=month_start,
                journal_entry__transaction_date__lt=next_month_start,
                journal_entry__status='POSTED'
            )
            if organization:
                month_lines = month_lines.filter(journal_entry__organization=organization)
            if scope == 'OFFICIAL':
                month_lines = month_lines.filter(journal_entry__scope='OFFICIAL')
                
            m_income = month_lines.filter(account__type='INCOME').aggregate(
                val=Sum(F('credit') - F('debit'))
            )['val'] or 0
            m_expense = month_lines.filter(account__type='EXPENSE').aggregate(
                val=Sum(F('debit') - F('credit'))
            )['val'] or 0
            
            trends.append({
                "month": month_start.strftime("%b"),
                "income": float(m_income),
                "expense": float(m_expense)
            })

        # 4. Inventory Value
        inv_status = {}
        if organization:
            raw_status = InventoryService.get_inventory_valuation(organization)
            stock_value = raw_status.get('total_value', Decimal('0'))
            
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc_id = rules.get('sales', {}).get('inventory') or rules.get('purchases', {}).get('inventory')
            ledger_balance = Decimal('0')
            
            if inv_acc_id:
                acc = ChartOfAccount.objects.filter(id=inv_acc_id).first()
                if acc: ledger_balance = acc.balance
            
            inv_status = {
                "totalValue": float(stock_value),
                "ledgerBalance": float(ledger_balance),
                "discrepancy": float(stock_value - ledger_balance),
                "itemCount": raw_status.get('item_count', 0),
                "isMapped": bool(inv_acc_id)
            }
        else:
            result = Inventory.objects.aggregate(total_value=Sum(F('quantity') * F('product__cost_price')))
            stock_value = Decimal(str(result['total_value'] or '0'))
            inv_status = {
                "totalValue": float(stock_value),
                "ledgerBalance": 0, 
                "discrepancy": 0,
                "itemCount": Inventory.objects.count(),
                "isMapped": False
            }
        
        return Response({
            "totalCash": float(total_cash),
            "monthlyIncome": float(monthly_income),
            "monthlyExpense": float(monthly_expense),
            "netProfit": float(monthly_income - monthly_expense),
            "totalAR": 0,
            "totalAP": 0,
            "trends": trends,
            "recentEntries": [],
            "inventoryStatus": inv_status
        })

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response([], status=status.HTTP_200_OK)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        
        from django.utils import timezone
        from datetime import timedelta
        
        products_qs = Product.objects.filter(organization=organization, status='ACTIVE')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        
        products_qs = products_qs[:10]
        
        data = []
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        for p in products_qs:
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id
                
            stock_level = Inventory.objects.filter(**stock_filter).aggregate(total=Sum('quantity'))['total'] or 0
            
            sales_qty = OrderLine.objects.filter(
                order__organization=organization,
                product=p,
                order__created_at__gte=thirty_days_ago,
                order__status='COMPLETED',
                order__type='SALE'
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            daily_sales = float(sales_qty) / 30.0
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "costPrice": float(p.cost_price),
                "costPriceHT": float(p.cost_price_ht),
                "sellingPriceHT": float(p.selling_price_ht),
                "sellingPriceTTC": float(p.selling_price_ttc),
                "stockLevel": float(stock_level),
                "dailySales": round(daily_sales, 2),
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
            })
            
        return Response(data)


# ============================================================================
#  BACKWARD-COMPATIBLE RE-EXPORTS
#  These allow `from erp.views import XViewSet` to continue working.
#  Canonical imports should use `from apps.X.views import XViewSet`.
#  Each is gated — kernel boots even if a module is removed.
# ============================================================================

# Finance
try:
    from apps.finance.views import (  # noqa: F401, E402
        FinancialAccountViewSet, ChartOfAccountViewSet,
        FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
        BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
        TransactionSequenceViewSet,
    )
except ImportError:
    pass

# Inventory
try:
    from apps.inventory.views import (  # noqa: F401, E402
        ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet,
        BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
    )
except ImportError:
    pass

# POS
try:
    from apps.pos.views import POSViewSet, PurchaseViewSet  # noqa: F401, E402
except ImportError:
    pass

# CRM
try:
    from apps.crm.views import ContactViewSet  # noqa: F401, E402
except ImportError:
    pass

# HR
try:
    from apps.hr.views import EmployeeViewSet  # noqa: F401, E402
except ImportError:
    pass


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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_sales_csv_view(request):
    """
    Endpoint to receive a CSV file and mapping for batch sales import.
    """
    from .services_sales_import import SalesImportService
    
    csv_file = request.FILES.get('file')
    mapping_str = request.data.get('mapping')
    warehouse_id = request.data.get('warehouse_id')
    scope = request.data.get('scope', 'INTERNAL')

    if not all([csv_file, mapping_str, warehouse_id]):
        return Response({"error": "Missing file, mapping, or warehouse_id."}, status=400)

    try:
        import json
        mapping = json.loads(mapping_str)
        results = SalesImportService.process_csv(
            organization=request.user.organization,
            user=request.user,
            warehouse_id=warehouse_id,
            csv_file=csv_file,
            mapping=mapping,
            scope=scope
        )
        return Response(results)
    except Exception as e:
        import logging
        logger = logging.getLogger('erp')
        logger.error(f"[SALE_IMPORT_VIEW] Error: {e}")
        return Response({"error": str(e)}, status=500)
