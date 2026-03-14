from django.db import models
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer
from .base import (
    Organization,
    Response,
    TenantModelViewSet,
    get_current_tenant_id,
    status,
)

class WarehouseViewSet(TenantModelViewSet):
    queryset = Warehouse.objects.select_related('parent').all()
    serializer_class = WarehouseSerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        code = data.get('code', '').strip()

        if not code:
            user = request.user
            header_tenant_id = get_current_tenant_id()
            org_id = getattr(user, 'organization_id', None)
            if user.is_staff or user.is_superuser:
                org_id = header_tenant_id or org_id

            if org_id:
                try:
                    from erp.connector_engine import connector_engine
                    org = Organization.objects.get(id=org_id)
                    result = connector_engine.route_read(
                        target_module='finance',
                        endpoint='generate_sequence',
                        organization_id=org.id,
                        params={'sequence_type': 'WAREHOUSE'},
                    )
                    if result and result.data and isinstance(result.data, dict):
                        data['code'] = result.data.get('sequence_number', '')
                except Exception:
                    pass

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Save with organization context."""
        user = self.request.user
        header_tenant_id = get_current_tenant_id()

        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
            from rest_framework import serializers
            raise serializers.ValidationError({"error": "Organization context missing."})

        serializer.save(organization_id=organization_id)

