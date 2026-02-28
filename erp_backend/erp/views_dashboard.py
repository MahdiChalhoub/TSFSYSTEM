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

class DashboardViewSet(viewsets.ViewSet):
    """Dashboard Aggregation ViewSet"""

    @action(detail=False, methods=['get'])
    def realtime_kpis(self, request):
        """High-level business performance metrics (WOW factor API)."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context required"}, status=403)
            
        org = Organization.objects.get(id=organization_id)
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timezone.timedelta(days=1)
        month_start = today_start.replace(day=1)

        # 1. Sales Velocity (Quantity in last 24h)
        today_qty = OrderLine.objects.filter(
            order__organization=org, order__created_at__gte=today_start, order__status='COMPLETED'
        ).aggregate(qty=Sum('quantity'))['qty'] or 0
        
        yesterday_qty = OrderLine.objects.filter(
            order__organization=org, order__created_at__gte=yesterday_start, 
            order__created_at__lt=today_start, order__status='COMPLETED'
        ).aggregate(qty=Sum('quantity'))['qty'] or 0
        
        velocity_change = 0
        if yesterday_qty > 0:
            velocity_change = round(((today_qty - yesterday_qty) / yesterday_qty) * 100, 1)

        # 2. Inventory Health (% of active products with positive stock vs low stock)
        total_products = Product.objects.filter(organization=org, is_active=True).count()
        low_stock_threshold = 10 # Hardcoded for now, should be per-site/product
        low_stock_count = Product.objects.filter(
            organization=org, is_active=True, inventory__quantity__lt=low_stock_threshold
        ).distinct().count()
        
        out_of_stock_count = Product.objects.filter(
            organization=org, is_active=True, inventory__quantity__lte=0
        ).distinct().count()

        # 3. Customer Engagement
        new_customers_month = Contact.objects.filter(
            organization=org, type='CUSTOMER', created_at__gte=month_start
        ).count()

        # 4. Financial Health (Live AR/AP)
        ar_total = FinancialAccount.objects.filter(
            organization=org, type='RECEIVABLE'
        ).aggregate(s=Sum('balance'))['s'] or 0
        
        ap_total = FinancialAccount.objects.filter(
            organization=org, type='PAYABLE'
        ).aggregate(s=Sum('balance'))['s'] or 0

        return Response({
            "salesVelocity": {
                "today": float(today_qty),
                "yesterday": float(yesterday_qty),
                "trend": velocity_change
            },
            "inventoryHealth": {
                "lowStockCount": low_stock_count,
                "outOfStockCount": out_of_stock_count,
                "healthScore": round((1 - (low_stock_count / total_products)) * 100, 1) if total_products > 0 else 0
            },
            "engagement": {
                "newCustomersThisMonth": new_customers_month,
                "customerLTV": Contact.objects.filter(organization=org, type='CUSTOMER').aggregate(avg=Avg('lifetime_value'))['avg'] or 0
            },
            "financialRunway": {
                "ar": float(ar_total),
                "ap": float(ap_total),
                "netPosition": float(ar_total - ap_total)
            },
            "lastUpdated": now.isoformat()
        })
    
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
        
        # 4. AR / AP (Added in Realtime KPIs)
        ar_total = FinancialAccount.objects.filter(organization=organization, type='RECEIVABLE').aggregate(s=Sum('balance'))['s'] if organization else 0
        ap_total = FinancialAccount.objects.filter(organization=organization, type='PAYABLE').aggregate(s=Sum('balance'))['s'] if organization else 0

        return Response({
            "totalCash": float(total_cash),
            "monthlyIncome": float(monthly_income),
            "monthlyExpense": float(monthly_expense),
            "netProfit": float(monthly_income - monthly_expense),
            "totalAR": float(ar_total or 0),
            "totalAP": float(ap_total or 0),
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
                stock_filter['warehouse__parent_id'] = site_id
                
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
