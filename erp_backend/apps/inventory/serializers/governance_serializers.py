"""
Serializers for Product Governance — PriceChangeRequest and ProductAuditTrail.
"""
from rest_framework import serializers
from apps.inventory.models import PriceChangeRequest, ProductAuditTrail, PriceApprovalPolicy


class PriceChangeRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    product_sku = serializers.SerializerMethodField()
    price_change_pct = serializers.SerializerMethodField()

    class Meta:
        model = PriceChangeRequest
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'current_price_ht', 'current_price_ttc',
            'proposed_price_ht', 'proposed_price_ttc',
            'tva_rate', 'price_change_pct',
            'reason', 'change_type',
            'status', 'effective_date',
            'requested_by', 'requested_by_name', 'requested_at',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'review_notes', 'applied_at',
            'organization',
        ]
        read_only_fields = [
            'organization', 'requested_by', 'requested_at',
            'reviewed_by', 'reviewed_at', 'applied_at',
            'current_price_ht', 'current_price_ttc',
        ]

    def get_requested_by_name(self, obj):
        return obj.requested_by.username if obj.requested_by else None

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by else None

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_sku(self, obj):
        return obj.product.sku if obj.product else None

    def get_price_change_pct(self, obj):
        return obj.price_change_pct


class ProductAuditTrailSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductAuditTrail
        fields = [
            'id', 'product', 'product_name',
            'event_type', 'actor', 'actor_name',
            'timestamp', 'details',
        ]
        read_only_fields = ['__all__']

    def get_actor_name(self, obj):
        return obj.actor.username if obj.actor else None

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None


class PriceApprovalPolicySerializer(serializers.ModelSerializer):
    """Full serializer for PriceApprovalPolicy management."""
    applies_to_user_name = serializers.SerializerMethodField()

    class Meta:
        model = PriceApprovalPolicy
        fields = [
            'id', 'name', 'is_active', 'priority',
            'applies_to_role', 'applies_to_user', 'applies_to_user_name',
            'max_delta_pct', 'min_margin_pct', 'max_amount',
            'allow_group_changes', 'action',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_applies_to_user_name(self, obj):
        if obj.applies_to_user:
            u = obj.applies_to_user
            return u.get_full_name() or u.username or u.email
        return None
