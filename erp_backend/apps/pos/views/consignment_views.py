from .base import (
    Response, action, get_current_tenant_id,
    TenantModelViewSet, transaction
)
from apps.pos.models import ConsignmentSettlement, ConsignmentSettlementLine
from apps.pos.models import OrderLine
from apps.pos.serializers import (
    ConsignmentSettlementSerializer, ConsignmentSettlementLineSerializer
)

class ConsignmentSettlementViewSet(TenantModelViewSet):
    """ViewSet for managing payouts to consignment suppliers."""
    queryset = ConsignmentSettlement.objects.select_related('supplier', 'performed_by').prefetch_related('lines').all()
    serializer_class = ConsignmentSettlementSerializer

    @action(detail=False, methods=['get'], url_path='pending-items')
    def pending_items(self, request):
        """
        Returns sold consignment items that have not yet been settled.
        Grouped by supplier.
        """
        organization_id = get_current_tenant_id()
        # Find OrderLines that are marked as consignment but not settled
        pending = OrderLine.objects.filter(
            tenant_id=organization_id,
            is_consignment=True,
            consignment_settled=False,
            order__status='COMPLETED'
        ).select_related('product', 'order', 'product__supplier')
        
        # Group by supplier
        from collections import defaultdict
        grouped = defaultdict(list)
        for line in pending:
            supplier = line.product.supplier
            supplier_name = supplier.name if supplier else "Unknown Supplier"
            supplier_id = supplier.id if supplier else None
            grouped[f"{supplier_id}|{supplier_name}"].append({
                "line_id": line.id,
                "order_ref": line.order.ref_code,
                "product_name": line.product.name,
                "quantity": float(line.quantity),
                "unit_cost": float(line.unit_cost_ht),
                "total_cost": float(line.quantity * line.unit_cost_ht),
                "sold_at": str(line.order.created_at)
            })
            
        return Response(dict(grouped))

    @action(detail=False, methods=['post'], url_path='generate-settlement')
    def generate_settlement(self, request):
        """
        Create a settlement record for a list of order lines and a supplier.
        Body: { "supplier_id": 5, "line_ids": [10, 11, 12], "notes": "..." }
        """
        org_id = get_current_tenant_id()
        supplier_id = request.data.get('supplier_id')
        line_ids = request.data.get('line_ids', [])
        notes = request.data.get('notes', '')
        
        if not supplier_id or not line_ids:
            return Response({"error": "supplier_id and line_ids are required"}, status=400)
            
        with transaction.atomic():
            # 1. Create settlement header
            settlement = ConsignmentSettlement.objects.create(
                tenant_id=org_id,
                supplier_id=supplier_id,
                performed_by=request.user if request.user.is_authenticated else None,
                notes=notes,
                status='COMPLETED'
            )
            
            # 2. Link lines and mark as settled
            total_amount = 0
            lines_to_settle = OrderLine.objects.filter(id__in=line_ids, tenant_id=org_id)
            for line in lines_to_settle:
                amount = line.quantity * line.unit_cost_ht
                ConsignmentSettlementLine.objects.create(
                    settlement=settlement,
                    order_line=line,
                    payout_amount=amount,
                    tenant_id=org_id
                )
                line.consignment_settled = True
                line.save(update_fields=['consignment_settled'])
                total_amount += amount
                
            settlement.total_amount = total_amount
            settlement.save(update_fields=['total_amount'])
            
            return Response(ConsignmentSettlementSerializer(settlement).data)
