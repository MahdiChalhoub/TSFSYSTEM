from .base import serializers
from apps.pos.models import Order, OrderLine, PosTicket

class OrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = OrderLine
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    user_name = serializers.ReadOnlyField(source='user.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    contact_phone = serializers.ReadOnlyField(source='contact.phone')
    total_paid = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()
    shipping_status = serializers.SerializerMethodField()
    return_due = serializers.SerializerMethodField()

    def get_total_paid(self, obj):
        if obj.type == 'SALE':
            return sum(p.amount for p in obj.payments_received.all() if p.status == 'POSTED')
        return sum(p.amount for p in obj.payments_made.all() if p.status == 'POSTED')

    def get_total_items(self, obj):
        return obj.lines.count()

    def get_shipping_status(self, obj):
        delivery = obj.deliveries.first()
        return delivery.status if delivery else 'NOT_SHIPPED'

    def get_return_due(self, obj):
        # Placeholder for return due logic
        return 0
    
    class Meta:
        model = Order
        fields = [
            'id', 'type', 'status', 'ref_code', 'contact', 'contact_name', 'contact_phone',
            'user', 'user_name', 'site', 'site_name', 'total_amount', 'tax_amount',
            'discount_amount', 'payment_method', 'invoice_number', 'is_locked', 'is_verified',
            'notes', 'scope', 'created_at', 'updated_at', 'total_paid', 'total_items',
            'shipping_status', 'return_due', 'lines'
        ]

class PosTicketSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = PosTicket
        fields = '__all__'
        read_only_fields = ['organization', 'user']
