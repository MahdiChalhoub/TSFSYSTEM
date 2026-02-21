from rest_framework import serializers
from .models import EcommerceIntegration, ExternalProductMapping, ExternalOrderMapping

class EcommerceIntegrationSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(write_only=True, required=False)
    api_secret = serializers.CharField(write_only=True, required=False)
    is_connected = serializers.BooleanField(read_only=True)

    class Meta:
        model = EcommerceIntegration
        fields = [
            'id', 'platform', 'display_name', 'api_url', 'is_active', 
            'last_sync_at', 'api_key', 'api_secret', 'is_connected',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('last_sync_at', 'created_at', 'updated_at')

    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        api_secret = validated_data.pop('api_secret', None)
        instance = super().create(validated_data)
        if api_key: instance.set_api_key(api_key)
        if api_secret: instance.set_api_secret(api_secret)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        api_secret = validated_data.pop('api_secret', None)
        instance = super().update(instance, validated_data)
        if api_key: instance.set_api_key(api_key)
        if api_secret: instance.set_api_secret(api_secret)
        instance.save()
        return instance

class ExternalProductMappingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    platform = serializers.CharField(source='integration.platform', read_only=True)

    class Meta:
        model = ExternalProductMapping
        fields = '__all__'

class ExternalOrderMappingSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    platform = serializers.CharField(source='integration.platform', read_only=True)

    class Meta:
        model = ExternalOrderMapping
        fields = '__all__'
