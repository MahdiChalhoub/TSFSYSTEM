from .base import serializers
from apps.pos.quotation_models import Quotation, QuotationLine

class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    user_name = serializers.ReadOnlyField(source='user.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'
        read_only_fields = ['converted_order']

    def get_line_count(self, obj):
        return obj.lines.count()
