from .models import (
    Organization, Site, FinancialAccount, FiscalYear, 
    FiscalPeriod, JournalEntry, JournalEntryLine, ChartOfAccount,
    Product, Warehouse, Inventory, InventoryMovement
)

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = Inventory
        fields = '__all__'

class InventoryMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryMovement
        fields = '__all__'

class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'

class FinancialAccountSerializer(serializers.ModelSerializer):
    site_name = serializers.ReadOnlyField(source='site.name')
    ledger_code = serializers.ReadOnlyField(source='ledger_account.code')

    class Meta:
        model = FinancialAccount
        fields = '__all__'
        read_only_fields = ('ledger_account',)

class FiscalYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalYear
        fields = '__all__'

class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = '__all__'

class ChartOfAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccount
        fields = '__all__'

class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_name = serializers.ReadOnlyField(source='account.name')
    account_code = serializers.ReadOnlyField(source='account.code')

    class Meta:
        model = JournalEntryLine
        fields = '__all__'

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    site_name = serializers.ReadOnlyField(source='site.name')

    class Meta:
        model = JournalEntry
        fields = '__all__'
