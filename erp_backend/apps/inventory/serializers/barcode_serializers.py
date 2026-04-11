"""
Serializers for Barcode Governance.
"""
from rest_framework import serializers
from apps.inventory.models.barcode_models import BarcodePolicy, ProductBarcode


class BarcodePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = BarcodePolicy
        fields = [
            'id', 'mode', 'prefix', 'category_prefix_enabled',
            'format', 'checksum_enabled', 'uniqueness_scope',
            'auto_generate_on_create', 'change_requires_approval',
            'organization',
        ]
        read_only_fields = ['organization']


class ProductBarcodeSerializer(serializers.ModelSerializer):
    product_sku = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    generated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductBarcode
        fields = [
            'id', 'product', 'product_sku', 'product_name',
            'packaging', 'code', 'barcode_type', 'source',
            'is_active', 'generated_at', 'generated_by', 'generated_by_name',
            'organization',
        ]
        read_only_fields = ['organization', 'generated_at', 'generated_by']

    def get_product_sku(self, obj):
        return obj.product.sku if obj.product else None

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_generated_by_name(self, obj):
        return obj.generated_by.username if obj.generated_by else None
