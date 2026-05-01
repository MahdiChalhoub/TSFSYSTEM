"""
Kernel Views — Infrastructure & Cross-Cutting Concerns Only
============================================================
This file contains ONLY the kernel-level ViewSets:
 - TenantModelViewSet (base class for all organization-scoped views, with AuditLogMixin)
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
from django.db.models import Q, Sum, F, Avg, Case, When, Value, IntegerField
from rest_framework import viewsets, status, serializers, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, action, permission_classes
from django.utils import timezone
from .middleware import get_current_tenant_id
from .mixins import AuditLogMixin, TenantFilterMixin, UDLEViewSetMixin
from .throttles import TenantResolveRateThrottle

# --- Kernel Models ---
from .models import (
    BusinessType,
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
from .serializers.core import GlobalCurrencySerializer, BusinessTypeSerializer
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

    # SaaS master org always sorts first in listings
    SAAS_FIRST = Case(
        When(name='SAAS', then=Value(0)),
        default=Value(1),
        output_field=IntegerField(),
    )

    def get_queryset(self):
        user = self.request.user
        
        # 1. PLATFORM ADMIN (Global SaaS View)
        if user.is_superuser or user.is_staff:
            return Organization.objects.all().annotate(
                _saas_order=self.SAAS_FIRST
            ).order_by('_saas_order', '-created_at')

        # 2. CROSS-TENANT IDENTITY (Federated View)
        if user.email:
            org_ids = User.objects.filter(email=user.email).values_list('organization_id', flat=True)
            return Organization.objects.filter(id__in=org_ids).annotate(
                _saas_order=self.SAAS_FIRST
            ).order_by('_saas_order', 'name')
            
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
            client_email = extra_fields.get('business_email', f'{slug}@organization.local')
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
        org = self.get_object()
        
        # ── Permission Check ──
        # Allow Platform Staff (SaaS Admin) OR current Organization Admin
        is_platform_staff = request.user.is_staff or request.user.is_superuser
        is_self_manage = org.id == request.user.organization_id
        
        if not (is_platform_staff or is_self_manage):
            return Response({"error": "Forbidden - You do not have permission to modify this organization."}, status=status.HTTP_403_FORBIDDEN)
        
        # Protect master SaaS org from suspension by non-global staff
        if org.slug == 'saas' and 'is_active' in request.data and not is_platform_staff:
            return Response(
                {"error": "Unauthorized change to platform status."},
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

    @action(detail=False, methods=['get', 'patch'], url_path='me')
    def me(self, request):
        """
        GET/PATCH the current user's organization profile.
        Any authenticated user can view. Only org admin/superuser can update.
        Used by the Setup Wizard for first-time org configuration.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.select_related('business_type', 'base_currency', 'base_country').get(id=org_id)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'PATCH':
            # Allow admin, staff, or superuser to update
            if not (request.user.is_staff or request.user.is_superuser or
                    getattr(request.user, 'role', None) and 
                    getattr(request.user.role, 'name', '').lower() in ('admin', 'owner', 'super admin')):
                return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

            allowed_fields = [
                'name', 'business_email', 'phone', 'website', 'address',
                'city', 'state', 'zip_code', 'country', 'timezone',
            ]
            update_fields = []

            for field in allowed_fields:
                if field in request.data:
                    setattr(org, field, request.data[field])
                    update_fields.append(field)

            # Handle FK fields separately
            if 'business_type_id' in request.data and request.data['business_type_id']:
                org.business_type_id = request.data['business_type_id']
                update_fields.append('business_type_id')

            if 'base_currency_id' in request.data and request.data['base_currency_id']:
                org.base_currency_id = request.data['base_currency_id']
                update_fields.append('base_currency_id')

            if 'base_country_id' in request.data and request.data['base_country_id']:
                org.base_country_id = request.data['base_country_id']
                update_fields.append('base_country_id')

            # Handle org-level settings (JSONField — merge, not replace)
            if 'settings' in request.data and isinstance(request.data['settings'], dict):
                current_settings = org.settings or {}
                current_settings.update(request.data['settings'])
                org.settings = current_settings
                update_fields.append('settings')

            if update_fields:
                org.save(update_fields=update_fields)

            return Response(self.get_serializer(org).data)

        # GET — return org profile with nested relations
        data = self.get_serializer(org).data
        # Enrich with business_type and currency details if available
        if org.business_type:
            data['business_type'] = {'id': org.business_type.id, 'name': org.business_type.name}
        if org.base_currency:
            data['base_currency'] = {
                'id': org.base_currency.id, 
                'code': org.base_currency.code,
                'symbol': org.base_currency.symbol,
                'name': org.base_currency.name,
            }
        if org.base_country:
            data['base_country'] = {
                'id': org.base_country.id,
                'iso2': org.base_country.iso2,
                'iso3': org.base_country.iso3,
                'name': org.base_country.name,
                'phone_code': org.base_country.phone_code,
            }
        return Response(data)

    @action(detail=False, methods=['get', 'patch'], url_path='me-theme')
    def me_theme(self, request):
        """
        GET  /api/organizations/me-theme/ → { default_theme: "midnight-pro" | null }
        PATCH /api/organizations/me-theme/ → { default_theme: "ivory-market" }

        Reads / writes org.settings["default_theme"].
        Used by the /settings/appearance page to set the org-wide default theme.
        Any authenticated user can read. Admin/staff/superuser can write.
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'PATCH':
            # Require admin / staff / superuser
            is_privileged = (
                request.user.is_staff or
                request.user.is_superuser or
                (getattr(request.user, 'role', None) and
                 getattr(request.user.role, 'name', '').lower() in ('admin', 'owner', 'super admin'))
            )
            if not is_privileged:
                return Response({"error": "Admin access required to change org theme"}, status=status.HTTP_403_FORBIDDEN)

            theme = request.data.get('default_theme')
            valid_themes = ['midnight-pro', 'ivory-market', 'neon-rush', 'savane-earth', 'arctic-glass', 'lumina-sky', 'warm-enterprise']
            if theme is not None and theme not in valid_themes:
                return Response(
                    {"error": f"Invalid theme. Choose from: {', '.join(valid_themes)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            settings = org.settings or {}
            if theme is None:
                settings.pop('default_theme', None)
            else:
                settings['default_theme'] = theme
            org.settings = settings
            org.save(update_fields=['settings'])

            return Response({"default_theme": theme, "message": "Org default theme updated."})

        # GET
        default_theme = (org.settings or {}).get('default_theme', None)
        return Response({"default_theme": default_theme})


    @action(detail=False, methods=['get', 'patch'], url_path='features')
    def features(self, request):
        """
        GET  /api/organizations/features/ → all feature statuses
        PATCH /api/organizations/features/ → toggle a feature {key, enabled}
        
        Uses feature_gate utility to check plan limits + org settings.
        """
        from erp.feature_gate import get_all_feature_statuses, get_feature_status, plan_allows, FEATURE_REGISTRY

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.select_related('current_plan').get(id=org_id)
        except Organization.DoesNotExist:
            return Response({"error": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'PATCH':
            # Require admin / staff / superuser
            is_privileged = (
                request.user.is_staff or
                request.user.is_superuser or
                (getattr(request.user, 'role', None) and
                 getattr(request.user.role, 'name', '').lower() in ('admin', 'owner', 'super admin'))
            )
            if not is_privileged:
                return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

            feature_key = request.data.get('key')
            enabled = request.data.get('enabled', False)

            if feature_key not in FEATURE_REGISTRY:
                return Response(
                    {"error": f"Unknown feature: {feature_key}. Valid: {list(FEATURE_REGISTRY.keys())}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check plan allows this feature
            if enabled and not plan_allows(org, feature_key):
                plan_name = org.current_plan.name if org.current_plan else 'None'
                return Response(
                    {"error": f"Your plan ({plan_name}) does not include this feature. Please upgrade."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Update org settings
            feature = FEATURE_REGISTRY[feature_key]
            settings = org.settings or {}
            settings[feature['org_key']] = bool(enabled)
            org.settings = settings
            org.save(update_fields=['settings'])

            return Response(get_feature_status(org, feature_key))

        # GET — return all feature statuses
        return Response(get_all_feature_statuses(org))

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
    """Backward-compat: /sites/ returns Warehouse entries of type BRANCH."""
    from apps.inventory.models import Warehouse
    queryset = Warehouse.objects.none()
    serializer_class = SiteSerializer

    def get_queryset(self):
        from apps.inventory.models import Warehouse
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Warehouse.objects.none()
        return Warehouse.objects.filter(
            organization_id=organization_id,
            location_type='BRANCH'
        ).prefetch_related('children')

    def list(self, request, *args, **kwargs):
        """If ?include_warehouses=true, nest children under each site."""
        include_warehouses = request.query_params.get('include_warehouses', '').lower() in ('true', '1', 'yes')
        qs = list(self.get_queryset())  # evaluate once
        serializer = self.get_serializer(qs, many=True)
        data = [dict(item) for item in serializer.data]  # mutable copy

        if include_warehouses:
            # Inject children (WAREHOUSE/STORE/VIRTUAL) into each site
            for i, site in enumerate(qs):
                children = list(site.children.filter(is_active=True).values('id', 'name', 'code', 'location_type'))
                data[i]['warehouses'] = children

        return Response(data)



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
class GlobalCurrencyViewSet(viewsets.ModelViewSet):
    """
    SaaS-level CRUD for GlobalCurrency — the global ISO catalog. See
    ``erp.views.GlobalCurrencyViewSet`` for the canonical docstring; this
    file's copy is a sibling kept for legacy import-path reasons.
    Renamed from ``CurrencyViewSet`` so the namespace doesn't collide with
    ``apps.finance.views.CurrencyViewSet`` (the tenant-scoped one).
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
class BusinessTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List available industry vectors (Business Types).
    Used during organization provisioning and setup wizard.
    """
    queryset = BusinessType.objects.all().order_by('name')
    serializer_class = BusinessTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


# ═══════════════════════════════════════════════════════════════════
# PAYMENT TERMS
# ═══════════════════════════════════════════════════════════════════

from .models import PaymentTerm


class PaymentTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTerm
        fields = [
            'id', 'name', 'code', 'description', 'days',
            'discount_percent', 'discount_days',
            'is_default', 'is_active', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PaymentTermViewSet(TenantModelViewSet):
    """Full CRUD for payment terms + seed-defaults action."""
    queryset = PaymentTerm.objects.all()
    serializer_class = PaymentTermSerializer
    pagination_class = None  # return flat list, not paginated

    def get_queryset(self):
        user = self.request.user
        organization_id = get_current_tenant_id()
        org_id = organization_id or getattr(user, 'organization_id', None)
        if not org_id:
            return PaymentTerm.objects.none()
        return PaymentTerm.objects.filter(organization_id=org_id).order_by('sort_order', 'name')

    def perform_create(self, serializer):
        user = self.request.user
        organization_id = get_current_tenant_id()
        org_id = organization_id or user.organization_id
        serializer.save(organization_id=org_id)

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        user = request.user
        organization_id = get_current_tenant_id()
        org_id = organization_id or user.organization_id

        if not org_id:
            return Response({'error': 'No organization context'}, status=400)

        defaults = [
            {'name': 'Due on Receipt',       'code': 'DUE_ON_RECEIPT', 'days': 0,  'sort_order': 1},
            {'name': '100% at Delivery',     'code': '100_DELIVERY',   'days': 0,  'sort_order': 2},
            {'name': 'Net 30 Days',          'code': 'NET_30',         'days': 30, 'sort_order': 3},
            {'name': 'Net 60 Days',          'code': 'NET_60',         'days': 60, 'sort_order': 4},
            {'name': 'Net 90 Days',          'code': 'NET_90',         'days': 90, 'sort_order': 5},
            {'name': 'Cash on Delivery',     'code': 'COD',            'days': 0,  'sort_order': 6},
            {'name': 'Prepaid',              'code': 'PREPAID',        'days': 0,  'sort_order': 7},
            {'name': '2/10 Net 30',          'code': '2_10_NET_30',    'days': 30, 'sort_order': 8,
             'discount_percent': 2.00, 'discount_days': 10,
             'description': '2% discount if paid within 10 days, otherwise due in 30'},
        ]

        created = []
        for d in defaults:
            term, was_created = PaymentTerm.objects.get_or_create(
                organization_id=org_id,
                code=d['code'],
                defaults={k: v for k, v in d.items() if k != 'code'}
            )
            if was_created:
                created.append(term)

        if not created:
            return Response({'message': 'Default terms already exist.', 'terms': []})

        return Response({
            'message': f'Created {len(created)} default terms.',
            'terms': PaymentTermSerializer(created, many=True).data,
        })
