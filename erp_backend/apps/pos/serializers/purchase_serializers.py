from .base import serializers
from apps.pos.purchase_order_models import PurchaseOrder, PurchaseOrderLine

class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = '__all__'


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    supplier_display = serializers.ReadOnlyField(source='supplier.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    site_name = serializers.ReadOnlyField(source='site.name')
    submitted_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    line_count = serializers.SerializerMethodField()
    receipt_progress = serializers.SerializerMethodField()
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['organization', 'po_number', 'submitted_at',
                            'approved_at', 'rejected_at', 'received_date']

    def _user_display(self, user):
        if not user:
            return None
        name = f"{user.first_name} {user.last_name}".strip()
        return name or user.username

    def get_submitted_by_name(self, obj):
        return self._user_display(obj.submitted_by)

    def get_approved_by_name(self, obj):
        return self._user_display(obj.approved_by)

    def get_created_by_name(self, obj):
        return self._user_display(obj.created_by)

    def get_line_count(self, obj):
        return obj.lines.count()

    def get_receipt_progress(self, obj):
        """Returns percentage of lines fully received."""
        lines = obj.lines.all()
        if not lines:
            return 0
        received = sum(1 for l in lines if l.qty_received >= l.quantity)
        return round(received / len(lines) * 100)
