from rest_framework import serializers
from apps.finance.models import Payment, CustomerBalance, SupplierBalance
from apps.finance.invoice_models import PaymentAllocation

class PaymentSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    payment_account_name = serializers.ReadOnlyField(source='payment_account.name')
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    allocation_count = serializers.SerializerMethodField()
    unallocated_amount = serializers.SerializerMethodField()
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['organization', 'reference']
    def get_allocation_count(self, obj):
        return obj.allocations.count() if hasattr(obj, 'allocations') else 0
    def get_unallocated_amount(self, obj):
        allocated = sum(a.allocated_amount for a in obj.allocations.all()) if hasattr(obj, 'allocations') else 0
        return float(obj.amount - allocated)

class CustomerBalanceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    class Meta:
        model = CustomerBalance
        fields = '__all__'

class SupplierBalanceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    class Meta:
        model = SupplierBalance
        fields = '__all__'

class PaymentAllocationSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    invoice_number = serializers.ReadOnlyField(source='invoice.invoice_number')
    payment_reference = serializers.ReadOnlyField(source='payment.reference')
    class Meta:
        model = PaymentAllocation
        fields = '__all__'
