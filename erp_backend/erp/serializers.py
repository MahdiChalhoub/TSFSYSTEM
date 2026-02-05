from rest_framework import serializers
from .models import (
    Organization, Site, 
    Product, Warehouse, Inventory, InventoryMovement, Unit,
    Brand, Category, Parfum, ProductGroup, Country,
    Contact, Employee, Role, TransactionSequence, BarcodeSettings, User,
    PlanCategory, SubscriptionPlan, SubscriptionPayment
)
from apps.finance.serializers import (
    FinancialAccountSerializer, FiscalPeriodSerializer, FiscalYearSerializer,
    ChartOfAccountSerializer, JournalEntryLineSerializer, JournalEntrySerializer,
    LoanInstallmentSerializer, LoanSerializer, FinancialEventSerializer,
    TransactionSerializer
)

class OrganizationSerializer(serializers.ModelSerializer):
    _count = serializers.SerializerMethodField()

    def get__count(self, obj):
        return {
            "sites": obj.site_set.count() if hasattr(obj, 'site_set') else 0,
            "users": obj.users.count() if hasattr(obj, 'users') else 0
        }

    class Meta:
        model = Organization
        fields = '__all__'



class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class EmployeeSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_id = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ('organization',)

class TransactionSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionSequence
        fields = '__all__'
