"""
Serializer for Supplier Package Pricing.
"""
from rest_framework import serializers
from apps.pos.models.supplier_pricing_models import SupplierPackagePrice


class SupplierPackagePriceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    packaging_name = serializers.SerializerMethodField()

    class Meta:
        model = SupplierPackagePrice
        fields = [
            'id', 'product_supplier', 'supplier_name', 'product_name',
            'packaging', 'packaging_name',
            'purchase_price_ht', 'purchase_price_ttc', 'currency',
            'min_qty', 'max_qty',
            'valid_from', 'valid_until', 'is_active',
            'supplier_barcode', 'supplier_ref',
            'is_default_purchase_price',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_supplier_name(self, obj):
        return obj.product_supplier.supplier.name if obj.product_supplier else None

    def get_product_name(self, obj):
        return obj.product_supplier.product.name if obj.product_supplier else None

    def get_packaging_name(self, obj):
        return obj.packaging.name if obj.packaging else 'Base Unit'
