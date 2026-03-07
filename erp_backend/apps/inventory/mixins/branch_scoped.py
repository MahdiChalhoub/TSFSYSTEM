"""
Branch-Scoped Access Mixin
===========================
Drop-in mixin for DRF ViewSets that enforces branch-based access control.

Provides:
1. Queryset filtering - users only see records from their assigned branches
2. Create/Update validation - warehouse must belong to user's allowed branches
3. BRANCH-type protection - blocks stock operations on BRANCH-type warehouses

Usage:
    class MyViewSet(BranchScopedMixin, TenantModelViewSet):
        branch_field = 'branch'
        warehouse_field = 'warehouse'
"""
from rest_framework.exceptions import PermissionDenied, ValidationError


class BranchScopedMixin:
    """
    Mixin for ViewSets that enforces branch-based access control.

    Config attributes (set on your ViewSet):
      branch_field     = 'branch'       - FK field name used for queryset filtering
      warehouse_field  = 'warehouse'    - FK field name validated on create/update
      enforce_branch   = True           - set False to disable enforcement
    """
    branch_field = 'branch'
    warehouse_field = 'warehouse'
    enforce_branch = True

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.enforce_branch:
            return qs

        user = self.request.user
        if not hasattr(user, 'assigned_branches'):
            return qs

        branch_ids = user.get_accessible_branch_ids()
        if not branch_ids:
            # No branch restriction - admin/org-level access
            return qs

        # Filter by branch FK
        branch_filter = {f'{self.branch_field}__in': branch_ids}
        return qs.filter(**branch_filter)

    def _validate_warehouse_branch_access(self, warehouse, user):
        """
        Validate that:
        1. Warehouse is not a BRANCH type (can't do operations on branches)
        2. Warehouse belongs to user's allowed branches
        """
        if not warehouse:
            return

        # Rule: BRANCH-type cannot be used for stock operations
        if warehouse.location_type == 'BRANCH':
            raise ValidationError({
                self.warehouse_field: (
                    f'Cannot perform operations directly on a Branch location '
                    f'("{warehouse.name}"). Use a Store or Warehouse under it.'
                )
            })

        # Rule: warehouse must be under an allowed branch
        branch_ids = user.get_accessible_branch_ids()
        if not branch_ids:
            return  # No restriction

        branch = warehouse.get_branch()
        if branch and branch.id not in branch_ids:
            raise PermissionDenied(
                f'You do not have access to branch "{branch.name}". '
                f'Your assigned branches: {list(user.assigned_branches.values_list("name", flat=True))}'
            )

    def perform_create(self, serializer):
        """Validate branch access on create."""
        if self.enforce_branch:
            warehouse = serializer.validated_data.get(self.warehouse_field)
            self._validate_warehouse_branch_access(warehouse, self.request.user)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        """Validate branch access on update."""
        if self.enforce_branch:
            warehouse = serializer.validated_data.get(
                self.warehouse_field,
                getattr(serializer.instance, self.warehouse_field, None)
            )
            self._validate_warehouse_branch_access(warehouse, self.request.user)
        super().perform_update(serializer)


class StockMoveBranchScopedMixin(BranchScopedMixin):
    """
    Specialized mixin for StockMove - validates both source and destination warehouses.
    """
    branch_field = 'source_branch'

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.enforce_branch:
            return qs

        user = self.request.user
        branch_ids = user.get_accessible_branch_ids()
        if not branch_ids:
            return qs

        # Show moves where user has access to EITHER source or dest branch
        from django.db.models import Q
        return qs.filter(
            Q(source_branch__in=branch_ids) | Q(dest_branch__in=branch_ids)
        )

    def perform_create(self, serializer):
        if self.enforce_branch:
            from_wh = serializer.validated_data.get('from_warehouse')
            to_wh = serializer.validated_data.get('to_warehouse')
            self._validate_warehouse_branch_access(from_wh, self.request.user)
            self._validate_warehouse_branch_access(to_wh, self.request.user)
        # Skip BranchScopedMixin.perform_create - we did our own validation
        super(BranchScopedMixin, self).perform_create(serializer)
