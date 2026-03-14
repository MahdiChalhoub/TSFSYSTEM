from rest_framework import serializers
from apps.inventory.models import OperationalRequest, OperationalRequestLine

class OperationalRequestLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = OperationalRequestLine
        fields = [
            'id', 'request', 'product', 'product_name',
            'quantity', 'warehouse', 'warehouse_name', 'reason',
        ]
        read_only_fields = ['request']


class OperationalRequestSerializer(serializers.ModelSerializer):
    lines = OperationalRequestLineSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True, default=None)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True, default=None)
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = OperationalRequest
        fields = [
            'id', 'reference', 'request_type', 'date',
            'requested_by', 'requested_by_name',
            'priority', 'status', 'description',
            'approved_by', 'approved_by_name', 'approved_at',
            'converted_to_type', 'converted_to_id',
            'rejection_reason', 'notes',
            'created_at', 'updated_at',
            'lines', 'line_count', 'organization',
        ]
        read_only_fields = ['organization', 'reference', 'approved_by',
                            'approved_at', 'converted_to_type', 'converted_to_id']

    def get_line_count(self, obj):
        return obj.lines.count()
