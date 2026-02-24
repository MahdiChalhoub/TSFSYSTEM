"""
eCommerce — Serializers
=======================
"""
from rest_framework import serializers
from .models import Order, OrderLine, StorefrontConfig


class OrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = OrderLine
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'unit_price', 'line_total', 'tax_amount',
        ]
        read_only_fields = ('line_total', 'tax_amount')


class OrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    contact_name = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'contact', 'contact_name',
            'status', 'subtotal', 'tax_amount', 'delivery_fee',
            'total_amount', 'payment_method', 'delivery_address',
            'notes', 'placed_at', 'created_at', 'updated_at',
            'lines',
        ]
        read_only_fields = ('order_number', 'subtotal', 'tax_amount', 'total_amount')

    def get_contact_name(self, obj):
        return str(obj.contact) if obj.contact else ''


class StorefrontConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorefrontConfig
        fields = [
            'id', 'store_mode', 'storefront_title', 'storefront_tagline',
            'storefront_theme', 'storefront_type', 'show_stock_levels',
            'allow_guest_browsing', 'ecommerce_enabled', 'require_approval_for_orders',
        ]
