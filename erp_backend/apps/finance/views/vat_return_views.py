"""
VAT Return Report Views
=======================
Exposes VATReturnReportService and a tax dashboard summary API.
"""
from .base import status, Response, action, TenantModelViewSet, get_current_tenant_id
from apps.finance.models import PeriodicTaxAccrual


class VATReturnReportViewSet(TenantModelViewSet):
    """
    VAT Return Report API.

    Endpoints:
        GET /api/finance/vat-return/report/?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
        GET /api/finance/vat-return/dashboard/   ← current month summary
    """
    queryset = PeriodicTaxAccrual.objects.none()
    serializer_class = None

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Full VAT return report for a given period."""
        from apps.finance.services.vat_return_report_service import VATReturnReportService
        from erp.models import Organization
        from django.core.exceptions import ValidationError

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        period_start = request.query_params.get('period_start')
        period_end   = request.query_params.get('period_end')
        if not period_start or not period_end:
            return Response({'error': 'period_start and period_end required'}, status=400)

        try:
            org = Organization.objects.get(id=org_id)
            report = VATReturnReportService.run(org, period_start, period_end)
            return Response(report)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Current-month tax dashboard summary.
        Returns a condensed version of the VAT return for the current month.
        """
        from apps.finance.services.vat_return_report_service import VATReturnReportService
        from erp.models import Organization
        from django.utils import timezone
        import calendar

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        today = timezone.now().date()
        period_start = today.replace(day=1).isoformat()
        last_day = calendar.monthrange(today.year, today.month)[1]
        period_end = today.replace(day=last_day).isoformat()

        try:
            org = Organization.objects.get(id=org_id)
            report = VATReturnReportService.run(org, period_start, period_end)

            # Condensed dashboard view
            return Response({
                'period':    report['period'],
                'vat_collected':   report['vat_on_sales']['vat_collected'],
                'vat_recoverable': report['vat_on_purchases']['vat_recoverable'],
                'net_vat_due':     report['net_vat_due'],
                'net_vat_direction': report['net_vat_direction'],
                'airsi_withheld':  report['airsi']['airsi_withheld'],
                'total_tax_due':   report['total_tax_due'],
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)
