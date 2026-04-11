"""
PaymentMethod CRUD ViewSet.
Manages organization-scoped payment methods (Cash, Card, Wave, etc.).
"""
from rest_framework import serializers
from .base import (
    viewsets, status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
)
from apps.finance.models import PaymentMethod


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'name', 'code', 'icon', 'color', 'is_system', 'is_active', 'sort_order']
        read_only_fields = ['id', 'is_system']


class PaymentMethodViewSet(TenantModelViewSet):
    """
    CRUD for PaymentMethod.
    System-seeded methods can be edited but not deleted.
    """
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer

    def perform_destroy(self, instance):
        if instance.is_system:
            raise serializers.ValidationError(
                {"detail": "System payment methods cannot be deleted. Deactivate instead."}
            )
        instance.delete()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        Bulk update sort_order.
        Expects: { "order": [{ "id": 1, "sort_order": 0 }, ...] }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No org context"}, status=status.HTTP_400_BAD_REQUEST)

        items = request.data.get('order', [])
        for item in items:
            PaymentMethod.objects.filter(
                id=item['id'], organization_id=org_id
            ).update(sort_order=item['sort_order'])

        return Response({"message": f"Reordered {len(items)} methods"})
