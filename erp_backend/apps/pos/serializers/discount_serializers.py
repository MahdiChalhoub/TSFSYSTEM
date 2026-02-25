from .base import serializers
from apps.pos.discount_models import DiscountRule, DiscountUsageLog

class DiscountRuleSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    product_name = serializers.ReadOnlyField(source='product.name')
    category_name = serializers.ReadOnlyField(source='category.name')
    brand_name = serializers.ReadOnlyField(source='brand.name')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DiscountRule
        fields = '__all__'
        read_only_fields = ['times_used']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return None


class DiscountUsageLogSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    rule_name = serializers.ReadOnlyField(source='rule.name')
    order_ref = serializers.ReadOnlyField(source='order.ref_code')

    class Meta:
        model = DiscountUsageLog
        fields = '__all__'
