"""
Warehouse Location Serializers
"""
from rest_framework import serializers
from apps.inventory.models import (
    WarehouseZone, WarehouseAisle, WarehouseRack,
    WarehouseShelf, WarehouseBin, ProductLocation
)


class WarehouseZoneSerializer(serializers.ModelSerializer):
    aisles_count = serializers.SerializerMethodField()

    class Meta:
        model = WarehouseZone
        fields = '__all__'

    def get_aisles_count(self, obj):
        return obj.aisles.count() if hasattr(obj, 'aisles') else 0


class WarehouseAisleSerializer(serializers.ModelSerializer):
    zone_code = serializers.CharField(source='zone.code', read_only=True)

    class Meta:
        model = WarehouseAisle
        fields = '__all__'


class WarehouseRackSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseRack
        fields = '__all__'


class WarehouseShelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseShelf
        fields = '__all__'


class WarehouseBinSerializer(serializers.ModelSerializer):
    full_location_code = serializers.ReadOnlyField()

    class Meta:
        model = WarehouseBin
        fields = '__all__'


class ProductLocationSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    location_code = serializers.SerializerMethodField()

    class Meta:
        model = ProductLocation
        fields = '__all__'

    def get_product_name(self, obj):
        return str(obj.product) if obj.product else None

    def get_location_code(self, obj):
        return obj.bin.full_location_code if obj.bin else None
