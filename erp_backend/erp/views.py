from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from .models import (
    Organization, Site, FinancialAccount, ChartOfAccount,
    FiscalYear, FiscalPeriod, JournalEntry, Product, 
    Warehouse, Inventory, InventoryMovement
)
from .serializers import (
    OrganizationSerializer, SiteSerializer, FinancialAccountSerializer,
    ChartOfAccountSerializer, FiscalYearSerializer, FiscalPeriodSerializer,
    JournalEntrySerializer, ProductSerializer, WarehouseSerializer,
    InventorySerializer, InventoryMovementSerializer
)
from .services import FinancialAccountService, LedgerService, InventoryService
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

class OrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

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

class ChartOfAccountViewSet(viewsets.ModelViewSet):
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

class FiscalYearViewSet(viewsets.ModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

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

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

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
