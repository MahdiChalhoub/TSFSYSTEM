"""
Periodic Tax Views
==================
API for running periodic tax accruals (used at month/year-end).
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import PeriodicTaxAccrual


class PeriodicTaxViewSet(TenantModelViewSet):
    """
    Periodic Tax Accrual API.

    Endpoints:
        POST /api/finance/periodic-tax/run/
        GET  /api/finance/periodic-tax/          ← list all accruals for org

    POST /run/ body:
        {
            "period_start": "YYYY-MM-DD",
            "period_end":   "YYYY-MM-DD"
        }
    """

    queryset = PeriodicTaxAccrual.objects.all()
    serializer_class = None  # JSON-only (no full DRF serializer for service response)

    def list(self, request):
        """List all periodic tax accruals for this org."""
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant missing'}, status=400)
        qs = PeriodicTaxAccrual.objects.filter(
            tenant_id=org_id
        ).order_by('-period_end')[:50]
        data = [
            {
                'id': a.id,
                'tax_type': a.tax_type,
                'period_start': str(a.period_start),
                'period_end': str(a.period_end),
                'base_amount': float(a.base_amount),
                'rate': float(a.rate),
                'accrual_amount': float(a.accrual_amount),
                'status': a.status,
                'policy_name': a.policy_name,
                'journal_entry_id': a.journal_entry_id,
                'created_at': str(a.created_at),
            }
            for a in qs
        ]
        return Response(data)

    @action(detail=False, methods=['post'])
    def run(self, request):
        """Run period-end accruals for the org's default OrgTaxPolicy."""
        from apps.finance.services.periodic_tax_service import PeriodicTaxAccrualService
        from erp.models import Organization
        from django.core.exceptions import ValidationError

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        period_start = request.data.get('period_start')
        period_end   = request.data.get('period_end')
        if not period_start or not period_end:
            return Response({'error': 'period_start and period_end required'}, status=400)

        try:
            org = Organization.objects.get(id=org_id)
            result = PeriodicTaxAccrualService.run(
                organization=org,
                period_start=period_start,
                period_end=period_end,
                user=request.user if request.user.is_authenticated else None,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
