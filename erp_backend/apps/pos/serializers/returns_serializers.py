from .base import serializers
from apps.pos.returns_models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine

class SalesReturnLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesReturnLine
        fields = '__all__'


class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    original_order_ref = serializers.ReadOnlyField(source='original_order.ref_code')
    customer_name = serializers.ReadOnlyField(source='original_order.contact.name')

    class Meta:
        model = SalesReturn
        fields = '__all__'


class CreditNoteSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_name = serializers.ReadOnlyField(source='customer.name')

    class Meta:
        model = CreditNote
        fields = '__all__'


class PurchaseReturnLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PurchaseReturnLine
        fields = '__all__'


class PurchaseReturnSerializer(serializers.ModelSerializer):
    lines = PurchaseReturnLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')

    class Meta:
        model = PurchaseReturn
        fields = '__all__'
