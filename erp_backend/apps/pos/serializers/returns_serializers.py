from .base import serializers
from apps.pos.models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine, SupplierCreditNote

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
    po_line_number = serializers.ReadOnlyField(source='po_line.line_number')

    class Meta:
        model = PurchaseReturnLine
        fields = '__all__'


class PurchaseReturnSerializer(serializers.ModelSerializer):
    lines = PurchaseReturnLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    po_number = serializers.ReadOnlyField(source='purchase_order.po_number')
    total_return_amount = serializers.ReadOnlyField()
    credit_gap = serializers.ReadOnlyField()
    credit_notes_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseReturn
        fields = '__all__'

    def get_credit_notes_count(self, obj):
        return obj.credit_notes.count() if hasattr(obj, 'credit_notes') else 0


class SupplierCreditNoteSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    return_number = serializers.ReadOnlyField(source='purchase_return.return_number')

    class Meta:
        model = SupplierCreditNote
        fields = '__all__'

