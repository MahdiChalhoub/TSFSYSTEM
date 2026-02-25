from .base import serializers
from apps.pos.delivery_models import DeliveryZone, DeliveryOrder

class DeliveryZoneSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DeliveryZone
        fields = '__all__'


class DeliveryOrderSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    order_ref = serializers.ReadOnlyField(source='order.ref_code')
    zone_name = serializers.ReadOnlyField(source='zone.name')
    driver_name = serializers.SerializerMethodField()
    contact_name = serializers.ReadOnlyField(source='order.contact.name')

    class Meta:
        model = DeliveryOrder
        fields = '__all__'

    def get_driver_name(self, obj):
        if obj.driver:
            name = f"{obj.driver.first_name} {obj.driver.last_name}".strip()
            return name or obj.driver.username
        return None
