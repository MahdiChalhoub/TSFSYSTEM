"""
Account / Chart-of-Account viewsets — entry point.

This module is the public import target for URL routing
(`apps.finance.urls.py`) and tests. ViewSet bodies have been split for
the 300-line maintainability ceiling:

  financial_account_views        → FinancialAccountViewSet, FinancialAccountCategoryViewSet
  coa_account_helpers            → _smart_default_for (re-exported for tests)
  coa_template_views             → DB template CRUD + bulk_classify
  coa_migration_map_views        → migration map list/save/quality/status
  coa_migration_rematch_views    → server-side re-match algorithm
  coa_migration_preview_views    → migration preview (smart classifier)
  coa_apply_template_views       → apply_template + remap engine
  coa_setup_views                → coa, coa_status, migrate, finalize_setup,
                                    statement, trial_balance
  coa_migration_session_views    → Phase-6 session lifecycle endpoints

`ChartOfAccountViewSet` keeps the `/api/finance/coa/` router registration
and inherits every @action method via mixins, so URL routes are
identical to the pre-split layout.
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization,
)
from apps.finance.models import ChartOfAccount
from apps.finance.serializers import ChartOfAccountSerializer

# Re-export for tests / migrations / external callers.
from .coa_account_helpers import _smart_default_for  # noqa: F401
from .financial_account_views import (  # noqa: F401
    FinancialAccountViewSet, FinancialAccountCategoryViewSet,
)
from .coa_template_views import COATemplateMixin
from .coa_migration_map_views import COAMigrationMapMixin
from .coa_migration_rematch_views import COAMigrationRematchMixin
from .coa_migration_preview_views import COAMigrationPreviewMixin
from .coa_apply_template_views import COAApplyTemplateMixin
from .coa_setup_views import COASetupMixin
from .coa_migration_session_views import COAMigrationSessionMixin


class ChartOfAccountViewSet(
    COATemplateMixin,
    COAMigrationMapMixin,
    COAMigrationRematchMixin,
    COAMigrationPreviewMixin,
    COAApplyTemplateMixin,
    COASetupMixin,
    COAMigrationSessionMixin,
    UDLEViewSetMixin,
    TenantModelViewSet,
):
    """Chart-of-Accounts hierarchy. All @action endpoints are supplied by
    the mixins above; the few small actions kept here are the basic
    tree + create-node + templates lookups."""
    queryset = ChartOfAccount.objects.all()
    serializer_class = ChartOfAccountSerializer

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request):
        """Return flat COA list with parent info for tree building."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response([], status=status.HTTP_200_OK)
        qs = ChartOfAccount.objects.filter(
            organization_id=org_id, is_active=True
        ).order_by('code').values(
            'id', 'code', 'name', 'type', 'sub_type', 'parent_id',
            'system_role', 'allow_posting', 'is_system_only',
            'class_code', 'normal_balance', 'balance',
        )
        return Response(list(qs))

    @action(detail=False, methods=['post'], url_path='create-node')
    def create_node(self, request):
        """Create a COA header node (sub-category) under a parent."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
        organization = Organization.objects.get(id=org_id)

        parent_id = request.data.get('parent_id')
        name = request.data.get('name')
        if not parent_id or not name:
            return Response({"error": "parent_id and name are required"}, status=status.HTTP_400_BAD_REQUEST)

        parent = ChartOfAccount.objects.filter(id=parent_id, organization=organization).first()
        if not parent:
            return Response({"error": "Parent account not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate child code
        last_child = ChartOfAccount.objects.filter(
            organization=organization, code__startswith=f"{parent.code}."
        ).order_by('-code').first()
        suffix = (int(last_child.code.split('.')[-1]) + 1) if last_child else 1
        child_code = f"{parent.code}.{str(suffix).zfill(2)}"

        node = ChartOfAccount.objects.create(
            organization=organization,
            code=child_code,
            name=name,
            type=parent.type,
            sub_type=request.data.get('sub_type', parent.sub_type),
            normal_balance=parent.normal_balance,
            allow_posting=False,  # Header node — no direct postings
            parent=parent,
            is_active=True,
        )
        return Response({
            'id': node.id, 'code': node.code, 'name': node.name,
            'type': node.type, 'parent_id': node.parent_id,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Legacy endpoint — returns hardcoded template list."""
        from erp.coa_templates import TEMPLATES
        data = [{"key": k, "name": k.replace('_', ' ')} for k in TEMPLATES.keys()]
        return Response(data)
