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
from decimal import Decimal
from django.db.models import Q, Sum, F, Avg, Case, When, Value, Count, CharField
from django.db import models, transaction
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
            order__tenant=org, order__created_at__gte=today_start, order__status='COMPLETED'
        ).aggregate(qty=Sum('quantity'))['qty'] or 0
        
        yesterday_qty = OrderLine.objects.filter(
            order__tenant=org, order__created_at__gte=yesterday_start, 
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

        # 1. Cash Position — use .aggregate() instead of Python sum
        if organization:
            total_cash = FinancialAccount.objects.filter(
                organization=organization
            ).aggregate(total=Sum('balance'))['total'] or 0
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
            lines_qs = lines_qs.filter(journal_entry__tenant=organization)
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')

        monthly_income = lines_qs.filter(account__type='INCOME').aggregate(
            val=Sum(F('credit') - F('debit'))
        )['val'] or 0
        
        monthly_expense = lines_qs.filter(account__type='EXPENSE').aggregate(
            val=Sum(F('debit') - F('credit'))
        )['val'] or 0

        # 3. Trends (Last 6 months) — SINGLE QUERY with TruncMonth
        #    Replaces 12 sequential queries (2 per month × 6 months) with 1.
        from django.db.models.functions import TruncMonth
        six_months_ago = (now.replace(day=1) - timezone.timedelta(days=150)).replace(day=1)

        trends_qs = JournalEntryLine.objects.filter(
            journal_entry__transaction_date__gte=six_months_ago,
            journal_entry__status='POSTED',
            account__type__in=['INCOME', 'EXPENSE'],
        )
        if organization:
            trends_qs = trends_qs.filter(journal_entry__tenant=organization)
        if scope == 'OFFICIAL':
            trends_qs = trends_qs.filter(journal_entry__scope='OFFICIAL')

        trends_raw = trends_qs.annotate(
            month=TruncMonth('journal_entry__transaction_date')
        ).values('month', 'account__type').annotate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
        ).order_by('month')

        # Build a month → {income, expense} lookup
        month_lookup = {}
        for row in trends_raw:
            m_key = row['month'].strftime('%Y-%m')
            if m_key not in month_lookup:
                month_lookup[m_key] = {'income': 0, 'expense': 0}
            if row['account__type'] == 'INCOME':
                month_lookup[m_key]['income'] = float((row['total_credit'] or 0) - (row['total_debit'] or 0))
            elif row['account__type'] == 'EXPENSE':
                month_lookup[m_key]['expense'] = float((row['total_debit'] or 0) - (row['total_credit'] or 0))

        # Fill the 6-month array (ensure empty months still appear)
        trends = []
        for i in range(5, -1, -1):
            ms = (now.replace(day=1) - timezone.timedelta(days=30 * i)).replace(day=1)
            m_key = ms.strftime('%Y-%m')
            entry = month_lookup.get(m_key, {'income': 0, 'expense': 0})
            trends.append({
                "month": ms.strftime("%b"),
                "income": entry['income'],
                "expense": entry['expense'],
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
        """Intelligence Grid endpoint — bulk-aggregated for performance.
        Replaces per-product N+1 queries (120+ for 20 products) with 8 bulk queries.
        """
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response([], status=status.HTTP_200_OK)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        warehouse_id = request.query_params.get('warehouse_id')
        
        from django.utils import timezone
        from datetime import timedelta
        from decimal import Decimal
        
        products_qs = Product.objects.filter(
            organization=organization, status='ACTIVE'
        ).select_related('category')
        if query:
            products_qs = products_qs.filter(
                Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query)
            )
        
        # Filter by supplier if specified
        supplier_id = request.query_params.get('supplier_id')
        if supplier_id:
            try:
                from apps.pos.models import ProductSupplier
                linked_product_ids = ProductSupplier.objects.filter(
                    organization=organization, supplier_id=supplier_id
                ).values_list('product_id', flat=True)
                products_qs = products_qs.filter(id__in=linked_product_ids)
            except Exception:
                pass

        # Smart Fill mode
        mode = request.query_params.get('mode', '')
        if mode == 'smart_fill':
            try:
                from apps.inventory.models import Inventory as InvModel
                stock_by_product = InvModel.objects.filter(
                    organization=organization
                ).values('product_id').annotate(total=Sum('quantity'))
                low_stock_ids = [
                    r['product_id'] for r in stock_by_product
                    if (r['total'] or 0) < 10
                ]
                if low_stock_ids:
                    products_qs = products_qs.filter(id__in=low_stock_ids)
                limit = 30
            except Exception:
                limit = 30
        else:
            limit = 20
        
        products = list(products_qs[:limit])
        if not products:
            return Response([])
        
        product_ids = [p.id for p in products]
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        # ════════════════════════════════════════════════════════════
        #  BULK AGGREGATION — 8 queries total (was 120+ for 20 products)
        # ════════════════════════════════════════════════════════════
        
        # 1. Stock totals (all locations)
        stock_total_map = {}
        for row in Inventory.objects.filter(
            organization=organization, product_id__in=product_ids
        ).values('product_id').annotate(total=Sum('quantity')):
            stock_total_map[row['product_id']] = float(row['total'] or 0)
        
        # 2. Stock in specific location (if filtered)
        stock_location_map = {}
        if warehouse_id or site_id:
            loc_filter = {'organization': organization, 'product_id__in': product_ids}
            if warehouse_id:
                loc_filter['warehouse_id'] = warehouse_id
            elif site_id:
                loc_filter['warehouse__parent_id'] = site_id
            for row in Inventory.objects.filter(**loc_filter).values('product_id').annotate(total=Sum('quantity')):
                stock_location_map[row['product_id']] = float(row['total'] or 0)
        else:
            stock_location_map = stock_total_map.copy()
        
        # 3. Sales 30d (qty + amount) — single query
        sales_30d_map = {}
        for row in OrderLine.objects.filter(
            order__tenant=organization, product_id__in=product_ids,
            order__created_at__gte=thirty_days_ago,
            order__status='COMPLETED', order__type='SALE'
        ).values('product_id').annotate(
            total_qty=Sum('quantity'), total_amount=Sum('total_amount')
        ):
            sales_30d_map[row['product_id']] = {
                'qty': float(row['total_qty'] or 0),
                'amount': float(row['total_amount'] or 0),
            }
        
        # 4. Total sales all time — single query
        total_sales_map = {}
        for row in OrderLine.objects.filter(
            order__tenant=organization, product_id__in=product_ids,
            order__status='COMPLETED', order__type='SALE'
        ).values('product_id').annotate(total=Sum('total_amount')):
            total_sales_map[row['product_id']] = float(row['total'] or 0)
        
        # 5. Purchase data — single query
        purchase_map = {}
        try:
            from apps.pos.models import PurchaseOrderLine
            for row in PurchaseOrderLine.objects.filter(
                order__tenant=organization, product_id__in=product_ids
            ).values('product_id').annotate(
                count=Count('id'), total=Sum('line_total'), qty=Sum('quantity')
            ):
                purchase_map[row['product_id']] = {
                    'count': row['count'] or 0,
                    'total': float(row['total'] or 0),
                    'qty': float(row['qty'] or 1),
                }
        except Exception:
            pass
        
        # 6. Adjustment totals — single query
        adjustment_map = {}
        try:
            from apps.inventory.models import StockAdjustment
            for row in StockAdjustment.objects.filter(
                organization=organization, product_id__in=product_ids
            ).values('product_id').annotate(total=Sum('quantity_change')):
                adjustment_map[row['product_id']] = abs(float(row['total'] or 0))
        except Exception:
            pass
        
        # 7. Best supplier per product — single query
        best_supplier_map = {}
        try:
            from apps.pos.models import ProductSupplier
            # Get all suppliers for these products, ordered by price
            all_suppliers = list(ProductSupplier.objects.filter(
                organization=organization, product_id__in=product_ids
            ).select_related('supplier').order_by('product_id', 'last_purchased_price'))
            # Keep only the cheapest per product
            for s in all_suppliers:
                if s.product_id not in best_supplier_map:
                    best_supplier_map[s.product_id] = {
                        'name': s.supplier.name if s.supplier else '',
                        'price': float(s.last_purchased_price or 0),
                    }
        except Exception:
            pass
        
        # 8. Transit stock — single query instead of nested loop
        transit_map = {}
        try:
            from apps.inventory.models import TransferOrder, TransferOrderLine
            transit_filter = {
                'transfer_order__organization': organization,
                'transfer_order__status__in': ['PENDING', 'IN_TRANSIT'],
                'product_id__in': product_ids,
            }
            if warehouse_id:
                transit_filter['transfer_order__destination_warehouse_id'] = warehouse_id
            for row in TransferOrderLine.objects.filter(
                **transit_filter
            ).values('product_id').annotate(total=Sum('quantity')):
                transit_map[row['product_id']] = float(row['total'] or 0)
        except Exception:
            pass
        
        # ════════════════════════════════════════════════════════════
        #  ASSEMBLE RESULTS — pure Python, zero DB queries
        # ════════════════════════════════════════════════════════════
        
        # Tax context for effective cost (already outside loop)
        from apps.finance.tax_calculator import TaxEngineContext
        tax_ctx = TaxEngineContext.from_org(organization)
        settings = ConfigurationService.get_global_settings(organization)
        
        data = []
        for p in products:
            pid = p.id
            
            stock_in_location = stock_location_map.get(pid, 0)
            total_stock = stock_total_map.get(pid, 0)
            stock_in_transit = transit_map.get(pid, 0)
            
            s30 = sales_30d_map.get(pid, {'qty': 0, 'amount': 0})
            sales_qty_30d = s30['qty']
            daily_sales = sales_qty_30d / 30.0
            monthly_average = sales_qty_30d
            total_sales_all = total_sales_map.get(pid, 0)
            
            p_data = purchase_map.get(pid, {'count': 0, 'total': 0, 'qty': 1})
            purchase_count = p_data['count']
            total_purchased = p_data['total']
            purchased_qty_total = p_data['qty'] or 1
            
            # Financial score
            financial_score = round((total_sales_all / total_purchased) * 100) if total_purchased > 0 else 0
            
            # Adjustment score
            adjustment_qty = adjustment_map.get(pid, 0)
            adjustment_score = round((adjustment_qty / purchased_qty_total) * 100)
            
            # Best supplier
            bs = best_supplier_map.get(pid, {'name': '', 'price': 0})
            best_supplier_name = bs['name']
            best_supplier_price = bs['price']
            
            # Expiry / Safety
            shelf_life_days = getattr(p, 'manufacturer_shelf_life_days', None) or 0
            avg_expiry_days = getattr(p, 'avg_available_expiry_days', None) or 0
            is_expiry_tracked = getattr(p, 'is_expiry_tracked', False)
            
            days_to_sell_all = round(total_stock / daily_sales) if daily_sales > 0 else 0
            
            safety_tag = 'SAFE'
            if is_expiry_tracked and avg_expiry_days > 0:
                if days_to_sell_all >= avg_expiry_days:
                    safety_tag = 'RISKY'
                elif days_to_sell_all >= avg_expiry_days * 0.6:
                    safety_tag = 'CAUTION'
            
            # Proposed qty
            lead_time = getattr(p, 'shipping_duration_days', None) or 14
            proposed_qty = max(0, int(daily_sales * lead_time - stock_in_location))
            
            # Effective cost
            resolved_cost = p.get_effective_cost(tax_ctx=tax_ctx, last_pp_fallback=best_supplier_price, settings=settings)
            if supplier_id and best_supplier_price > 0:
                resolved_cost = best_supplier_price

            data.append({
                "id": pid,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode or '',
                "category_name": p.category.name if p.category else '',
                "is_active": p.status == 'ACTIVE',
                
                # Pricing
                "cost_price": float(resolved_cost),
                "effective_cost": float(resolved_cost),
                "costPriceHT": float(p.cost_price_ht or 0),
                "selling_price_ht": float(p.selling_price_ht or 0),
                "selling_price": float(p.selling_price_ttc or 0),
                
                # Stock
                "stockLevel": float(stock_in_location),
                "stock_on_location": float(stock_in_location),
                "total_stock": float(total_stock),
                "stock_in_transit": float(stock_in_transit),
                "other_warehouse_stock": [],  # Bulk query for this is optional — rare use
                
                # Sales
                "daily_sales": round(daily_sales, 2),
                "avg_daily_sales": round(daily_sales, 2),
                "monthly_average": round(monthly_average, 1),
                "total_sold": float(total_sales_all),
                
                # Purchases
                "purchase_count": purchase_count,
                "total_purchased": total_purchased,
                
                # Financial
                "financial_score": financial_score,
                "sales_performance_score": financial_score,
                "adjustment_score": adjustment_score,
                "adjustment_risk_score": adjustment_score,
                "margin_pct": p.margin_pct,
                
                # Best Supplier
                "best_supplier_name": best_supplier_name,
                "best_supplier_price": best_supplier_price,
                
                # Expiry / Safety
                "is_expiry_tracked": is_expiry_tracked,
                "manufacturer_shelf_life_days": shelf_life_days,
                "avg_available_expiry_days": avg_expiry_days,
                "days_to_sell_all": days_to_sell_all,
                "safety_tag": safety_tag,
                
                # Proposed
                "proposedQty": proposed_qty,
            })
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def catalogue_list(self, request):
        """Fast paginated catalogue with annotated stock/sales — powers the Catalogue modal."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'results': [], 'count': 0})
        
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Subquery, OuterRef, DecimalField, FloatField, ExpressionWrapper
        from django.db.models.functions import Coalesce
        
        organization = Organization.objects.get(id=organization_id)
        qs = Product.objects.filter(organization=organization)
        
        # Apply filters
        category = request.query_params.get('category')
        brand = request.query_params.get('brand')
        supplier = request.query_params.get('supplier')
        product_type = request.query_params.get('type')
        tax_rate = request.query_params.get('tax_rate')
        min_stock = request.query_params.get('min_stock')
        max_stock = request.query_params.get('max_stock')
        min_margin = request.query_params.get('min_margin')
        rotation = request.query_params.get('rotation')
        status_filter = request.query_params.get('status', 'ACTIVE')
        query = request.query_params.get('query', '')
        
        if status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.filter(status='ACTIVE')

        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query))
        if category:
            qs = qs.filter(category_id=category)
        if brand:
            qs = qs.filter(brand_id=brand)
        if product_type:
            qs = qs.filter(product_type=product_type) if hasattr(Product, 'product_type') else qs
        if tax_rate:
            qs = qs.filter(tva_rate=tax_rate)
        if supplier:
            qs = qs.filter(qualified_suppliers__supplier_id=supplier)
        
        # Annotate stock
        stock_subquery = Inventory.objects.filter(
            organization=organization, product=OuterRef('pk')
        ).values('product').annotate(total=Sum('quantity')).values('total')
        
        qs = qs.annotate(
            stock_level=Coalesce(Subquery(stock_subquery, output_field=DecimalField()), Decimal('0'), output_field=DecimalField())
        )
        
        # Annotate Global Last Purchase Price (Needed for margin fallback)
        from apps.pos.models import ProductSupplier
        last_price_subquery = ProductSupplier.objects.filter(
            organization=organization, product=OuterRef('pk')
        ).order_by('-last_purchased_date').values('last_purchased_price')[:1]

        # Annotate sales (30 days) - REQUIRED for rotation filters
        thirty_days_ago = timezone.now() - timedelta(days=30)
        sales_subquery = OrderLine.objects.filter(
            order__tenant=organization, product=OuterRef('pk'),
            order__created_at__gte=thirty_days_ago,
            order__status='COMPLETED', order__type='SALE'
        ).values('product').annotate(total_qty=Sum('quantity')).values('total_qty')
        
        qs = qs.annotate(
            daily_sales=ExpressionWrapper(
                Coalesce(Subquery(sales_subquery, output_field=DecimalField()), Decimal('0.0'), output_field=DecimalField()) / Decimal('30.0'),
                output_field=FloatField()
            )
        )

        # Resolve Org Tax Policy for SQL Annotation (Best guess for filtering)
        from apps.finance.tax_calculator import TaxEngineContext
        tax_ctx = TaxEngineContext.from_org(organization)
        vat_impact = tax_ctx.get_vat_cost_impact_ratio()

        # Annotate Margin using Effective Cost Fallback (Approximate in SQL)
        qs = qs.annotate(
            effective_cost_sql=Case(
                When(cost_price__gt=0, then=F('cost_price')),
                When(cost_price_ht__gt=0, then=ExpressionWrapper(
                    F('cost_price_ht') * (Value(1.0) + (F('tva_rate') / Value(100.0) * Value(float(vat_impact)))),
                    output_field=DecimalField()
                )),
                default=Coalesce(
                    Subquery(last_price_subquery, output_field=DecimalField()),
                    Decimal('0.00'),
                    output_field=DecimalField()
                ),
                output_field=DecimalField()
            )
        ).annotate(
            margin_pct=Case(
                When(effective_cost_sql__gt=0, then=ExpressionWrapper(
                    (F('selling_price_ht') - F('effective_cost_sql')) / F('effective_cost_sql') * 100.0,
                    output_field=FloatField()
                )),
                default=Value(0.0),
                output_field=FloatField()
            )
        )
        
        # Apply Computed Filters
        if min_stock is not None:
            qs = qs.filter(stock_level__gte=float(min_stock))
        if max_stock is not None:
            qs = qs.filter(stock_level__lte=float(max_stock))
        if min_margin:
            qs = qs.filter(margin_pct__gte=float(min_margin))
        
        if rotation == 'fast':
            qs = qs.filter(daily_sales__gte=5.0)
        elif rotation == 'medium':
            qs = qs.filter(daily_sales__gte=1.0, daily_sales__lt=5.0)
        elif rotation == 'slow':
            qs = qs.filter(daily_sales__gt=0, daily_sales__lt=1.0)
        elif rotation == 'dead':
            qs = qs.filter(daily_sales=0)
            
        supplier_specific_subquery = None
        if supplier:
            qs = qs.filter(qualified_suppliers__supplier_id=supplier)
            supplier_specific_subquery = ProductSupplier.objects.filter(
                organization=organization, supplier_id=supplier, product=OuterRef('pk')
            ).values('last_purchased_price')[:1]

        qs = qs.annotate(
            last_pp=Coalesce(Subquery(last_price_subquery, output_field=DecimalField()), Decimal('0'), output_field=DecimalField()),
            supplier_pp=Coalesce(Subquery(supplier_specific_subquery, output_field=DecimalField()), Decimal('0'), output_field=DecimalField()) if supplier_specific_subquery else Value(Decimal('0'), output_field=DecimalField())
        )
        
        # Pagination — fetch page_size+1 to detect has_more without .count()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 30))
        offset = (page - 1) * page_size
        products_list = list(qs.order_by('name')[offset:offset + page_size + 1])
        has_more = len(products_list) > page_size
        products_page = products_list[:page_size]
        
        # Resolve Org Tax Policy for Effective Cost calculation (Efficient caching for loop)
        from apps.finance.tax_calculator import TaxEngineContext
        from erp.services import ConfigurationService
        tax_ctx = TaxEngineContext.from_org(organization)
        settings = ConfigurationService.get_global_settings(organization)

        # Resolve Cost using Product.get_effective_cost (One Source of Truth)
        results = []
        for p in products_page:
            resolved_cost = p.get_effective_cost(tax_ctx=tax_ctx, last_pp_fallback=p.last_pp, settings=settings)
            if supplier and (p.supplier_pp or 0) > 0:
                resolved_cost = p.supplier_pp

            # Expiry / Safety (too complex for annotation, but fine in loop for 30)
            avg_expiry = getattr(p, 'avg_available_expiry_days', None) or 0
            is_expiry = getattr(p, 'is_expiry_tracked', False)
            days_to_sell = round(float(p.stock_level) / p.daily_sales) if p.daily_sales > 0 else 0
            safety_tag = 'SAFE'
            if is_expiry and avg_expiry > 0:
                if days_to_sell >= avg_expiry:
                    safety_tag = 'RISKY'
                elif days_to_sell >= avg_expiry * 0.6:
                    safety_tag = 'CAUTION'
            
            results.append({
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'barcode': p.barcode or '',
                'category_name': getattr(p.category, 'name', '') if hasattr(p, 'category') and p.category else '',
                'stock': float(p.stock_level),
                'daily_sales': round(p.daily_sales, 2),
                'cost_price': float(resolved_cost),
                'effective_cost': float(resolved_cost),
                'cost_price_ht': float(p.cost_price_ht or 0),
                'cost_price_ttc': float(p.cost_price_ttc or 0),
                'selling_price': float(p.selling_price_ht or 0),
                'margin_pct': round(p.margin_pct, 1),
                'safety_tag': safety_tag,
                'is_expiry_tracked': is_expiry,
            })
        
        return Response({
            'items': results,
            'total': offset + len(results) + (1 if has_more else 0),  # Approximate total for UI
            'has_more': has_more,
            'page': page,
            'page_size': page_size,
        })

    @action(detail=False, methods=['get'])
    def catalogue_filters(self, request):
        """Return available filter dimensions for the catalogue."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({})
        
        from apps.inventory.models import Category, Brand
        
        categories = list(Category.objects.filter(
            organization_id=organization_id
        ).values('id', 'name').order_by('name')[:100])
        
        brands = list(Brand.objects.filter(
            organization_id=organization_id
        ).values('id', 'name').order_by('name')[:100])
        
        # Product types
        types = list(Product.objects.filter(
            organization_id=organization_id, status='ACTIVE'
        ).values_list('product_type', flat=True).distinct()[:20]) if hasattr(Product, 'product_type') else []
        
        return Response({
            'categories': categories,
            'brands': brands,
            'types': [t for t in types if t],
        })
