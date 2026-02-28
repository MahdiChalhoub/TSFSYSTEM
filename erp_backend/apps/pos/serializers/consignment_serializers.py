from .base import serializers
from apps.pos.models import ConsignmentSettlement, ConsignmentSettlementLine

class ConsignmentSettlementLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='order_line.product.name')
    sku = serializers.ReadOnlyField(source='order_line.product.sku')
    order_ref = serializers.ReadOnlyField(source='order_line.order.id')

    class Meta:
        model = ConsignmentSettlementLine
        fields = [
            'id', 'order_line', 'product_name', 'sku', 'order_ref',
            'payout_amount'
        ]


class ConsignmentSettlementSerializer(serializers.ModelSerializer):
    lines = ConsignmentSettlementLineSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    performed_by_name = serializers.ReadOnlyField(source='performed_by.username')

    class Meta:
        model = ConsignmentSettlement
        fields = [
            'id', 'reference', 'supplier', 'supplier_name', 'total_amount',
            'status', 'notes', 'performed_by', 'performed_by_name',
            'created_at', 'updated_at', 'lines'
        ]
