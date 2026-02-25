from rest_framework import serializers
from apps.client_portal.models import QuoteRequest, QuoteItem

class QuoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteItem
        fields = '__all__'
        read_only_fields = ('quote_request',)

class QuoteRequestSerializer(serializers.ModelSerializer):
    items = QuoteItemSerializer(many=True, required=False)

    class Meta:
        model = QuoteRequest
        fields = '__all__'
        read_only_fields = ('quote_number', 'created_at', 'updated_at')

    def create(self, validated_data):
        items_data = self.initial_data.get('items', [])
        quote_request = QuoteRequest.objects.create(**validated_data)
        for item_data in items_data:
            QuoteItem.objects.create(
                organization=quote_request.organization,
                quote_request=quote_request,
                product_id=item_data.get('product_id') or item_data.get('product'),
                variant_id=item_data.get('variant_id') or item_data.get('variant'),
                product_name=item_data.get('product_name', 'Product'),
                quantity=item_data.get('quantity', 1),
                notes=item_data.get('notes', '')
            )
        return quote_request
