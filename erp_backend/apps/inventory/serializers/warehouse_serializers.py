from rest_framework import serializers
from apps.inventory.models import Warehouse, Inventory, InventoryMovement

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    inventory_count = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'parent', 'name', 'code', 'location_type',
            'address', 'city', 'phone', 'vat_number',
            'can_sell', 'is_active',
            'site_name', 'parent_name', 'inventory_count', 'children_count',
            'organization', 'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']

    def get_inventory_count(self, obj):
        return obj.inventory_set.count()

    def get_children_count(self, obj):
        return obj.children.count()

    def get_site_name(self, obj):
        """Backward compat: return the branch/parent name."""
        if obj.parent:
            return obj.parent.name
        return obj.name if obj.location_type == 'BRANCH' else None


class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = Inventory
        fields = [
            'id', 'warehouse', 'product', 'quantity',
            'expiry_date', 'batch_number', 'batch',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = InventoryMovement
        fields = [
            'id', 'product', 'warehouse', 'type',
            'quantity', 'reference', 'reason',
            'cost_price', 'cost_price_ht', 'created_at',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']
