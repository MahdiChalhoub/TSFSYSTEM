from rest_framework import serializers
from apps.finance.models import ChartOfAccount, FinancialAccount, FinancialAccountCategory


class ChartOfAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    # Computed properties from model
    effective_normal_balance = serializers.CharField(read_only=True)
    is_debit_normal = serializers.BooleanField(read_only=True)
    level = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = ChartOfAccount
        fields = '__all__'
        read_only_fields = [
            'path', 'class_name', 'normal_balance',
            'balance', 'balance_official',
            'created_by', 'updated_by', 'locked_at', 'locked_by',
        ]

    def get_level(self, obj):
        """Compute depth from materialized path."""
        if obj.path:
            return obj.path.count('.') + 1
        return 1

    def get_children_count(self, obj):
        """Number of direct child accounts."""
        if hasattr(obj, '_children_count'):
            return obj._children_count
        return obj.children.count()


class ChartOfAccountTreeSerializer(serializers.ModelSerializer):
    """Lightweight serializer for tree/dropdown views."""
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    level = serializers.SerializerMethodField()
    is_debit_normal = serializers.BooleanField(read_only=True)
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = ChartOfAccount
        fields = [
            'id', 'organization', 'code', 'name', 'type', 'sub_type',
            'class_code', 'class_name', 'normal_balance',
            'allow_posting', 'is_active', 'is_system_only',
            'parent', 'path', 'level', 'is_debit_normal',
            'has_children', 'balance', 'balance_official',
        ]

    def get_level(self, obj):
        if obj.path:
            return obj.path.count('.') + 1
        return 1

    def get_has_children(self, obj):
        if hasattr(obj, '_has_children'):
            return obj._has_children
        return obj.children.exists()


class FinancialAccountCategorySerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    account_count = serializers.SerializerMethodField()
    coa_parent_name = serializers.SerializerMethodField()
    coa_parent_code = serializers.SerializerMethodField()

    class Meta:
        model = FinancialAccountCategory
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'updated_at']

    def get_account_count(self, obj):
        return obj.accounts.count()

    def get_coa_parent_name(self, obj):
        return obj.coa_parent.name if obj.coa_parent else None

    def get_coa_parent_code(self, obj):
        return obj.coa_parent.code if obj.coa_parent else None


class FinancialAccountSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    ledgerAccount = serializers.SerializerMethodField()
    assignedUsers = serializers.SerializerMethodField()
    categoryData = serializers.SerializerMethodField()

    class Meta:
        model = FinancialAccount
        fields = '__all__'

    def get_ledgerAccount(self, obj):
        if obj.ledger_account:
            return {
                'id': obj.ledger_account.id,
                'code': obj.ledger_account.code,
                'name': obj.ledger_account.name,
                'type': obj.ledger_account.type,
            }
        return None

    def get_assignedUsers(self, obj):
        from erp.models import User
        users = User.objects.filter(cash_register_id=obj.id)
        return [{'id': u.id, 'name': u.get_full_name() or u.username} for u in users]

    def get_categoryData(self, obj):
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
                'code': obj.category.code,
                'icon': obj.category.icon,
                'color': obj.category.color,
                'description': obj.category.description,
                'coaParentId': obj.category.coa_parent_id,
            }
        return None
