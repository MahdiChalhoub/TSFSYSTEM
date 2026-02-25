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
    
    class Meta:
        model = Order
        fields = '__all__'

class PosTicketSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = PosTicket
        fields = '__all__'
        read_only_fields = ['organization', 'user']
