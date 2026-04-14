from rest_framework import serializers
from apps.inventory.models import Warehouse, Inventory, InventoryMovement

class WarehouseSerializer(serializers.ModelSerializer):
    site_name = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    country_name = serializers.CharField(source='country.name', read_only=True, default=None)
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True, default=None)
    inventory_count = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'parent', 'name', 'code', 'location_type',
            'address', 'city', 'phone', 'country', 'country_name', 'country_iso2', 'vat_number',
            'can_sell', 'is_active',
            'site_name', 'parent_name', 'inventory_count', 'children_count',
            'organization', 'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'created_at', 'updated_at']

    def validate(self, attrs):
        """Mirror model.clean() rules so DRF returns 400 instead of model.save() throwing 500."""
        location_type = attrs.get('location_type', getattr(self.instance, 'location_type', 'WAREHOUSE'))
        parent = attrs.get('parent', getattr(self.instance, 'parent', None))
        country = attrs.get('country', getattr(self.instance, 'country', None))
        pk = self.instance.pk if self.instance else None

        errors = {}

        # STORE / WAREHOUSE / VIRTUAL must have a parent branch
        if location_type in ('STORE', 'WAREHOUSE', 'VIRTUAL') and not parent:
            errors['parent'] = f'{location_type.title()} must belong to a Branch.'

        # Parent of non-BRANCH must be a BRANCH (strict 2-level tree)
        if parent and location_type != 'BRANCH':
            if parent.location_type != 'BRANCH':
                errors['parent'] = 'Locations can only be placed directly under a Branch.'

        # BRANCH cannot be nested under another BRANCH
        if location_type == 'BRANCH' and parent:
            errors['parent'] = 'Branches are top-level and cannot be nested under another location.'

        # No self-referencing
        if parent and pk and parent.pk == pk:
            errors['parent'] = 'A location cannot be its own parent.'

        # BRANCH must have a country (but save() auto-defaults from OrgCountry, so only warn if truly missing)
        # Note: we allow this through here since save() auto-resolves from OrgCountry default.
        # The model.clean() will catch it if auto-resolution also fails.

        if errors:
            raise serializers.ValidationError(errors)

        # Silently fix: BRANCH cannot have can_sell=True
        if location_type == 'BRANCH' and attrs.get('can_sell', False):
            attrs['can_sell'] = False

        return attrs

    def get_inventory_count(self, obj):
        return obj.inventory_set.count()

    def get_children_count(self, obj):
        return obj.children.count()

    def get_site_name(self, obj):
        """Backward compat: return the branch/parent name."""
        if obj.parent:
            return obj.parent.name
        return obj.name if obj.location_type == 'BRANCH' else None


class InventorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = Inventory
        fields = [
            'id', 'warehouse', 'product', 'quantity',
            'expiry_date', 'batch_number', 'batch',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = InventoryMovement
        fields = [
            'id', 'product', 'warehouse', 'type',
            'quantity', 'reference', 'reason',
            'cost_price', 'cost_price_ht', 'created_at',
            'product_name', 'warehouse_name',
            'organization',
        ]
        read_only_fields = ['organization']
