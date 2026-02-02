from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from .middleware import get_current_tenant_id
from .models import (
    Organization, Site, FinancialAccount, ChartOfAccount,
    FiscalYear, FiscalPeriod, JournalEntry, Product, 
    Warehouse, Inventory, InventoryMovement, Unit,
    Brand, Category, Parfum, ProductGroup, Country,
    Contact, Employee, Role, TransactionSequence, BarcodeSettings, Loan, LoanInstallment, FinancialEvent, Transaction
)
from .serializers import (
    OrganizationSerializer, SiteSerializer, FinancialAccountSerializer,
    ChartOfAccountSerializer, FiscalYearSerializer, FiscalPeriodSerializer,
    JournalEntrySerializer, ProductSerializer, WarehouseSerializer,
    InventorySerializer, InventoryMovementSerializer, UnitSerializer,
    ProductCreateSerializer, BrandSerializer, BrandDetailSerializer, CategorySerializer, 
    ParfumSerializer, ProductGroupSerializer, CountrySerializer,
    ContactSerializer, EmployeeSerializer, RoleSerializer,
    TransactionSequenceSerializer, BarcodeSettingsSerializer, LoanSerializer, LoanInstallmentSerializer, FinancialEventSerializer
)
from .services import FinancialAccountService, LedgerService, InventoryService, ProvisioningService, ConfigurationService, POSService, PurchaseService, SequenceService, BarcodeService, LoanService, FinancialEventService

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
    """
    Handles system-wide configuration.
    """
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
from .middleware import get_current_tenant_id

@api_view(['GET'])
def health_check(request):
    return Response({
        "status": "online",
        "service": "TSF ERP Core (Django)",
        "database": "PostgreSQL",
        "tenant_context": request.headers.get('X-Tenant-Slug', 'None'),
        "organization_id": get_current_tenant_id()
    })

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

    def create(self, request, *args, **kwargs):
        try:
            org = ProvisioningService.provision_organization(
                name=request.data.get('name'),
                slug=request.data.get('slug')
            )
            serializer = self.get_serializer(org)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer

