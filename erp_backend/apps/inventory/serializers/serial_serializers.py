from rest_framework import serializers
from apps.inventory.models import ProductSerial, SerialLog

class ProductSerialSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = ProductSerial
        fields = '__all__'
        read_only_fields = ['organization']


class SerialLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SerialLog
        fields = '__all__'
        read_only_fields = ['organization']
