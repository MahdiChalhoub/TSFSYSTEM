"""
Client Portal — Serializers
"""
from rest_framework import serializers
from .models import (
    ClientPortalConfig, ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket, QuoteRequest,
)


# =============================================================================
# PORTAL ACCESS (Admin-side)
# =============================================================================

class ClientPortalAccessSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.email', read_only=True, default=None)

    class Meta:
        model = ClientPortalAccess
        fields = '__all__'
        read_only_fields = ('granted_at', 'last_login', 'barcode')


# =============================================================================
# WALLET
# =============================================================================

class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = '__all__'
        read_only_fields = ('created_at',)


class ClientWalletSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model = ClientWallet
        fields = '__all__'
        read_only_fields = ('balance', 'loyalty_points', 'lifetime_points', 'created_at', 'updated_at')

    def get_recent_transactions(self, obj):
        txns = obj.transactions.all()[:10]
        return WalletTransactionSerializer(txns, many=True).data


# =============================================================================
# eCOMMERCE ORDERS
# =============================================================================

class ClientOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientOrderLine
        fields = '__all__'
        read_only_fields = ('line_total', 'tax_amount')


class ClientOrderListSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    line_count = serializers.IntegerField(source='lines.count', read_only=True)

    class Meta:
        model = ClientOrder
        fields = [
            'id', 'order_number', 'status', 'payment_status', 'contact', 'contact_name',
            'total_amount', 'currency', 'placed_at', 'estimated_delivery',
            'delivery_rating', 'line_count', 'created_at',
        ]


class ClientOrderSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    lines = ClientOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = ClientOrder
        fields = '__all__'
        read_only_fields = (
            'order_number', 'subtotal', 'tax_amount', 'total_amount',
            'placed_at', 'delivered_at', 'pos_order', 'created_at', 'updated_at',
        )


# =============================================================================
# SUPPORT TICKETS
# =============================================================================

class ClientTicketSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.email', read_only=True, default=None)

    class Meta:
        model = ClientTicket
        fields = '__all__'
        read_only_fields = ('ticket_number', 'resolved_at', 'created_at', 'updated_at')


# =============================================================================
# DASHBOARD (Aggregated read-only)
# =============================================================================

class ClientDashboardSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    active_orders = serializers.IntegerField()
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    wallet_balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    loyalty_points = serializers.IntegerField()
    loyalty_tier = serializers.CharField()
    open_tickets = serializers.IntegerField()
    barcode = serializers.CharField()
    # Per-org config exposed to client
    loyalty_enabled = serializers.BooleanField()
    loyalty_earn_rate = serializers.CharField()
    loyalty_redemption_ratio = serializers.CharField()
    loyalty_min_redeem = serializers.IntegerField()
    wallet_enabled = serializers.BooleanField()
    ecommerce_enabled = serializers.BooleanField()
    tickets_enabled = serializers.BooleanField()


# =============================================================================
# PER-ORG CONFIGURATION
# =============================================================================

class ClientPortalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientPortalConfig
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class QuoteRequestSerializer(serializers.ModelSerializer):
    product_name_display = serializers.CharField(source='product.name', read_only=True, default='')

    class Meta:
        model = QuoteRequest
        fields = '__all__'
        read_only_fields = ('quote_number', 'created_at', 'updated_at')
