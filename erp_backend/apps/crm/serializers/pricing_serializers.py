"""
CRM Pricing Serializers — Price Groups and Client Price Rules
"""
from rest_framework import serializers
from apps.crm.models import PriceGroup, PriceGroupMember, ClientPriceRule


class PriceGroupSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    rule_count = serializers.SerializerMethodField()

    class Meta:
        model = PriceGroup
        fields = '__all__'

    def get_member_count(self, obj):
        return obj.members.count()

    def get_rule_count(self, obj):
        return obj.price_rules.count()


class PriceGroupMemberSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    group_name = serializers.CharField(source='price_group.name', read_only=True)

    class Meta:
        model = PriceGroupMember
        fields = '__all__'

    def get_contact_name(self, obj):
        from apps.crm.models import Contact
        try:
            contact = Contact.objects.get(id=obj.contact_id)
            return contact.name
        except Contact.DoesNotExist:
            return f"Contact #{obj.contact_id}"


class ClientPriceRuleSerializer(serializers.ModelSerializer):
    contact_name = serializers.SerializerMethodField()
    group_name = serializers.CharField(source='price_group.name', read_only=True)
    product_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = ClientPriceRule
        fields = '__all__'

    def get_contact_name(self, obj):
        if not obj.contact_id:
            return None
        from apps.crm.models import Contact
        try:
            return Contact.objects.get(id=obj.contact_id).name
        except Contact.DoesNotExist:
            return f"Contact #{obj.contact_id}"

    def get_product_name(self, obj):
        if not obj.product_id:
            return None
        try:
            from apps.inventory.models import Product
            return Product.objects.get(id=obj.product_id).name
        except Exception:
            return f"Product #{obj.product_id}"

    def get_category_name(self, obj):
        if not obj.category_id:
            return None
        try:
            from apps.inventory.models import Category
            return Category.objects.get(id=obj.category_id).name
        except Exception:
            return f"Category #{obj.category_id}"
