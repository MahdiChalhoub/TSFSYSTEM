"""
FiscalYearViewSet mixin — Prior-period adjustment endpoints.

`prior_period_adjustment` posts (or previews) a PPA for a closed fiscal
year; `list_prior_period_adjustments` lists existing PPAs scoped to the
current scope view. Inherited by `FiscalYearViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id, Organization,
)


class FiscalYearPPAdjustmentMixin:
    """@action methods: prior_period_adjustment, list_prior_period_adjustments."""

    @action(detail=True, methods=['post'], url_path='prior-period-adjustment')
    def prior_period_adjustment(self, request, pk=None):
        """Post (or preview) a PPA for this CLOSED fiscal year.

        Body:
          lines:    [{account_id:int, debit:str, credit:str, description?:str}, ...]
          reason:   required free text
          dry_run:  bool (default false) — if true, return preview without posting
          current_period_id: optional — else we pick the latest OPEN period

        Wraps `PriorPeriodAdjustmentService.post_adjustment` so operators
        never touch the raw service.
        """
        from apps.finance.services.prior_period_adjustment_service import (
            PriorPeriodAdjustmentService,
        )
        from apps.finance.models import FiscalPeriod
        from django.core.exceptions import ValidationError

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        lines = request.data.get('lines') or []
        reason = request.data.get('reason') or ''
        dry_run = bool(request.data.get('dry_run', False))
        current_period_id = request.data.get('current_period_id')

        # Resolve target period — caller-supplied or latest OPEN
        if current_period_id:
            try:
                current_fp = FiscalPeriod.objects.get(
                    id=current_period_id, organization=organization,
                )
            except FiscalPeriod.DoesNotExist:
                return Response({'error': 'current_period_id not found'}, status=400)
        else:
            current_fp = (
                FiscalPeriod.objects
                .filter(organization=organization, status='OPEN')
                .order_by('-start_date').first()
            )
            if not current_fp:
                return Response(
                    {'error': 'No OPEN fiscal period — create or reopen one first'},
                    status=400,
                )

        try:
            result = PriorPeriodAdjustmentService.post_adjustment(
                organization=organization,
                target_fiscal_year=fy,
                current_fiscal_period=current_fp,
                lines=lines,
                reason=reason,
                user=request.user if request.user.is_authenticated else None,
                dry_run=dry_run,
            )
            return Response(result)
        except ValidationError as e:
            return Response({'error': str(e.messages[0] if hasattr(e, 'messages') else e)}, status=400)

    @action(detail=True, methods=['get'], url_path='prior-period-adjustments')
    def list_prior_period_adjustments(self, request, pk=None):
        """List PPA JEs targeting this fiscal year (scope-filtered)."""
        from apps.finance.services.prior_period_adjustment_service import (
            PriorPeriodAdjustmentService,
        )
        fy = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        # Scope: OFFICIAL view should never see INTERNAL PPAs.
        from erp.middleware import get_authorized_scope
        authorized = (
            request.headers.get('X-Scope-Access')
            or get_authorized_scope()
            or 'official'
        ).lower()
        scope = (
            request.headers.get('X-Scope')
            or request.query_params.get('scope')
            or 'OFFICIAL'
        ).upper()
        if authorized == 'official' and scope == 'INTERNAL':
            scope = 'OFFICIAL'

        jes = PriorPeriodAdjustmentService.list_adjustments(
            organization=organization, target_fiscal_year=fy,
        )
        # The service returns a queryset/list of JEs; narrow by scope.
        if scope == 'OFFICIAL':
            jes = [je for je in jes if getattr(je, 'scope', 'OFFICIAL') == 'OFFICIAL']

        return Response([
            {
                'id': je.id,
                'reference': je.reference,
                'transaction_date': je.transaction_date.isoformat() if je.transaction_date else None,
                'description': je.description,
                'created_by': je.created_by.username if je.created_by_id else None,
                'line_count': je.lines.count(),
            }
            for je in jes[:100]
        ])
