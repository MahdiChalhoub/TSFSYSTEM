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
    queryset = Warehouse.objects.select_related('parent', 'country').all()
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
        """Save with organization context, enforcing location limits."""
        user = self.request.user
        header_tenant_id = get_current_tenant_id()

        if not (user.is_staff or user.is_superuser):
            organization_id = user.organization_id
        else:
            organization_id = header_tenant_id or user.organization_id

        if not organization_id:
            from rest_framework import serializers
            raise serializers.ValidationError({"error": "Organization context missing."})

        # ── Enforce location limit from subscription plan ──
        try:
            from erp.feature_gate import get_plan_resource_limit
            from rest_framework.exceptions import PermissionDenied
            org = Organization.objects.get(id=organization_id)

            # Always read limit from the plan — never hardcode
            limit = get_plan_resource_limit(org, 'max_sites')

            if limit is None:
                # No plan or plan has no max_sites → block creation
                raise PermissionDenied(
                    'No subscription plan found. A plan must be assigned before creating locations.'
                )

            # -1 means unlimited in the plan
            if limit != -1:
                current_count = Warehouse.objects.filter(
                    organization_id=organization_id, is_active=True
                ).count()
                if current_count >= limit:
                    raise PermissionDenied(
                        f'Location limit reached ({current_count}/{limit}). '
                        f'Upgrade your plan or deactivate unused locations to create more.'
                    )
        except PermissionDenied:
            raise  # Re-raise — don't swallow
        except Organization.DoesNotExist:
            pass
        except Exception:
            pass  # Don't block creation if limit check fails

        serializer.save(organization_id=organization_id)

    # ── Safe Destroy: protect warehouses with active data ──

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Check this location's own data blockers (not children — handled separately)
        own_blockers = self._get_own_data_blockers(instance)

        # Check children recursively for data
        children_with_data = self._get_children_with_data(instance)

        all_blockers = own_blockers + children_with_data

        if all_blockers:
            # Soft-deactivate instead of hard delete
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            return Response({
                'status': 'deactivated',
                'message': f'Location "{instance.name}" has been deactivated instead of deleted.',
                'reason': 'Cannot delete — active data exists.',
                'blockers': all_blockers,
            }, status=status.HTTP_200_OK)

        # Safe to hard delete — no linked data on this location or any children
        # Cascade: delete empty children first (bottom-up)
        self._cascade_delete_empty_children(instance)
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _get_own_data_blockers(warehouse):
        """Check if THIS warehouse (not children) has data preventing hard deletion."""
        blockers = []

        # 1. Inventory records (stock on hand)
        try:
            inv_count = warehouse.inventory_set.count()
            if inv_count:
                blockers.append(f'{inv_count} inventory record(s) on "{warehouse.name}"')
        except Exception:
            pass

        # 2. Stock adjustment orders
        try:
            adj_count = warehouse.adjustment_orders.count()
            if adj_count:
                blockers.append(f'{adj_count} stock adjustment(s) on "{warehouse.name}"')
        except Exception:
            pass

        # 3. Stock transfers (from or to)
        try:
            from apps.inventory.models.order_models import StockTransfer
            xfr_count = StockTransfer.objects.filter(
                models.Q(from_warehouse=warehouse) | models.Q(to_warehouse=warehouse)
            ).count()
            if xfr_count:
                blockers.append(f'{xfr_count} stock transfer(s) on "{warehouse.name}"')
        except Exception:
            pass

        # 4. Stock counts
        try:
            count_count = warehouse.stock_counts.count()
            if count_count:
                blockers.append(f'{count_count} stock count(s) on "{warehouse.name}"')
        except Exception:
            pass

        # 5. Goods receipts linked
        try:
            from apps.inventory.models.goods_receipt_models import GoodsReceipt
            gr_count = GoodsReceipt.objects.filter(warehouse=warehouse).count()
            if gr_count:
                blockers.append(f'{gr_count} goods receipt(s) on "{warehouse.name}"')
        except Exception:
            pass

        # 6. POS register linked
        try:
            from erp.connector_registry import connector
            Register = connector.require(
                'pos.registers.get_model', org_id=getattr(warehouse, 'organization_id', 0) or 0
            )
            if Register is not None:
                reg_count = Register.objects.filter(warehouse=warehouse).count()
                if reg_count:
                    blockers.append(f'{reg_count} POS register(s) on "{warehouse.name}"')
        except Exception:
            pass

        return blockers

    @classmethod
    def _get_children_with_data(cls, warehouse):
        """Recursively check all children for data blockers.
        Returns a list of blocker strings only for children that have real data."""
        blockers = []
        for child in warehouse.children.all():
            child_blockers = cls._get_own_data_blockers(child)
            if child_blockers:
                blockers.extend(child_blockers)
            # Recurse into grandchildren
            blockers.extend(cls._get_children_with_data(child))
        return blockers

    @classmethod
    def _cascade_delete_empty_children(cls, warehouse):
        """Delete all children bottom-up (only called when entire tree is data-free)."""
        for child in warehouse.children.all():
            cls._cascade_delete_empty_children(child)
            child.delete()

