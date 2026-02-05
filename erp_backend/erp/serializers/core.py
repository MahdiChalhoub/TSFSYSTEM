from rest_framework import serializers
from erp.models import (
    Organization, Site, User, Role, Permission, SystemModule, SystemUpdate,
    TransactionSequence, PlanCategory, SubscriptionPlan, SubscriptionPayment, Country,
    Contact, Product, Transaction, OrganizationModule
)

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'

class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = '__all__'

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class SystemModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemModule
        fields = '__all__'

class SystemUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemUpdate
        fields = '__all__'

class TransactionSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionSequence
        fields = '__all__'

class PlanCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanCategory
        fields = '__all__'

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPayment
        fields = '__all__'

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'

class OrganizationModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationModule
        fields = '__all__'
