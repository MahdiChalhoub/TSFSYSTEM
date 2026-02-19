"""
Supplier Portal — Serializers
"""
from rest_framework import serializers
from .models import (
    SupplierPortalAccess, SupplierProforma, ProformaLine,
    PriceChangeRequest, SupplierNotification,
)


# =============================================================================
# PORTAL ACCESS (Admin-side)
# =============================================================================

class SupplierPortalAccessSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.email', read_only=True, default=None)

    class Meta:
        model = SupplierPortalAccess
        fields = '__all__'
        read_only_fields = ('granted_at', 'last_login')


# =============================================================================
# PROFORMA
# =============================================================================

class ProformaLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ProformaLine
        fields = '__all__'
        read_only_fields = ('line_total', 'tax_amount')


class SupplierProformaListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    line_count = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model = SupplierProforma
        fields = [
            'id', 'proforma_number', 'status', 'supplier', 'supplier_name',
            'total_amount', 'currency', 'submitted_at', 'valid_until',
            'line_count', 'created_at',
        ]


class SupplierProformaSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)
    lines = ProformaLineSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierProforma
        fields = '__all__'
        read_only_fields = (
            'proforma_number', 'submitted_at', 'reviewed_by', 'reviewed_at',
            'purchase_order', 'created_at', 'updated_at',
        )


# =============================================================================
# PRICE CHANGE REQUEST
# =============================================================================

class PriceChangeRequestSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.email', read_only=True, default=None)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, default=None)
    price_change_percent = serializers.DecimalField(max_digits=7, decimal_places=2, read_only=True)

    class Meta:
        model = PriceChangeRequest
        fields = '__all__'
        read_only_fields = ('reviewed_by', 'reviewed_at', 'created_at', 'updated_at')


# =============================================================================
# NOTIFICATION
# =============================================================================

class SupplierNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierNotification
        fields = '__all__'
        read_only_fields = ('created_at',)


# =============================================================================
# SUPPLIER DASHBOARD (Aggregated read-only)
# =============================================================================

class SupplierDashboardSerializer(serializers.Serializer):
    """Aggregated metrics for the supplier's dashboard."""
    total_orders = serializers.IntegerField()
    open_orders = serializers.IntegerField()
    total_business = serializers.DecimalField(max_digits=15, decimal_places=2)
    balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    pending_proformas = serializers.IntegerField()
    pending_price_requests = serializers.IntegerField()
    unread_notifications = serializers.IntegerField()
    products_count = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()


# =============================================================================
# READ-ONLY SUPPLIER VIEWS (PO + Stock + Statement)
# =============================================================================

class SupplierPOReadSerializer(serializers.Serializer):
    """Read-only PO view for suppliers."""
    id = serializers.IntegerField()
    po_number = serializers.CharField()
    status = serializers.CharField()
    order_date = serializers.DateField()
    expected_date = serializers.DateField()
    total_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    currency = serializers.CharField()
    line_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class SupplierStockReadSerializer(serializers.Serializer):
    """Read-only stock level view for suppliers."""
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    sku = serializers.CharField()
    current_stock = serializers.DecimalField(max_digits=15, decimal_places=2)
    min_stock = serializers.DecimalField(max_digits=15, decimal_places=2)
    is_low_stock = serializers.BooleanField()
    last_restocked = serializers.DateTimeField()
