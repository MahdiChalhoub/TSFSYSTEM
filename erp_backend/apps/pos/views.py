"""
POS Module Views
ViewSets for Point of Sale and Purchase Order operations.
"""
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.middleware import get_current_tenant_id
from erp.models import Organization

# Gated cross-module imports
try:
    from apps.inventory.models import Warehouse
except ImportError:
    Warehouse = None

from apps.pos.models import Order
from apps.pos.services import POSService, PurchaseService
from apps.pos.returns_models import SalesReturn, CreditNote, PurchaseReturn
from apps.pos.returns_service import ReturnsService
from apps.pos.serializers import (
    SalesReturnSerializer, CreditNoteSerializer, PurchaseReturnSerializer
)
from erp.views import TenantModelViewSet


class POSViewSet(viewsets.ViewSet):
    """Handles Point of Sale transactions."""
    @action(detail=False, methods=['post'])
    def checkout(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        try:
            warehouse_id = request.data.get('warehouse_id')
            payment_account_id = request.data.get('payment_account_id')
            items = request.data.get('items')
            scope = request.data.get('scope', 'OFFICIAL')
            user = request.user
            if user.is_anonymous:
                from erp.models import User
                user = User.objects.filter(organization=organization, is_staff=True).first()
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            order = POSService.checkout(
                organization=organization, user=user, warehouse=warehouse,
                payment_account_id=payment_account_id, items=items, scope=scope
            )
            return Response({
                "message": "Checkout successful",
                "order_id": order.id,
                "total_amount": float(order.total_amount)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback; traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PurchaseViewSet(viewsets.ViewSet):
    """Handles Purchase Order (PO) operations."""
    def list(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=organization_id)
        qs = Order.objects.filter(organization=organization, type='PURCHASE').order_by('-created_at')
        data = []
        for o in qs:
            data.append({
                "id": o.id, "refCode": o.ref_code, "createdAt": o.created_at,
                "status": o.status, "totalAmount": float(o.total_amount),
                "contact": {"name": o.contact.name} if o.contact else None,
                "user": {"name": f"{o.user.first_name} {o.user.last_name}".strip() or o.user.username} if o.user else None
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

    @action(detail=False, methods=['post'])
    def quick_purchase(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "No organization"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            order = PurchaseService.quick_purchase(
                organization=organization,
                supplier_id=request.data.get('supplierId'),
                warehouse_id=request.data.get('warehouseId'),
                site_id=request.data.get('siteId'),
                scope=request.data.get('scope'),
                invoice_price_type=request.data.get('invoicePriceType'),
                vat_recoverable=request.data.get('vatRecoverable'),
                lines=request.data.get('lines', []),
                notes=request.data.get('notes'),
                ref_code=request.data.get('refCode'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response({"success": True, "orderId": order.id})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


# =============================================================================
# RETURNS & CREDIT NOTES
# =============================================================================

class SalesReturnViewSet(TenantModelViewSet):
    """Handles sales returns with create, approve, cancel lifecycle."""
    queryset = SalesReturn.objects.all()
    serializer_class = SalesReturnSerializer

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.create_sales_return(
                organization=organization,
                order_id=request.data.get('order_id'),
                return_date=request.data.get('return_date'),
                lines=request.data.get('lines', []),
                reason=request.data.get('reason'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(SalesReturnSerializer(result).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.approve_sales_return(
                organization=organization,
                return_id=pk,
                user=request.user if request.user.is_authenticated else None
            )
            return Response(SalesReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.cancel_sales_return(organization, pk)
            return Response(SalesReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class CreditNoteViewSet(TenantModelViewSet):
    """Read-only listing of auto-generated credit notes."""
    queryset = CreditNote.objects.all()
    serializer_class = CreditNoteSerializer


class PurchaseReturnViewSet(TenantModelViewSet):
    """Handles purchase returns with create and complete lifecycle."""
    queryset = PurchaseReturn.objects.all()
    serializer_class = PurchaseReturnSerializer

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.create_purchase_return(
                organization=organization,
                order_id=request.data.get('order_id'),
                return_date=request.data.get('return_date'),
                lines=request.data.get('lines', []),
                reason=request.data.get('reason'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.complete_purchase_return(
                organization=organization,
                return_id=pk,
                warehouse_id=request.data.get('warehouse_id'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

