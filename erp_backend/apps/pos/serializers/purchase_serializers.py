from .base import serializers
from apps.pos.models import PurchaseOrder, PurchaseOrderLine


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    # Phase 5 — Discrepancy computed fields
    declared_gap = serializers.SerializerMethodField()
    receipt_gap_vs_declared = serializers.SerializerMethodField()
    receipt_gap_vs_ordered = serializers.SerializerMethodField()
    missing_vs_po = serializers.SerializerMethodField()
    missing_vs_declared = serializers.SerializerMethodField()
    received_amount = serializers.SerializerMethodField()
    damaged_amount = serializers.SerializerMethodField()
    missing_amount = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = '__all__'

    def _safe_float(self, val):
        return float(val) if val is not None else None

    def get_declared_gap(self, obj):
        return self._safe_float(obj.declared_gap)

    def get_receipt_gap_vs_declared(self, obj):
        return self._safe_float(obj.receipt_gap_vs_declared)

    def get_receipt_gap_vs_ordered(self, obj):
        return self._safe_float(obj.receipt_gap_vs_ordered)

    def get_missing_vs_po(self, obj):
        return self._safe_float(obj.missing_vs_po)

    def get_missing_vs_declared(self, obj):
        return self._safe_float(obj.missing_vs_declared)

    def get_received_amount(self, obj):
        return float(obj.received_amount)

    def get_damaged_amount(self, obj):
        return float(obj.damaged_amount)

    def get_missing_amount(self, obj):
        return float(obj.missing_amount)


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
    discrepancy_summary = serializers.SerializerMethodField()
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

    def get_discrepancy_summary(self, obj):
        """Phase 5 — Aggregate discrepancy data for the PO."""
        summary = obj.get_discrepancy_summary()
        # Convert Decimals to floats for JSON serialization
        return {k: float(v) if hasattr(v, 'quantize') else v for k, v in summary.items()}