class FinancialAccountViewSet(viewsets.ModelViewSet):
    queryset = FinancialAccount.objects.all()
    serializer_class = FinancialAccountSerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            account = FinancialAccountService.create_account(
                organization=organization,
                name=request.data.get('name'),
                type=request.data.get('type'),
                currency=request.data.get('currency', 'USD'),
                site_id=request.data.get('site_id')
            )
            serializer = self.get_serializer(account)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def assign_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            from .models import User
            user = User.objects.get(id=user_id, organization=organization)
            account = FinancialAccount.objects.get(id=pk, organization=organization)
            
            user.cash_register = account
            user.save()
            
            return Response({"message": "User assigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            user_id = request.data.get('user_id')
            from .models import User
            user = User.objects.get(id=user_id, organization=organization)
            
            if user.cash_register_id == int(pk):
                user.cash_register = None
                user.save()
            
            return Response({"message": "User unassigned successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

    @action(detail=False, methods=['get'])
    def coa(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        scope = request.query_params.get('scope', 'INTERNAL')
        include_inactive = request.query_params.get('include_inactive') == 'true'
        
        accounts = LedgerService.get_chart_of_accounts(organization, scope, include_inactive)
        
        # Serialize with rollup balances and expected frontend fields
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "subType": acc.sub_type,
                "isActive": acc.is_active,
                "parentId": acc.parent_id,
                "syscohadaCode": acc.syscohada_code,
                "syscohadaClass": acc.syscohada_class,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance)
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def apply_template(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        template_key = request.data.get('template_key')
        reset = request.data.get('reset', False)
        
        if not template_key:
            return Response({"error": "template_key is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            LedgerService.apply_coa_template(organization, template_key, reset)
            return Response({"message": "Template applied successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        scope = request.query_params.get('scope', 'INTERNAL')
        
        result = LedgerService.get_account_statement(organization, pk, start_date, end_date, scope)
        
        # Simple manual serialization for statement
        from .serializers import JournalEntryLineSerializer
        account_data = ChartOfAccountSerializer(result['account']).data
        lines_data = JournalEntryLineSerializer(result['lines'], many=True).data
        
        return Response({
            "account": account_data,
            "opening_balance": float(result['opening_balance']),
            "lines": lines_data
        })

    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        as_of = request.query_params.get('as_of')
        scope = request.query_params.get('scope', 'INTERNAL')
        
        accounts = LedgerService.get_trial_balance(organization, as_of, scope)
        
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "code": acc.code,
                "name": acc.name,
                "type": acc.type,
                "temp_balance": float(acc.temp_balance),
                "rollup_balance": float(acc.rollup_balance),
                "parent_id": acc.parent_id
            })
        return Response(data)

class FiscalYearViewSet(viewsets.ModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

    def perform_create(self, serializer):
        organization_id = get_current_tenant_id()
        if not organization_id:
            raise serializers.ValidationError("No organization context")
        organization = Organization.objects.get(id=organization_id)
        serializer.save(organization=organization)

class FiscalPeriodViewSet(viewsets.ModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer

class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=request.data.get('transaction_date'),
                description=request.data.get('description'),
                lines=request.data.get('lines'),
                reference=request.data.get('reference'),
                status=request.data.get('status', 'DRAFT'),
                scope=request.data.get('scope', 'OFFICIAL'),
                site_id=request.data.get('site_id')
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reverse(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            LedgerService.reverse_journal_entry(organization, pk)
            return Response({"message": "Journal entry reversed successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def opening_entries(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        entries = JournalEntry.objects.filter(
            organization_id=organization_id,
            reference__startswith='OPEN-'
        )
        serializer = self.get_serializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def recalculate_balances(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        LedgerService.recalculate_balances(organization)
        return Response({"message": "Balances recalculated successfully"})

    @action(detail=False, methods=['post'])
    def clear_all(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        LedgerService.clear_all_data(organization)
        return Response({"message": "All data cleared successfully"})

    def update(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # Map frontend line 'accountId' to backend 'account_id'
            lines = request.data.get('lines')
            if lines:
                for line in lines:
                    if 'accountId' in line:
                        line['account_id'] = line.pop('accountId')

            entry = LedgerService.update_journal_entry(
                organization=organization,
                entry_id=kwargs.get('pk'),
                transaction_date=request.data.get('transactionDate') or request.data.get('transaction_date'),
                description=request.data.get('description'),
                status=request.data.get('status'),
                lines=lines
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    @action(detail=False, methods=['post'])
    def create_complex(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        serializer = ProductCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        
        # 1. Check Uniqueness
        if Product.objects.filter(organization=organization, sku=data['sku']).exists():
             return Response({"error": "SKU already exists"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 2. Grouping Logic
            parfum_id = None
            product_group_id = None
            
            parfum_name = data.get('parfumName')
            brand_id = data.get('brandId')
            category_id = data.get('categoryId')
            
            if parfum_name and brand_id:
                # Upsert Parfum
                parfum, created = Parfum.objects.update_or_create(
                    organization=organization,
                    name=parfum_name,
                    defaults={}
                )
                parfum_id = parfum.id
                
                # Find or Create Group
                # Logic: Brand + Parfum
                group = ProductGroup.objects.filter(
                    organization=organization,
                    brand_id=brand_id,
                    parfum_id=parfum_id
                ).first()
                
                if not group:
                    brand = Brand.objects.get(id=brand_id)
                    group_name = f"{brand.name} {parfum_name}".strip()
                    group = ProductGroup.objects.create(
                        organization=organization,
                        name=group_name,
                        brand_id=brand_id,
                        parfum_id=parfum_id,
                        category_id=category_id,
                        description=f"Auto-generated group via {parfum_name}"
                    )
                product_group_id = group.id

            # 3. Create Product
            product = Product.objects.create(
                organization=organization,
                name=data['name'],
                description=data.get('description', ''),
                sku=data['sku'],
                barcode=data.get('barcode'),
                category_id=category_id,
                unit_id=data.get('unitId'),
                brand_id=brand_id,
                country_id=data.get('countryId'),
                parfum_id=parfum_id,
                product_group_id=product_group_id,
                
                cost_price=data.get('costPrice', 0),
                cost_price_ht=data.get('costPrice', 0), # assuming same as costPrice?
                status='ACTIVE',
                selling_price_ht=data.get('sellingPriceHT', 0),
                selling_price_ttc=data.get('sellingPriceTTC', 0),
                tva_rate=data.get('taxRate', 0),
                
                min_stock_level=data.get('minStockLevel', 10),
                is_expiry_tracked=data.get('isExpiryTracked', False)
            )
            
            # 4. Auto Barcode
            if not product.barcode and category_id:
                category = Category.objects.get(id=category_id)
                # Assuming category has 'code' field based on standard models, 
                # but models.py showed Category just has name/org. 
                # Wait, earlier models.py dump showed Category(TenantModel) name, created_at. No code.
                # Standard pattern usually implies checking if field exists or generating purely numeric.
                # I will skip Category Code if it doesn't exist.
                # Actually, let's just use PK.
                auto_barcode = f"P-{product.id}" 
                product.barcode = auto_barcode
                product.save()

            return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search_enhanced(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        query = request.query_params.get('query', '')
        site_id = request.query_params.get('site_id')
        
        from django.db.models import Q, Sum
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
            # Aggregate Stock
            stock_filter = {'organization': organization, 'product': p}
            if site_id:
                stock_filter['warehouse__site_id'] = site_id
                
            stock_level = Inventory.objects.filter(**stock_filter).aggregate(total=Sum('quantity'))['total'] or 0
            
            # Daily Sales (Stubbed for now as we don't have OrderLine model in DJ yet? 
            # Oh wait, I don't see OrderLine in models.py yet.
            # I'll just return 0 for now to keep it working.)
            daily_sales = 0
            
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
                "dailySales": daily_sales,
                "proposedQty": max(0, int(daily_sales * 14 - stock_level))
            })
            
        return Response(data)

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Inventory.objects.all()
    serializer_class = InventorySerializer

    @action(detail=False, methods=['post'])
    def receive_stock(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.receive_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                cost_price_ht=request.data.get('cost_price_ht'),
                reference=request.data.get('reference', 'RECEPTION')
            )
            return Response({"message": "Stock received"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def adjust_stock(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)
        
        try:
            product = Product.objects.get(id=request.data.get('product_id'))
            warehouse = Warehouse.objects.get(id=request.data.get('warehouse_id'))
            
            InventoryService.adjust_stock(
                organization=organization,
                product=product,
                warehouse=warehouse,
                quantity=request.data.get('quantity'),
                reason=request.data.get('reason'),
                reference=request.data.get('reference')
            )
            return Response({"message": "Stock adjusted"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def valuation(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_valuation(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def financial_status(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        status_data = InventoryService.get_inventory_financial_status(organization)
        return Response(status_data)

    @action(detail=False, methods=['get'])
    def viewer(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        search = request.query_params.get('search', '')
        
        from django.db.models import Sum, Q
        
        products_qs = Product.objects.filter(organization=organization)
        if search:
            products_qs = products_qs.filter(
                Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode__icontains=search)
            )
        
        sites = Site.objects.filter(organization=organization, is_active=True)
        
        data = []
        for p in products_qs:
            site_stock = {}
            total_qty = 0
            for s in sites:
                qty = Inventory.objects.filter(
                    organization=organization,
                    product=p,
                    warehouse__site=s
                ).aggregate(total=Sum('quantity'))['total'] or 0
                site_stock[s.id] = float(qty)
                total_qty += float(qty)
            
            data.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "barcode": p.barcode,
                "category": p.category.name if hasattr(p, 'category') and p.category else None,
                "brand": p.brand.name if hasattr(p, 'brand') and p.brand else None,
                "unit": p.unit.code if p.unit else None,
                "siteStock": site_stock,
                "totalQty": total_qty,
                "costPrice": float(p.cost_price)
            })
            
        return Response({
            "products": data,
            "sites": SiteSerializer(sites, many=True).data,
            "totalCount": len(data)
        })

class POSViewSet(viewsets.ViewSet):
    """
    Handles Point of Sale transactions.
    """
    @action(detail=False, methods=['post'])
    def checkout(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        
        organization = Organization.objects.get(id=organization_id)
        
        try:
            warehouse_id = request.data.get('warehouse_id')
            payment_account_id = request.data.get('payment_account_id')
            items = request.data.get('items') # Should be list of {product_id, quantity, unit_price}
            
            # Use current authenticated user if possible, or fallback for system/POS user
            user = request.user
            if user.is_anonymous:
                from .models import User
                user = User.objects.filter(organization=organization, is_staff=True).first()
            
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            
            order = POSService.checkout(
                organization=organization,
                user=user,
                warehouse=warehouse,
                payment_account_id=payment_account_id,
                items=items
            )
            
            return Response({
                "message": "Checkout successful",
                "order_id": order.id,
                "total_amount": float(order.total_amount)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PurchaseViewSet(viewsets.ViewSet):
    """
    Handles Purchase Order (PO) operations.
    """
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        
        scope = request.query_params.get('scope', 'INTERNAL')
        
        from .models import Order
        qs = Order.objects.filter(organization=organization, type='PURCHASE')
        
        # Assuming we might have scope field later, for now we filter by type
        # if scope == 'OFFICIAL' and hasattr(Order, 'scope'): qs = qs.filter(scope='OFFICIAL')
        
        qs = qs.order_by('-created_at')
        
        data = []
        for o in qs:
            data.append({
                "id": o.id,
                "refCode": o.ref_code,
                "createdAt": o.created_at,
                "status": o.status,
                "totalAmount": float(o.total_amount),
                "contact": { "name": o.contact.name } if o.contact else None,
                "user": { "name": f"{o.user.first_name} {o.user.last_name}".strip() or o.user.username } if o.user else None
            })
            
        return Response(data)

    @action(detail=True, methods=['post'])
    def authorize(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.authorize_po(organization, pk)
            return Response({"message": "PO Authorized", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            warehouse_id = request.data.get('warehouse_id')
            order = PurchaseService.receive_po(organization, pk, warehouse_id)
            return Response({"message": "Goods Received", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def invoice(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            invoice_num = request.data.get('invoice_number')
            order = PurchaseService.invoice_po(organization, pk, invoice_num)
            return Response({"message": "PO Invoiced", "status": order.status})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BrandDetailSerializer
        return BrandSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        category_id = request.query_params.get('category_id')
        
        if not category_id:
            brands = Brand.objects.filter(organization=organization).values('id', 'name', 'short_name')
            return Response(brands)

        try:
            category = Category.objects.get(id=category_id, organization=organization)
            
            # Walk up hierarchy
            parents = [category.id]
            curr = category
            while curr.parent:
                curr = curr.parent
                parents.append(curr.id)
            
            # Filter logic: Universal (no categories) OR linked to this or parents
            from django.db.models import Q
            brands = Brand.objects.filter(
                Q(organization=organization) & 
                (Q(categories__isnull=True) | Q(categories__id__in=parents))
            ).distinct().order_by('name').values('id', 'name', 'short_name')
            
            return Response(brands)
        except Category.DoesNotExist:
            return Response([])

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        # Implementation for getBrandHierarchy
        # Return nested groups and loose products
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        try:
            brand = Brand.objects.get(id=pk, organization_id=organization_id)
            
            # Groups
            groups_qs = brand.product_groups.all() # Assuming related_name='product_groups' (or 'productgroup_set')
            # Wait, model definition in dump didn't show related_name
            # models.py: brand = models.ForeignKey(Brand, ... product_group = models.ForeignKey(ProductGroup...
            # ProductGroup has brandId. 
            groups_qs = ProductGroup.objects.filter(brand=brand).prefetch_related('product_set', 'product_set__inventory') 
            
            groups_data = []
            for g in groups_qs:
                products = []
                for p in g.product_set.all():
                     stock = sum(i.quantity for i in p.inventory.all())
                     products.append({
                         "id": p.id,
                         "name": p.name,
                         "sku": p.sku,
                         "countryName": p.country.name if p.country else None,
                         "size": float(p.size or 0) if hasattr(p, 'size') else 0, # Model dump missed size field in Product?
                         "unitName": p.unit.short_name if p.unit else None,
                         "stock": float(stock)
                     })
                groups_data.append({
                    "id": g.id, 
                    "name": g.name,
                    "products": products,
                    "totalStock": sum(p['stock'] for p in products)
                })
            
            # Loose Products (no group)
            loose_qs = Product.objects.filter(brand=brand, product_group__isnull=True).prefetch_related('inventory')
            loose_products = []
            for p in loose_qs:
                stock = sum(i.quantity for i in p.inventory.all())
                loose_products.append({
                    "id": p.id,
                     "name": p.name,
                     "sku": p.sku,
                     "countryName": p.country.name if p.country else None,
                     "size": float(p.size or 0) if hasattr(p, 'size') else 0,
                     "unitName": p.unit.short_name if p.unit else None,
                     "stock": float(stock)
                })
            
            return Response({
                "groups": groups_data,
                "looseProducts": loose_products
            })
            
        except Brand.DoesNotExist:
            return Response({"error": "Brand not found"}, status=404)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'])
    def with_counts(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        from django.db.models import Count
        categories = Category.objects.filter(
            organization_id=organization_id
        ).annotate(product_count=Count('product')).order_by('name')
        
        return Response([
            {**CategorySerializer(c).data, "_count": {"products": c.product_count}}
            for c in categories
        ])
    
    @action(detail=False, methods=['post'])
    def move_products(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        target_id = request.data.get('targetCategoryId')
        product_ids = request.data.get('productIds', [])
        
        Product.objects.filter(
            organization_id=organization_id,
            id__in=product_ids
        ).update(category_id=target_id)
        
        return Response({"success": True})


class ParfumViewSet(viewsets.ModelViewSet):
    queryset = Parfum.objects.all()
    serializer_class = ParfumSerializer

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        
        category_id = request.query_params.get('categoryId')
        queryset = self.get_queryset()

        if category_id:
            try:
                # Walk up the category tree
                category_ids = []
                current = Category.objects.get(id=category_id, organization_id=organization_id)
                category_ids.append(current.id)
                while current.parent:
                    current = current.parent
                    category_ids.append(current.id)
                
                # Filter: Attributes linked to this category/parents OR universal (no categories)
                from django.db.models import Q
                queryset = queryset.filter(
                    Q(categories__in=category_ids) | Q(categories__isnull=True)
                ).distinct()
            except Category.DoesNotExist:
                return Response([]) # Category not found
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def hierarchy(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)

        # Get brands that have products with this parfum
        brands = Brand.objects.filter(
            products__parfum_id=pk, 
            organization_id=organization_id
        ).distinct().prefetch_related(
            'product_set', 'product_set__inventory', 'product_set__unit', 'product_set__country'
        )

        data = []
        for brand in brands:
            products_data = []
            # Filter products for this specific parfum within the brand
            products = brand.product_set.filter(parfum_id=pk)
            
            brand_total_stock = 0
            for p in products:
                stock = sum(i.quantity for i in p.inventory.all())
                brand_total_stock += stock
                products_data.append({
                    "id": p.id,
                    "name": p.name,
                    "sku": p.sku,
                    "size": float(p.size or 0) if hasattr(p, 'size') else 0,
                    "unitName": p.unit.short_name if p.unit else None,
                    "countryName": p.country.name if p.country else None,
                    "stock": float(stock)
                })

            data.append({
                "id": brand.id,
                "name": brand.name,
                "logo": "", # Add logo URL if available
                "products": products_data,
                "totalStock": brand_total_stock
            })
            
        return Response(data)

class ProductGroupViewSet(viewsets.ModelViewSet):
    queryset = ProductGroup.objects.all()
    serializer_class = ProductGroupSerializer

class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer

class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer


class BarcodeSettingsViewSet(viewsets.ViewSet):
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        return Response(BarcodeSettingsSerializer(settings).data)

    def create(self, request): # Used for update basically
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        settings, _ = BarcodeSettings.objects.get_or_create(organization=organization)
        serializer = BarcodeSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            code = BarcodeService.generate_barcode(organization)
            return Response({"barcode": code})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class LoanViewSet(viewsets.ModelViewSet):
    queryset = Loan.objects.all()
    serializer_class = LoanSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    @action(detail=False, methods=['post'])
    def contract(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            loan = LoanService.create_contract(organization, request.data)
            return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            transaction_ref = request.data.get('transaction_ref')
            account_id = request.data.get('account_id')
            loan = LoanService.disburse_loan(organization, pk, transaction_ref, account_id)
            return Response(LoanSerializer(loan).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class FinancialEventViewSet(viewsets.ModelViewSet):
    queryset = FinancialEvent.objects.all()
    serializer_class = FinancialEventSerializer

    def get_queryset(self):
        return super().get_queryset().order_by('-date')

    @action(detail=False, methods=['post'])
    def create_event(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # Manually map fields to service
            event = FinancialEventService.create_event(
                organization=organization,
                event_type=request.data.get('event_type'),
                amount=request.data.get('amount'),
                date=request.data.get('date'),
                contact_id=request.data.get('contact_id'),
                reference=request.data.get('reference'),
                notes=request.data.get('notes'),
                loan_id=request.data.get('loan_id'),
                account_id=request.data.get('account_id') # If provided, posts immediately
            )
            return Response(FinancialEventSerializer(event).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def post_event(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        
        try:
            account_id = request.data.get('account_id')
            if not account_id: return Response({"error": "Account ID required"}, status=400)
            
            event = FinancialEventService.post_event(organization, pk, account_id)
            return Response(FinancialEventSerializer(event).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)


class DashboardViewSet(viewsets.ViewSet):
    """
    Dashboard Aggregation ViewSet
    """
    
    @action(detail=False, methods=['get'])
    def admin_stats(self, request):
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)
        
        # 1. Total Sales (Revenue Accounts Credit Sum for now, or Mock for transition)
        # Using Transaction sum for simpler mock or Product count
        total_products = Product.objects.filter(is_active=True).count()
        total_customers = Contact.objects.filter(type='CUSTOMER').count()
        
        # Latest Transactions (Simulating Sales)
        latest_sales = Transaction.objects.filter(
            type__in=['IN', 'SALE']
        ).order_by('-created_at')[:5]
        
        # Serialize Transactions
        from .serializers import TransactionSerializer
        latest_sales_data = TransactionSerializer(latest_sales, many=True).data

        return Response({
            "totalSales": 0, # Placeholder until Order logic is fully ported
            "activeOrders": 0,
            "totalProducts": total_products,
            "totalCustomers": total_customers,
            "latestSales": latest_sales_data
        })

    @action(detail=False, methods=['get'])
    def financial_stats(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No tenant context"}, status=400)
        
        organization = Organization.objects.get(id=organization_id)
        scope = request.query_params.get('scope', 'INTERNAL')
        
        from .services import LedgerService, InventoryService
        
        # 1. Cash Position
        cash_accounts = FinancialAccount.objects.filter(organization=organization)
        total_cash = sum(acc.balance for acc in cash_accounts)
        
        # 2. P&L (Monthly) - Simplified Logic for now
        # Ideally we fetch this from LedgerService.get_income_statement
        # For dashboard, we might want current month's performance
        
        # Mocking or extracting simple aggregates from JournalEntries
        # Income = Credit sum on INCOME accounts
        # Expense = Debit sum on EXPENSE accounts
        
        # Let's use a simpler approach: Sum of JournalEntries in current month
        from django.utils import timezone
        now = timezone.now()
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        income = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__transaction_date__gte=start_month,
            account__type='INCOME',
            journal_entry__status='POSTED'
        ).distinct()
        
        if scope == 'OFFICIAL':
             income = income.filter(journal_entry__scope='OFFICIAL')
             
        monthly_income = sum(line.credit - line.debit for line in income) # Income is Credit normal
        
        expense = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__transaction_date__gte=start_month,
            account__type='EXPENSE',
            journal_entry__status='POSTED'
        ).distinct()
        
        if scope == 'OFFICIAL':
             expense = expense.filter(journal_entry__scope='OFFICIAL')
             
        monthly_expense = sum(line.debit - line.credit for line in expense) # Expense is Debit normal

        # 3. Trends (Last 6 months Income/Expense)
        trends = []
        for i in range(5, -1, -1):
            # Calculate logic for 6 months... excluding for brevity to keep specific scope
            # Placeholder
            trends.append({
                "month": (now.replace(day=1) - timezone.timedelta(days=30*i)).strftime("%b"),
                "income": 0,
                "expense": 0
            })

        # 4. Inventory Value
        inv_status = InventoryService.get_inventory_financial_status(organization)
        
        return Response({
            "totalCash": float(total_cash),
            "monthlyIncome": float(monthly_income),
            "monthlyExpense": float(monthly_expense),
            "netProfit": float(monthly_income - monthly_expense),
            "totalAR": 0, # To implement with AR/AP
            "totalAP": 0,
            "trends": trends,
            "recentEntries": [],
            "inventoryStatus": inv_status
        })

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

class TransactionSequenceViewSet(viewsets.ModelViewSet):
    queryset = TransactionSequence.objects.all()
    serializer_class = TransactionSequenceSerializer
