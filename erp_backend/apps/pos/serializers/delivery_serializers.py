from .base import serializers
from apps.pos.models import DeliveryZone, DeliveryOrder, Driver, ExternalDriver


class DriverSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    full_name = serializers.SerializerMethodField()
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Driver
        fields = '__all__'

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username


class ExternalDriverSerializer(serializers.ModelSerializer):
    """Saved one-off / contractor driver — picked from the PO form when
    driver_source=EXTERNAL. The viewset stamps `organization` from the
    request tenant, so it's read-only here."""
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ExternalDriver
        fields = '__all__'


class DeliveryZoneSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    # How many clients have this zone as their home zone
    client_count = serializers.SerializerMethodField()
    client_list  = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryZone
        fields = '__all__'

    def get_client_count(self, obj):
        return obj.clients.count()

    def get_client_list(self, obj):
        """Lightweight list of clients in this zone for zone management views."""
        return list(obj.clients.values('id', 'name', 'phone', 'customer_tier'))


class DeliveryOrderSerializer(serializers.ModelSerializer):
    organization        = serializers.PrimaryKeyRelatedField(read_only=True)
    order_ref           = serializers.ReadOnlyField(source='order.ref_code')
    order_total         = serializers.ReadOnlyField(source='order.total_amount')
    zone_name           = serializers.ReadOnlyField(source='zone.name')
    zone_fee            = serializers.ReadOnlyField(source='zone.base_fee')
    driver_name         = serializers.SerializerMethodField()
    contact_name        = serializers.ReadOnlyField(source='order.contact.name')
    session_ref         = serializers.ReadOnlyField(source='session.id')
    is_payment_pending  = serializers.ReadOnlyField()

    class Meta:
        model = DeliveryOrder
        fields = '__all__'

    def get_driver_name(self, obj):
        if obj.driver:
            name = f"{obj.driver.first_name} {obj.driver.last_name}".strip()
            return name or obj.driver.username
        return None
