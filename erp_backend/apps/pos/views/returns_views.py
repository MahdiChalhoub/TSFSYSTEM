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
    """
    Purchase return lifecycle:
    DRAFT → APPROVED → SENT → RECEIVED_BY_SUPPLIER → CREDIT_PENDING → CLOSED | CANCELLED
    """
    queryset = PurchaseReturn.objects.all()
    serializer_class = PurchaseReturnSerializer

    def get_queryset(self):
        from erp.middleware import get_current_tenant_id as _get_tenant
        org_id = _get_tenant()
        if not org_id:
            return PurchaseReturn.objects.none()
        qs = PurchaseReturn.objects.filter(
            tenant_id=org_id
        ).select_related(
            'supplier', 'purchase_order', 'original_order',
            'processed_by', 'approved_by'
        ).prefetch_related('lines', 'lines__product').order_by('-return_date', '-created_at')

        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return_type = self.request.query_params.get('return_type')
        if return_type:
            qs = qs.filter(return_type=return_type)
        supplier = self.request.query_params.get('supplier')
        if supplier:
            qs = qs.filter(supplier_id=supplier)
        po = self.request.query_params.get('purchase_order')
        if po:
            qs = qs.filter(purchase_order_id=po)
        return qs

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        """Legacy: Create purchase return from Order (backward-compatible)."""
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

    @action(detail=False, methods=['post'], url_path='create-from-po')
    def create_from_po(self, request):
        """Enterprise: Create purchase return from formal PurchaseOrder."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.create_purchase_return_v2(
                organization=organization,
                po_id=request.data.get('purchase_order_id'),
                return_date=request.data.get('return_date'),
                lines=request.data.get('lines', []),
                reason=request.data.get('reason'),
                return_type=request.data.get('return_type', 'OTHER'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the return — destocks inventory + posts GL reversal."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.approve_purchase_return(
                organization=organization,
                return_id=pk,
                warehouse_id=request.data.get('warehouse_id'),
                user=request.user if request.user.is_authenticated else None
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Mark return as sent to supplier."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.send_purchase_return(
                organization=organization,
                return_id=pk,
                user=request.user if request.user.is_authenticated else None,
                tracking_ref=request.data.get('tracking_ref'),
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='confirm-received')
    def confirm_received(self, request, pk=None):
        """Mark return as received by supplier."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.receive_supplier_confirmation(
                organization=organization,
                return_id=pk,
                user=request.user if request.user.is_authenticated else None,
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='link-credit-note')
    def link_credit_note(self, request, pk=None):
        """Link a supplier credit note to this return."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        required = ['credit_number', 'date_received', 'amount']
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"error": f"Missing required fields: {', '.join(missing)}"}, status=400)

        try:
            credit_note = ReturnsService.link_supplier_credit_note(
                organization=organization,
                return_id=pk,
                credit_data=request.data,
                user=request.user if request.user.is_authenticated else None,
            )
            from apps.pos.serializers.returns_serializers import SupplierCreditNoteSerializer
            return Response(SupplierCreditNoteSerializer(credit_note).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Legacy: Complete a purchase return (backward-compatible)."""
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

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a purchase return."""
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)
        try:
            result = ReturnsService.cancel_purchase_return(
                organization=organization,
                return_id=pk,
                reason=request.data.get('reason'),
                user=request.user if request.user.is_authenticated else None,
            )
            return Response(PurchaseReturnSerializer(result).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

