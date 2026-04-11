"""
Serializers for Category Creation Rules and Supplier Package Pricing.
"""
from rest_framework import serializers
from apps.inventory.models.category_rule_models import CategoryCreationRule


class CategoryCreationRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = CategoryCreationRule
        fields = [
            'id', 'category', 'category_name',
            # Required fields
            'requires_barcode', 'requires_brand', 'requires_unit',
            'requires_packaging', 'requires_photo', 'requires_supplier',
            # Barcode overrides
            'barcode_prefix', 'barcode_mode_override',
            # Defaults
            'default_product_type', 'default_unit_id', 'default_tva_rate',
            # Packaging
            'auto_create_packaging', 'packaging_template',
            # Completeness
            'completeness_profile_override',
            # Print/Label
            'auto_print_label', 'label_template', 'shelf_placement_required',
            'organization',
        ]
        read_only_fields = ['organization']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None
