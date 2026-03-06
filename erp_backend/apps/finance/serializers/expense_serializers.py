from rest_framework import serializers
from apps.finance.models import DeferredExpense, DirectExpense

class DeferredExpenseSerializer(serializers.ModelSerializer):
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)
    progress = serializers.SerializerMethodField()
    class Meta:
        model = DeferredExpense
        fields = '__all__'
    def get_progress(self, obj):
        if obj.duration_months == 0: return 100
        return round((obj.months_recognized / obj.duration_months) * 100, 1)

class DirectExpenseSerializer(serializers.ModelSerializer):
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)
    source_account_name = serializers.ReadOnlyField(source='source_account.name')
    expense_coa_name = serializers.ReadOnlyField(source='expense_coa.name')
    class Meta:
        model = DirectExpense
        fields = '__all__'
