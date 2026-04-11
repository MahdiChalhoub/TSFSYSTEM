"""
Procurement Governance Serializers
===================================
Serializers for enterprise procurement entities:
- 3-Way Match Results + Lines
- Dispute Cases
- Purchase Requisitions + Lines
- Supplier Quotations + Lines
- Procurement Budgets + Commitments
- Supplier Performance Snapshots
"""
from rest_framework import serializers
from apps.pos.models.procurement_governance_models import (
    ThreeWayMatchResult, ThreeWayMatchLine, DisputeCase,
    PurchaseRequisition, PurchaseRequisitionLine,
    SupplierQuotation, SupplierQuotationLine,
    ProcurementBudget, BudgetCommitment,
    SupplierPerformanceSnapshot,
)


# =============================================================================
# 3-WAY MATCH
# =============================================================================

class ThreeWayMatchLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')

    class Meta:
        model = ThreeWayMatchLine
        fields = '__all__'
        read_only_fields = ['organization']


class ThreeWayMatchResultSerializer(serializers.ModelSerializer):
    lines = ThreeWayMatchLineSerializer(many=True, read_only=True)
    po_number = serializers.ReadOnlyField(source='purchase_order.po_number')
    invoice_number = serializers.SerializerMethodField()
    matched_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ThreeWayMatchResult
        fields = '__all__'
        read_only_fields = ['organization']

    def get_invoice_number(self, obj):
        if obj.invoice:
            return getattr(obj.invoice, 'invoice_number', None) or str(obj.invoice_id)
        return None

    def get_matched_by_name(self, obj):
        if obj.matched_by:
            name = f"{obj.matched_by.first_name} {obj.matched_by.last_name}".strip()
            return name or obj.matched_by.username
        return None

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            name = f"{obj.resolved_by.first_name} {obj.resolved_by.last_name}".strip()
            return name or obj.resolved_by.username
        return None


# =============================================================================
# DISPUTE CASES
# =============================================================================

class DisputeCaseSerializer(serializers.ModelSerializer):
    po_number = serializers.ReadOnlyField(source='purchase_order.po_number')
    supplier_name = serializers.ReadOnlyField(source='purchase_order.supplier_name')
    opened_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisputeCase
        fields = '__all__'
        read_only_fields = ['organization', 'opened_at', 'resolved_at']

    def get_opened_by_name(self, obj):
        if obj.opened_by:
            name = f"{obj.opened_by.first_name} {obj.opened_by.last_name}".strip()
            return name or obj.opened_by.username
        return None

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            name = f"{obj.resolved_by.first_name} {obj.resolved_by.last_name}".strip()
            return name or obj.resolved_by.username
        return None


# =============================================================================
# PURCHASE REQUISITIONS
# =============================================================================

class PurchaseRequisitionLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    preferred_supplier_name = serializers.ReadOnlyField(source='preferred_supplier.name')

    class Meta:
        model = PurchaseRequisitionLine
        fields = '__all__'
        read_only_fields = ['organization']


class PurchaseRequisitionSerializer(serializers.ModelSerializer):
    lines = PurchaseRequisitionLineSerializer(many=True, read_only=True)
    site_name = serializers.ReadOnlyField(source='site.name')
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    converted_po_number = serializers.ReadOnlyField(source='converted_po.po_number')
    line_count = serializers.SerializerMethodField()
    estimated_total = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequisition
        fields = '__all__'
        read_only_fields = ['organization', 'req_number', 'approved_at', 'converted_po']

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            name = f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip()
            return name or obj.requested_by.username
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            name = f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
            return name or obj.approved_by.username
        return None

    def get_line_count(self, obj):
        return obj.lines.count()

    def get_estimated_total(self, obj):
        total = sum(
            float(l.estimated_unit_price or 0) * float(l.quantity or 0)
            for l in obj.lines.all()
        )
        return round(total, 2)


# =============================================================================
# SUPPLIER QUOTATIONS
# =============================================================================

class SupplierQuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')

    class Meta:
        model = SupplierQuotationLine
        fields = '__all__'
        read_only_fields = ['organization']


class SupplierQuotationSerializer(serializers.ModelSerializer):
    lines = SupplierQuotationLineSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    requisition_number = serializers.ReadOnlyField(source='requisition.req_number')
    converted_po_number = serializers.ReadOnlyField(source='converted_po.po_number')
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = SupplierQuotation
        fields = '__all__'
        read_only_fields = ['organization', 'quotation_number', 'converted_po']

    def get_line_count(self, obj):
        return obj.lines.count()


# =============================================================================
# PROCUREMENT BUDGETS
# =============================================================================

class BudgetCommitmentSerializer(serializers.ModelSerializer):
    po_number = serializers.ReadOnlyField(source='purchase_order.po_number')
    budget_name = serializers.ReadOnlyField(source='budget.name')
    net_commitment = serializers.ReadOnlyField()

    class Meta:
        model = BudgetCommitment
        fields = '__all__'
        read_only_fields = ['organization']


class ProcurementBudgetSerializer(serializers.ModelSerializer):
    commitments = BudgetCommitmentSerializer(many=True, read_only=True)
    site_name = serializers.ReadOnlyField(source='site.name')
    category_name = serializers.ReadOnlyField(source='category.name')
    available_amount = serializers.ReadOnlyField()
    utilization_pct = serializers.ReadOnlyField()
    is_over_warning = serializers.ReadOnlyField()

    class Meta:
        model = ProcurementBudget
        fields = '__all__'
        read_only_fields = ['organization', 'committed_amount', 'consumed_amount']


# =============================================================================
# VENDOR PERFORMANCE
# =============================================================================

class SupplierPerformanceSnapshotSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')

    class Meta:
        model = SupplierPerformanceSnapshot
        fields = '__all__'
        read_only_fields = ['organization']
