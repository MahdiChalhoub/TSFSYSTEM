"""
POS Module Serializers
"""
from rest_framework import serializers
from .models import Order, OrderLine
from .returns_models import SalesReturn, SalesReturnLine, CreditNote, PurchaseReturn, PurchaseReturnLine


class OrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = OrderLine
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    user_name = serializers.ReadOnlyField(source='user.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    
    class Meta:
        model = Order
        fields = '__all__'


# ── Returns & Credit Notes ───────────────────────────────────────

class SalesReturnLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SalesReturnLine
        fields = '__all__'


class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    original_order_ref = serializers.ReadOnlyField(source='original_order.ref_code')
    customer_name = serializers.ReadOnlyField(source='original_order.contact.name')

    class Meta:
        model = SalesReturn
        fields = '__all__'


class CreditNoteSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_name = serializers.ReadOnlyField(source='customer.name')

    class Meta:
        model = CreditNote
        fields = '__all__'


class PurchaseReturnLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PurchaseReturnLine
        fields = '__all__'


class PurchaseReturnSerializer(serializers.ModelSerializer):
    lines = PurchaseReturnLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')

    class Meta:
        model = PurchaseReturn
        fields = '__all__'


# ── Quotations ────────────────────────────────────────────────────

from .quotation_models import Quotation, QuotationLine


class QuotationLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    contact_name = serializers.ReadOnlyField(source='contact.name')
    user_name = serializers.ReadOnlyField(source='user.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = '__all__'
        read_only_fields = ['converted_order']

    def get_line_count(self, obj):
        return obj.lines.count()


# ── Deliveries ────────────────────────────────────────────────────

from .delivery_models import DeliveryZone, DeliveryOrder
from .models.driver_models import Driver


class DriverSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    full_name = serializers.SerializerMethodField()
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Driver
        fields = '__all__'

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username


class DeliveryZoneSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DeliveryZone
        fields = '__all__'


class DeliveryOrderSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    order_ref = serializers.ReadOnlyField(source='order.ref_code')
    zone_name = serializers.ReadOnlyField(source='zone.name')
    driver_name = serializers.SerializerMethodField()
    contact_name = serializers.ReadOnlyField(source='order.contact.name')

    class Meta:
        model = DeliveryOrder
        fields = '__all__'

    def get_driver_name(self, obj):
        if obj.driver:
            name = f"{obj.driver.first_name} {obj.driver.last_name}".strip()
            return name or obj.driver.username
        return None


# ── Discount Rules ────────────────────────────────────────────────

from .discount_models import DiscountRule, DiscountUsageLog


class DiscountRuleSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    product_name = serializers.ReadOnlyField(source='product.name')
    category_name = serializers.ReadOnlyField(source='category.name')
    brand_name = serializers.ReadOnlyField(source='brand.name')
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DiscountRule
        fields = '__all__'
        read_only_fields = ['times_used']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return None


class DiscountUsageLogSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    rule_name = serializers.ReadOnlyField(source='rule.name')
    order_ref = serializers.ReadOnlyField(source='order.ref_code')

    class Meta:
        model = DiscountUsageLog
        fields = '__all__'


# ── Consignment Management ────────────────────────────────────────

from .consignment_models import ConsignmentSettlement, ConsignmentSettlementLine


class ConsignmentSettlementLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='order_line.product.name')
    sku = serializers.ReadOnlyField(source='order_line.product.sku')
    order_ref = serializers.ReadOnlyField(source='order_line.order.id')

    class Meta:
        model = ConsignmentSettlementLine
        fields = [
            'id', 'order_line', 'product_name', 'sku', 'order_ref',
            'payout_amount'
        ]


class ConsignmentSettlementSerializer(serializers.ModelSerializer):
    lines = ConsignmentSettlementLineSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    performed_by_name = serializers.ReadOnlyField(source='performed_by.username')

    class Meta:
        model = ConsignmentSettlement
        fields = [
            'id', 'reference', 'supplier', 'supplier_name', 'total_amount',
            'status', 'notes', 'performed_by', 'performed_by_name',
            'created_at', 'updated_at', 'lines'
        ]

# ── Sourcing & Vendor Pricing ──────────────────────────────

from .sourcing_models import ProductSupplier, SupplierPriceHistory


class ProductSupplierSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = ProductSupplier
        fields = '__all__'


class SupplierPriceHistorySerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = SupplierPriceHistory
        fields = '__all__'


# ── Purchase Orders ──────────────────────────────────────────

from .purchase_order_models import PurchaseOrder, PurchaseOrderLine


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


# ── POS Audit & Security ──────────────────────────────────────────

from .models.audit_models import POSAuditRule, POSAuditEvent, SalesAuditLog


class POSAuditRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSAuditRule
        fields = '__all__'
        read_only_fields = ['organization']


class POSAuditEventSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    register_name = serializers.ReadOnlyField(source='register.name')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.username')

    class Meta:
        model = POSAuditEvent
        fields = '__all__'
        read_only_fields = ['organization', 'created_at']


class SalesAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.ReadOnlyField()

    class Meta:
        model = SalesAuditLog
        fields = '__all__'
        read_only_fields = ['organization', 'created_at']

