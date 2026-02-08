"""
Kernel Views — Infrastructure & Cross-Cutting Concerns Only
============================================================
This file contains ONLY the kernel-level ViewSets:
 - TenantModelViewSet (base class for all tenant-scoped views)
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
from .middleware import get_current_tenant_id

# --- Kernel Models ---
from .models import (
    Organization, Site, User, Country, Role,
    SystemModule, OrganizationModule,
    # Cross-cutting: Dashboard needs these
    FinancialAccount, ChartOfAccount, JournalEntryLine,
    Product, Contact, Transaction, Inventory, OrderLine,
    Brand,
)
# --- Kernel Serializers ---
from .serializers import (
    OrganizationSerializer, SiteSerializer, UserSerializer,
    CountrySerializer, RoleSerializer,
    ProductSerializer, BrandSerializer,
)
# --- Kernel Services ---
from .services import (
    ProvisioningService, ConfigurationService,
    LedgerService, InventoryService,
)

# ============================================================================
#  KERNEL BASE CLASS
# ============================================================================

class TenantModelViewSet(viewsets.ModelViewSet):
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
            if tenant_id:
                return self.queryset.filter(organization_id=tenant_id)
            # SaaS Root: no data leak — staff must proxy into tenant
            return self.queryset.none()
        
        # 2. Strict Tenant Isolation for Regular Users
        if not user.organization_id:
             return self.queryset.none()
        return self.queryset.filter(organization_id=user.organization_id)

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
        serializer.save()

# ============================================================================
#  KERNEL VIEWSETS
# ============================================================================

class UserViewSet(TenantModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class TenantResolutionView(viewsets.ViewSet):
    """
    Public endpoint to resolve tenant slug to ID.
    Used by Next.js middleware/context to avoid direct DB access.
    """
    permission_classes = [] 
    authentication_classes = []

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
    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None'),
        "organization_id": get_current_tenant_id()
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
        
        if not name or not slug:
            return Response({"error": "Business name and slug are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if Organization.objects.filter(slug=slug).exists():
            return Response({"error": f"Slug '{slug}' is already taken."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = ProvisioningService.provision_organization(name=name, slug=slug)
            
            # Update optional fields after provisioning
            extra_fields = {}
            for field in ['business_email', 'phone', 'country', 'timezone', 'address', 'city']:
                val = request.data.get(field, '').strip()
                if val:
                    extra_fields[field] = val
            
            if extra_fields:
                for k, v in extra_fields.items():
                    setattr(org, k, v)
                org.save(update_fields=list(extra_fields.keys()))
            
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


class CountryViewSet(TenantModelViewSet):
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
            'product_set', 'product_set__inventory', 'product_set__unit'
        )

        data = []
        for brand in brands:
            products_data = []
            products = brand.product_set.filter(country_id=pk)
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
# ============================================================================

# Finance
from apps.finance.views import (  # noqa: F401, E402
    FinancialAccountViewSet, ChartOfAccountViewSet,
    FiscalYearViewSet, FiscalPeriodViewSet, JournalEntryViewSet,
    BarcodeSettingsViewSet, LoanViewSet, FinancialEventViewSet,
    TransactionSequenceViewSet,
)

# Inventory
from apps.inventory.views import (  # noqa: F401, E402
    ProductViewSet, UnitViewSet, WarehouseViewSet, InventoryViewSet,
    BrandViewSet, CategoryViewSet, ParfumViewSet, ProductGroupViewSet,
)

# POS
from apps.pos.views import POSViewSet, PurchaseViewSet  # noqa: F401, E402

# CRM
from apps.crm.views import ContactViewSet  # noqa: F401, E402

# HR
from apps.hr.views import EmployeeViewSet  # noqa: F401, E402
