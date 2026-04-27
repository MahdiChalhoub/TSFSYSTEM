"""Procurement Request serializers."""
from .base import serializers
from apps.pos.models.procurement_request_models import ProcurementRequest


class ProcurementRequestSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    from_warehouse_name = serializers.ReadOnlyField(source='from_warehouse.name')
    to_warehouse_name = serializers.ReadOnlyField(source='to_warehouse.name')
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    requested_by_name = serializers.ReadOnlyField(source='requested_by.username')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.username')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ProcurementRequest
        fields = [
            'id', 'request_type', 'status', 'priority',
            'product', 'product_name', 'product_sku', 'quantity',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'supplier', 'supplier_name',
            'suggested_unit_price',
            'reason', 'notes', 'source_po',
            'requested_by', 'requested_by_name',
            'reviewed_by', 'reviewed_by_name',
            'requested_at', 'reviewed_at',
            'last_bumped_at', 'bump_count',
            'organization',
        ]
        read_only_fields = [
            'status', 'requested_by', 'reviewed_by',
            'requested_at', 'reviewed_at',
            'last_bumped_at', 'bump_count',
        ]
