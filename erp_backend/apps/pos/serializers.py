"""
POS Module Serializers
"""
from rest_framework import serializers
from .models import Order, OrderLine
from .returns_models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'


class OrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderLine
        fields = '__all__'


# ── Returns & Credit Notes ───────────────────────────────────────

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


# ── Quotations ────────────────────────────────────────────────────

from .quotation_models import Quotation, QuotationLine


class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    user_name = serializers.ReadOnlyField(source='user.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'
        read_only_fields = ['converted_order']

    def get_line_count(self, obj):
        return obj.lines.count()


# ── Deliveries ────────────────────────────────────────────────────

from .delivery_models import DeliveryZone, DeliveryOrder


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

