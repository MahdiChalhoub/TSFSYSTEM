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
        warehouse_id = request.query_params.get('warehouse_id')
        stock_scope = request.query_params.get('stock_scope', 'branch')  # 'branch' or 'all'
        
        from django.utils import timezone
        from datetime import timedelta
        from decimal import Decimal
        
        products_qs = Product.objects.filter(organization=organization, status='ACTIVE')
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
        
        products_qs = products_qs[:20]
        
        data = []
        thirty_days_ago = timezone.now() - timedelta(days=30)
        ninety_days_ago = timezone.now() - timedelta(days=90)
        
        for p in products_qs:
            # ── Stock ──
            stock_filter = {'organization': organization, 'product': p}
            if warehouse_id:
                stock_filter['warehouse_id'] = warehouse_id
            elif site_id:
                stock_filter['warehouse__parent_id'] = site_id
            
            stock_in_location = Inventory.objects.filter(**stock_filter).aggregate(
                total=Sum('quantity'))['total'] or 0
            
            total_stock = Inventory.objects.filter(
                organization=organization, product=p
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            # Other warehouse stock for transfer suggestions
            other_warehouse_stock = []
            if warehouse_id or site_id:
                other_inv = Inventory.objects.filter(
                    organization=organization, product=p, quantity__gt=0
                ).exclude(
                    **({'warehouse_id': warehouse_id} if warehouse_id else {'warehouse__parent_id': site_id})
                ).values('warehouse__name', 'warehouse__id').annotate(
                    qty=Sum('quantity')
                ).order_by('-qty')[:5]
                other_warehouse_stock = [
                    {'warehouse': i['warehouse__name'], 'warehouse_id': i['warehouse__id'], 'qty': float(i['qty'])}
                    for i in other_inv
                ]
            
            # Stock in transit
            from apps.inventory.models import TransferOrder
            stock_in_transit = 0
            try:
                transit_filter = {'organization': organization, 'status__in': ['PENDING', 'IN_TRANSIT']}
                if warehouse_id:
                    transit_filter['destination_warehouse_id'] = warehouse_id
                transfers = TransferOrder.objects.filter(**transit_filter)
                for t in transfers:
                    from apps.inventory.models import TransferOrderLine
                    stock_in_transit += TransferOrderLine.objects.filter(
                        transfer_order=t, product=p
                    ).aggregate(total=Sum('quantity'))['total'] or 0
            except Exception:
                pass
            
            # ── Sales ──
            sales_30d = OrderLine.objects.filter(
                order__organization=organization,
                product=p,
                order__created_at__gte=thirty_days_ago,
                order__status='COMPLETED',
                order__type='SALE'
            ).aggregate(
                total_qty=Sum('quantity'),
                total_amount=Sum('total_amount')
            )
            sales_qty_30d = float(sales_30d['total_qty'] or 0)
            daily_sales = sales_qty_30d / 30.0
            monthly_average = sales_qty_30d
            
            total_sales_all = OrderLine.objects.filter(
                order__organization=organization,
                product=p,
                order__status='COMPLETED',
                order__type='SALE'
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            
            # ── Purchases ──
            from apps.pos.models import PurchaseOrderLine
            purchase_data = PurchaseOrderLine.objects.filter(
                order__organization=organization,
                product=p,
            ).aggregate(
                count=models.Count('id'),
                total=Sum('line_total')
            )
            purchase_count = purchase_data['count'] or 0
            total_purchased = float(purchase_data['total'] or 0)
            
            # ── Financial Score ──
            # financial_score = (total_sales / total_purchased) * 100 if purchased > 0
            financial_score = 0
            if total_purchased > 0:
                financial_score = round((float(total_sales_all) / total_purchased) * 100)
            
            # adjustment_score = (adjustments_qty / total_purchased_qty) * 100
            from apps.inventory.models import StockAdjustment
            adjustment_qty = 0
            try:
                adjustment_qty = abs(float(StockAdjustment.objects.filter(
                    organization=organization, product=p
                ).aggregate(total=Sum('quantity_change'))['total'] or 0))
            except Exception:
                pass
            
            purchased_qty_total = PurchaseOrderLine.objects.filter(
                order__organization=organization, product=p
            ).aggregate(total=Sum('quantity'))['total'] or 1
            adjustment_score = round((adjustment_qty / float(purchased_qty_total)) * 100)
            
            # ── Best Supplier ──
            best_supplier_name = ''
            best_supplier_price = 0
            try:
                from apps.pos.models import ProductSupplier
                best = ProductSupplier.objects.filter(
                    organization=organization, product=p
                ).order_by('last_purchased_price').first()
                if best:
                    best_supplier_name = best.supplier.name if best.supplier else ''
                    best_supplier_price = float(best.last_purchased_price or 0)
            except Exception:
                pass
            
            # ── Expiry / Safety ──
            shelf_life_days = getattr(p, 'manufacturer_shelf_life_days', None) or 0
            avg_expiry_days = getattr(p, 'avg_available_expiry_days', None) or 0
            is_expiry_tracked = getattr(p, 'is_expiry_tracked', False)
            
            # days_to_sell_all = total_stock / daily_sales (if daily_sales > 0)
            days_to_sell_all = 0
            if daily_sales > 0:
                days_to_sell_all = round(float(total_stock) / daily_sales)
            
            # Safety tag:
            # SAFE = days_to_sell_all < avg_expiry_days * 0.6  
            # CAUTION = days_to_sell_all < avg_expiry_days
            # RISKY = days_to_sell_all >= avg_expiry_days (will expire before sold)
            safety_tag = 'SAFE'
            if is_expiry_tracked and avg_expiry_days > 0:
                if days_to_sell_all >= avg_expiry_days:
                    safety_tag = 'RISKY'
                elif days_to_sell_all >= avg_expiry_days * 0.6:
                    safety_tag = 'CAUTION'
            
            # ── Proposed Qty ──
            lead_time = getattr(p, 'shipping_duration_days', None) or 14
            proposed_qty = max(0, int(daily_sales * lead_time - float(stock_in_location)))
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode or '',
                "category_name": getattr(p.category, 'name', '') if hasattr(p, 'category') and p.category else '',
                "is_active": p.status == 'ACTIVE',
                
                # Pricing
                "cost_price": float(p.cost_price or 0),
                "costPriceHT": float(p.cost_price_ht or 0),
                "selling_price_ht": float(p.selling_price_ht or 0),
                "selling_price": float(p.selling_price_ttc or 0),
                
                # Stock
                "stockLevel": float(stock_in_location),
                "stock_on_location": float(stock_in_location),
                "total_stock": float(total_stock),
                "stock_in_transit": float(stock_in_transit),
                "other_warehouse_stock": other_warehouse_stock,
                
                # Sales
                "daily_sales": round(daily_sales, 2),
                "avg_daily_sales": round(daily_sales, 2),
                "monthly_average": round(monthly_average, 1),
                "total_sold": float(total_sales_all or 0),
                
                # Purchases
                "purchase_count": purchase_count,
                "total_purchased": total_purchased,
                
                # Financial
                "financial_score": financial_score,
                "sales_performance_score": financial_score,
                "adjustment_score": adjustment_score,
                "adjustment_risk_score": adjustment_score,
                
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
        from django.db.models import Subquery, OuterRef, DecimalField
        from django.db.models.functions import Coalesce
        
        organization = Organization.objects.get(id=organization_id)
        qs = Product.objects.filter(organization=organization, status='ACTIVE')
        
        # Apply filters
        category = request.query_params.get('category')
        brand = request.query_params.get('brand')
        supplier = request.query_params.get('supplier')
        product_type = request.query_params.get('type')
        tax_rate = request.query_params.get('tax_rate')
        min_stock = request.query_params.get('min_stock')
        max_stock = request.query_params.get('max_stock')
        min_margin = request.query_params.get('min_margin')
        query = request.query_params.get('query', '')
        
        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(sku__icontains=query) | Q(barcode__icontains=query))
        if category:
            qs = qs.filter(category_id=category)
        if brand:
            qs = qs.filter(brand__icontains=brand) if hasattr(Product, 'brand') else qs
        if product_type:
            qs = qs.filter(product_type=product_type) if hasattr(Product, 'product_type') else qs
        if tax_rate:
            qs = qs.filter(tax_rate=tax_rate) if hasattr(Product, 'tax_rate') else qs
        
        # Annotate stock from Inventory
        stock_subquery = Inventory.objects.filter(
            organization=organization, product=OuterRef('pk')
        ).values('product').annotate(total=Sum('quantity')).values('total')
        
        qs = qs.annotate(
            stock_level=Coalesce(Subquery(stock_subquery, output_field=DecimalField()), 0)
        )
        
        # Stock filter
        if min_stock is not None:
            qs = qs.filter(stock_level__gte=float(min_stock))
        if max_stock is not None:
            qs = qs.filter(stock_level__lte=float(max_stock))
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 30))
        total_count = qs.count()
        offset = (page - 1) * page_size
        products_page = qs.order_by('name')[offset:offset + page_size]
        
        # Sales subquery (30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        results = []
        for p in products_page:
            stock = float(getattr(p, 'stock_level', 0))
            
            # Quick sales query
            sales_qty = OrderLine.objects.filter(
                order__organization=organization, product=p,
                order__created_at__gte=thirty_days_ago,
                order__status='COMPLETED', order__type='SALE'
            ).aggregate(total=Sum('quantity'))['total'] or 0
            daily_sales = float(sales_qty) / 30.0
            
            # Safety tag
            shelf_life = getattr(p, 'manufacturer_shelf_life_days', None) or 0
            avg_expiry = getattr(p, 'avg_available_expiry_days', None) or 0
            is_expiry = getattr(p, 'is_expiry_tracked', False)
            days_to_sell = round(stock / daily_sales) if daily_sales > 0 else 0
            safety_tag = 'SAFE'
            if is_expiry and avg_expiry > 0:
                if days_to_sell >= avg_expiry:
                    safety_tag = 'RISKY'
                elif days_to_sell >= avg_expiry * 0.6:
                    safety_tag = 'CAUTION'
            
            # Margin
            cost = float(p.cost_price or 0)
            sell = float(p.selling_price_ht or 0)
            margin_pct = round(((sell - cost) / cost * 100) if cost > 0 else 0, 1)
            
            results.append({
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'barcode': p.barcode or '',
                'category_name': getattr(p.category, 'name', '') if hasattr(p, 'category') and p.category else '',
                'stock': stock,
                'daily_sales': round(daily_sales, 2),
                'cost_price': cost,
                'selling_price': sell,
                'margin_pct': margin_pct,
                'safety_tag': safety_tag,
                'is_expiry_tracked': is_expiry,
            })
        
        return Response({
            'results': results,
            'count': total_count,
            'page': page,
            'page_size': page_size,
        })

    @action(detail=False, methods=['get'])
    def catalogue_filters(self, request):
        """Return available filter dimensions for the catalogue."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({})
        
        from apps.inventory.models import Category
        
        categories = list(Category.objects.filter(
            organization_id=organization_id
        ).values('id', 'name').order_by('name')[:100])
        
        # Product types
        types = list(Product.objects.filter(
            organization_id=organization_id, status='ACTIVE'
        ).values_list('product_type', flat=True).distinct()[:20]) if hasattr(Product, 'product_type') else []
        
        return Response({
            'categories': categories,
            'types': [t for t in types if t],
        })
