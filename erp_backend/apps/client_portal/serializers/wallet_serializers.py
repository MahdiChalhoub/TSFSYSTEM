from rest_framework import serializers
from apps.client_portal.models import ClientWallet, WalletTransaction

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
