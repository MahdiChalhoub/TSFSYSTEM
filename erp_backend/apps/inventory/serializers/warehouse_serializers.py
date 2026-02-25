from rest_framework import serializers
from apps.inventory.models import Warehouse, Inventory, InventoryMovement
from erp.models import Site

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source='site.name', read_only=True, default=None)
    inventory_count = serializers.SerializerMethodField()
    site = serializers.PrimaryKeyRelatedField(
        queryset=Site.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Warehouse
        fields = [
            'id', 'site', 'name', 'code', 'type',
            'can_sell', 'is_active',
            'site_name', 'inventory_count',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_inventory_count(self, obj):
        return obj.inventory_set.count()


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
