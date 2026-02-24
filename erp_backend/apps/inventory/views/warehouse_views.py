from django.db import models
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer
from .base import (
    Organization,
    Response,
    Site,
    TenantModelViewSet,
    get_current_tenant_id,
    status,
)

class WarehouseViewSet(TenantModelViewSet):
    queryset = Warehouse.objects.select_related('site').all()
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
                from apps.finance.models import TransactionSequence
                try:
                    org = Organization.objects.get(id=org_id)
                    data['code'] = TransactionSequence.next_value(org, 'WAREHOUSE')
                except Exception:
                    pass

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Auto-resolve site from organization if not provided by the frontend."""
        user = self.request.user
        header_tenant_id = get_current_tenant_id()

        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
            from rest_framework import serializers
            raise serializers.ValidationError({"error": "Organization context missing."})

        # Auto-resolve site: use provided site, or fall back to org's first site
        site_id = serializer.validated_data.get('site')
        if isinstance(site_id, models.Model):
            site_id = site_id.id

        if not site_id:
            site = Site.objects.filter(organization_id=organization_id).first()
            if not site:
                org = Organization.objects.get(id=organization_id)
                site = Site.objects.create(
                    name=f"{org.name} - Main Site",
                    organization_id=organization_id,
                    is_active=True,
                )
            site_id = site.id
        else:
            # Reattach correctly if serializer.validated_data populated an object
            site_id = site_id if isinstance(site_id, int) else getattr(site_id, 'id', None)

        serializer.save(organization_id=organization_id, site_id=site_id)
