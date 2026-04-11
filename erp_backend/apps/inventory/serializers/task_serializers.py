"""
Serializer for ProductTask.
"""
from rest_framework import serializers
from apps.inventory.models.task_models import ProductTask


class ProductTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    product_sku = serializers.SerializerMethodField()

    class Meta:
        model = ProductTask
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'task_type', 'title', 'description',
            'priority', 'status',
            'assigned_to', 'assigned_to_name', 'assigned_role',
            'due_date', 'completed_at', 'completed_by', 'completed_by_name',
            'source_event', 'source_id',
            'created_at', 'organization',
        ]
        read_only_fields = ['organization', 'created_at', 'completed_at', 'completed_by']

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.username if obj.assigned_to else None

    def get_completed_by_name(self, obj):
        return obj.completed_by.username if obj.completed_by else None

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_sku(self, obj):
        return obj.product.sku if obj.product else None
