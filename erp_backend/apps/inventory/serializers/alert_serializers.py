from rest_framework import serializers
from apps.inventory.models import StockAlert

class StockAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    acknowledged_by_name = serializers.SerializerMethodField()
    purchase_order_number = serializers.ReadOnlyField(source='purchase_order.po_number')

    class Meta:
        model = StockAlert
        fields = '__all__'
        read_only_fields = ['organization', 'acknowledged_by', 'acknowledged_at',
                            'resolved_at']

    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by:
            name = f"{obj.acknowledged_by.first_name} {obj.acknowledged_by.last_name}".strip()
            return name or obj.acknowledged_by.username
        return None
