from decimal import Decimal
from rest_framework import serializers
from apps.client_portal.models import ClientOrder, ClientOrderLine

from erp.connector_registry import connector

class ClientOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientOrderLine
        fields = '__all__'
        read_only_fields = ('line_total', 'tax_amount')

class ClientOrderListSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    line_count = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model = ClientOrder
        fields = [
            'id', 'order_number', 'status', 'payment_status', 'contact', 'contact_name',
            'total_amount', 'currency', 'placed_at', 'estimated_delivery',
            'delivery_rating', 'line_count', 'created_at',
        ]

class ClientOrderSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    lines = ClientOrderLineSerializer(many=True, required=False)
    stripe_client_secret = serializers.CharField(read_only=True, required=False)

    class Meta:
        model = ClientOrder
        fields = '__all__'
        read_only_fields = (
            'order_number', 'subtotal', 'tax_amount', 'total_amount',
            'placed_at', 'delivered_at', 'pos_order', 'created_at', 'updated_at',
        )

    def create(self, validated_data):
        lines_data = self.initial_data.get('lines', [])
        order = ClientOrder.objects.create(**validated_data)
        for line_data in lines_data:
            product_id = line_data.get('product_id')
            variant_id = line_data.get('variant_id')
            qty = Decimal(str(line_data.get('quantity', 1)))
            price = Decimal(str(line_data.get('unit_price', 0)))
            product_name = line_data.get('product_name', 'Product')
            tax_rate = Decimal('0.00')

            if product_id:
                Product = connector.require('inventory.products.get_model', org_id=0, source='client_portal')
                if not Product:
                    return
                try:
                    product = Product.objects.get(id=product_id)
                    if not line_data.get('product_name'):
                        product_name = product.name
                    tax_rate = product.tva_rate
                except Product.DoesNotExist:
                    pass

            ClientOrderLine.objects.create(
                organization=order.organization,
                order=order,
                product_id=product_id,
                variant_id=variant_id,
                product_name=product_name,
                quantity=qty,
                unit_price=price,
                tax_rate=tax_rate
            )
        order.recalculate_totals()
        return order
