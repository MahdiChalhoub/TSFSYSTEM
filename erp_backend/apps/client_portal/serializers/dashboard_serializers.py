from rest_framework import serializers

class ClientDashboardSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    active_orders = serializers.IntegerField()
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    wallet_balance = serializers.DecimalField(max_digits=15, decimal_places=2)
    loyalty_points = serializers.IntegerField()
    loyalty_tier = serializers.CharField()
    open_tickets = serializers.IntegerField()
    barcode = serializers.CharField()
    loyalty_enabled = serializers.BooleanField()
    loyalty_earn_rate = serializers.CharField()
    loyalty_redemption_ratio = serializers.CharField()
    loyalty_min_redeem = serializers.IntegerField()
    wallet_enabled = serializers.BooleanField()
    ecommerce_enabled = serializers.BooleanField()
    tickets_enabled = serializers.BooleanField()
