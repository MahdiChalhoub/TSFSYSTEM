from .base import (
    Response, action, get_current_tenant_id,
    Organization, TenantModelViewSet
)
from apps.pos.models import SalesReturn, CreditNote, PurchaseReturn
from apps.pos.services import ReturnsService
from apps.pos.serializers import (
    SalesReturnSerializer, CreditNoteSerializer, PurchaseReturnSerializer
)

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
            # ── Auto-Task: POS_RETURN ──
            try:
                from apps.workspace.signals import trigger_finance_event
                trigger_finance_event(
                    organization, 'POS_RETURN',
                    reference=f'RET-{result.id}',
                    amount=float(getattr(result, 'total_amount', 0) or 0),
                    cashier_id=request.user.id if request.user.is_authenticated else None,
                    user=request.user if request.user.is_authenticated else None,
                    extra={'reason': request.data.get('reason', '')},
                )
            except Exception:
                pass
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
