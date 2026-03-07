from django.db import models
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer
from apps.inventory.mixins.branch_scoped import BranchScopedMixin
from .base import (
    Organization,
    Response,
    TenantModelViewSet,
    get_current_tenant_id,
    status,
)

class WarehouseViewSet(BranchScopedMixin, TenantModelViewSet):
    """Branch-scoped warehouse viewset. Users only see warehouses under their assigned branches."""
    queryset = Warehouse.objects.select_related('parent').all()
    serializer_class = WarehouseSerializer
    branch_field = 'parent'  # For non-branch locations, filter by parent (branch)
    warehouse_field = 'parent'
    enforce_branch = True

    def get_queryset(self):
        """Custom: show branches + their children (not just filtered by branch FK)."""
        qs = Warehouse.objects.select_related('parent').filter(
            organization_id=get_current_tenant_id() or self.request.user.organization_id
        )

        user = self.request.user
        if hasattr(user, 'assigned_branches'):
            branch_ids = user.get_accessible_branch_ids()
            if branch_ids:
                # Show the branches themselves + all children under them
                from django.db.models import Q
                qs = qs.filter(Q(id__in=branch_ids) | Q(parent__in=branch_ids))

        return qs

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

