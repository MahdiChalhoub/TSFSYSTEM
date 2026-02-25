from .base import serializers
from apps.pos.models import ProductSupplier, SupplierPriceHistory

class ProductSupplierSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = ProductSupplier
        fields = '__all__'


class SupplierPriceHistorySerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = SupplierPriceHistory
        fields = '__all__'
