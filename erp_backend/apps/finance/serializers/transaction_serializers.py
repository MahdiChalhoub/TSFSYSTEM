from rest_framework import serializers
from apps.finance.models import Transaction, TransactionSequence

class TransactionSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = Transaction
        fields = '__all__'

class TransactionSequenceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = TransactionSequence
        fields = '__all__'
