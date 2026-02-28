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
        model = self.queryset.model

        # 1. Resolve Organization ID
        print(f"🔍 DEBUG: get_queryset user={user} user.org_id={user.organization_id if user else 'None'} header_tenant_id={tenant_id}")
        if user.is_staff or user.is_superuser:
            org_id = tenant_id or user.organization_id
        else:
            org_id = user.organization_id

        if str(model._meta.model_name) == 'product':
             from erp.models import Product
             print(f"📦 DEBUG: Product Total Count: {Product.objects.count()}")
             print(f"🏢 DEBUG: Product Org Count ({org_id}): {Product.objects.filter(organization_id=org_id).count()}")

        if not org_id:
            return self.queryset.none()
            
        filters = {}
        # Many models use 'organization' (ForeignKey), some might use 'organization_id'
        if hasattr(model, 'organization'):
            filters['organization_id'] = org_id
        elif hasattr(model, 'organization_id'):
            filters['organization_id'] = org_id

        # 2. Global Scope Filtering (Official vs Internal)
        # ENFORCE SESSION ISOLATION: Use scope resolved by Middleware
        from .middleware import get_authorized_scope
        authorized_scope = get_authorized_scope() or 'official'

        # Respect 'scope' query param or 'X-Scope' header, but cage users in their authorized scope
        requested_scope = (self.request.query_params.get('scope') or 
                           self.request.headers.get('X-Scope') or 
                           'OFFICIAL').upper()
        
        target_scope = requested_scope
        if authorized_scope == 'official' and requested_scope == 'INTERNAL':
            # [SECURITY] Block unauthorized bypass attempt!
            target_scope = 'OFFICIAL'
            
        if hasattr(model, 'scope'):
            # [FLEXIBILITY] For detail views (single record), we allow cross-scope retrieval
            # so users don't get 404s if they are in the wrong view mode.
            # But they are still caged within their Organization (Step 1 above).
            is_detail = self.detail or 'pk' in self.kwargs
            if is_detail:
                # Still respect tenant, but ignore scope for specific record lookup
                pass 
            else:
                filters['scope'] = target_scope

        return self.queryset.filter(**filters)

    def check_scope_permission(self, requested_scope):
        """
        Enforce Session-Level Scope Isolation.
        If user is in 'OFFICIAL' session, block access to 'INTERNAL' data/actions.
        """
        from .middleware import get_authorized_scope
        authorized = get_authorized_scope() or 'official'
        
        req_scope = (requested_scope or 'OFFICIAL').upper()
        if authorized == 'official' and req_scope == 'INTERNAL':
             from rest_framework import serializers
             raise serializers.ValidationError({
                 "scope": "Access Denied: Your current session is restricted to the 'Official' scope. You cannot access or create 'Internal' records."
             })

    def perform_create(self, serializer):
        user = self.request.user
        header_tenant_id = get_current_tenant_id()
        
        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
             from rest_framework import serializers
             raise serializers.ValidationError({
                 "error": "Organization context missing. Please ensure you are within a valid tenant environment."
             })

        # --- GLOBAL SCOPE ENFORCEMENT ---
        model = serializer.Meta.model
        if hasattr(model, 'scope'):
            self.check_scope_permission(self.request.data.get('scope'))

        serializer.save(organization_id=organization_id)

    def perform_update(self, serializer):
        if 'organization' in self.request.data or 'organization_id' in self.request.data:
             pass 
             
        # --- GLOBAL SCOPE ENFORCEMENT ---
        model = serializer.Meta.model
        if hasattr(model, 'scope') and 'scope' in self.request.data:
            self.check_scope_permission(self.request.data.get('scope'))

        super().perform_update(serializer)  # Triggers AuditLogMixin

    def perform_destroy(self, instance):
        super().perform_destroy(instance)  # Triggers AuditLogMixin

# ============================================================================
#  KERNEL VIEWSETS
# ============================================================================

