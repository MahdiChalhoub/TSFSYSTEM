from rest_framework import serializers
from apps.client_portal.models import ProductReview, WishlistItem

class ProductReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    contact_name = serializers.ReadOnlyField(source='contact.display_name')

    class Meta:
        model = ProductReview
        fields = '__all__'
        read_only_fields = ('created_at', 'is_visible', 'is_verified_purchase', 'contact')

class WishlistItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_price = serializers.ReadOnlyField(source='product.selling_price_ttc')
    product_image = serializers.ReadOnlyField(source='product.image_url')

    class Meta:
        model = WishlistItem
        fields = '__all__'
        read_only_fields = ('created_at',)
