from rest_framework import serializers
from apps.inventory.models import StockAdjustmentOrder, StockAdjustmentLine, StockTransferOrder, StockTransferLine

class StockAdjustmentLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default=None)
    reflect_transfer_ref = serializers.CharField(
        source='reflect_transfer.reference', read_only=True, default=None
    )

    class Meta:
        model = StockAdjustmentLine
        fields = [
            'id', 'order', 'product', 'product_name',
            'qty_adjustment', 'amount_adjustment',
            'warehouse', 'warehouse_name',
            'reason', 'recovered_amount',
            'reflect_transfer', 'reflect_transfer_ref',
            'added_by', 'added_by_name',
        ]
        read_only_fields = ['order']


class StockAdjustmentOrderSerializer(serializers.ModelSerializer):
    lines = StockAdjustmentLineSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = StockAdjustmentOrder
        fields = [
            'id', 'reference', 'date', 'supplier', 'supplier_name',
            'warehouse', 'warehouse_name', 'reason',
            'total_qty_adjustment', 'total_amount_adjustment',
            'notes', 'status', 'is_locked', 'locked_by', 'locked_by_name',
            'locked_at', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'lines', 'line_count', 'tenant',
        ]
        read_only_fields = ['tenant', 'reference', 'status', 'is_locked', 
                            'locked_by', 'locked_at', 'total_qty_adjustment',
                            'total_amount_adjustment']

    def get_line_count(self, obj):
        return obj.lines.count()


class StockTransferLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True, default=None)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, default=None)
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default=None)

    class Meta:
        model = StockTransferLine
        fields = [
            'id', 'order', 'product', 'product_name',
            'qty_transferred',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'reason', 'recovered_amount',
            'added_by', 'added_by_name',
        ]
        read_only_fields = ['order']


class StockTransferOrderSerializer(serializers.ModelSerializer):
    lines = StockTransferLineSerializer(many=True, read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True, default=None)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, default=None)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)
    locked_by_name = serializers.CharField(source='locked_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = StockTransferOrder
        fields = [
            'id', 'reference', 'date',
            'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'driver', 'supplier', 'supplier_name', 'reason',
            'total_qty_transferred', 'notes', 'status', 'is_locked', 
            'locked_by', 'locked_by_name', 'locked_at',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'lines', 'line_count', 'tenant',
        ]
        read_only_fields = ['tenant', 'reference', 'status', 'is_locked', 
                            'locked_by', 'locked_at', 'total_qty_transferred']

    def get_line_count(self, obj):
        return obj.lines.count()
