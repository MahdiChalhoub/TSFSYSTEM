"""
Procurement Analytics Views
=============================
Read-only API for procurement intelligence dashboards.

Endpoints:
  GET /pos/analytics/procurement/dashboard/
  GET /pos/analytics/procurement/aging/
  GET /pos/analytics/procurement/cycle-times/
  GET /pos/analytics/procurement/spend-by-supplier/
  GET /pos/analytics/procurement/monthly-trend/
  GET /pos/analytics/procurement/supplier-intelligence/
  GET /pos/analytics/procurement/budget-utilization/
  GET /pos/analytics/procurement/requisition-pipeline/
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from datetime import date, timedelta

from apps.pos.services.procurement_analytics_service import ProcurementAnalyticsService


class ProcurementDashboardView(APIView):
    """
    GET /pos/analytics/procurement/dashboard/
    ?from=2026-01-01&to=2026-03-10

    Returns headline KPIs: total spend, PO count, avg PO value,
    active suppliers, pending approvals, overdue POs, open returns, disputes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        today = date.today()
        try:
            period_start = date.fromisoformat(
                request.query_params.get('from', str(today - timedelta(days=30)))
            )
            period_end = date.fromisoformat(
                request.query_params.get('to', str(today))
            )
        except ValueError:
            return Response({'error': 'Invalid date format'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        data = ProcurementAnalyticsService.get_dashboard_kpis(
            org, period_start, period_end
        )
        return Response(data)


class POAgingView(APIView):
    """
    GET /pos/analytics/procurement/aging/

    Returns PO aging buckets (0-7, 8-14, 15-30, 31-60, 60+)
    and overdue detail.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        data = ProcurementAnalyticsService.get_po_aging(org)
        return Response(data)


class CycleTimesView(APIView):
    """
    GET /pos/analytics/procurement/cycle-times/
    ?from=2026-01-01&to=2026-03-10

    Returns cycle time stats: draft-to-approve, approve-to-receive, end-to-end.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        today = date.today()
        try:
            period_start = date.fromisoformat(
                request.query_params.get('from', str(today - timedelta(days=90)))
            )
            period_end = date.fromisoformat(
                request.query_params.get('to', str(today))
            )
        except ValueError:
            return Response({'error': 'Invalid date format'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        data = ProcurementAnalyticsService.get_cycle_times(
            org, period_start, period_end
        )
        return Response(data)


class SpendBySupplierView(APIView):
    """
    GET /pos/analytics/procurement/spend-by-supplier/
    ?from=2026-01-01&to=2026-03-10&top=20

    Returns top N suppliers ranked by total spend.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        today = date.today()
        try:
            period_start = date.fromisoformat(
                request.query_params.get('from', str(today - timedelta(days=90)))
            )
            period_end = date.fromisoformat(
                request.query_params.get('to', str(today))
            )
        except ValueError:
            return Response({'error': 'Invalid date format'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        top_n = int(request.query_params.get('top', 20))
        data = ProcurementAnalyticsService.get_spend_by_supplier(
            org, period_start, period_end, top_n
        )
        return Response({'suppliers': data})


class MonthlySpendTrendView(APIView):
    """
    GET /pos/analytics/procurement/monthly-trend/
    ?months=12

    Returns monthly spend trend for charting.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        months = int(request.query_params.get('months', 12))
        data = ProcurementAnalyticsService.get_monthly_spend_trend(org, months)
        return Response({'trend': data})


class SupplierIntelligenceView(APIView):
    """
    GET /pos/analytics/procurement/supplier-intelligence/
    ?product=<product_id>&top=10

    Returns enriched supplier intelligence grid with real performance scores.
    If product is specified, returns supplier recommendations for that product.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        product_id = request.query_params.get('product')
        top_n = int(request.query_params.get('top', 10))
        data = ProcurementAnalyticsService.get_supplier_intelligence(
            org, product_id, top_n
        )
        return Response({'suppliers': data})


class BudgetUtilizationView(APIView):
    """
    GET /pos/analytics/procurement/budget-utilization/
    ?from=2026-01-01&to=2026-12-31

    Returns budget allocation, commitment, and utilization stats.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        today = date.today()
        try:
            period_start = date.fromisoformat(
                request.query_params.get('from', str(today.replace(month=1, day=1)))
            )
            period_end = date.fromisoformat(
                request.query_params.get('to', str(today.replace(month=12, day=31)))
            )
        except ValueError:
            return Response({'error': 'Invalid date format'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        data = ProcurementAnalyticsService._compute_budget_utilization(
            org, period_start, period_end
        )
        return Response(data)


class RequisitionPipelineView(APIView):
    """
    GET /pos/analytics/procurement/requisition-pipeline/

    Returns status distribution of purchase requisitions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, 'organization', None) or getattr(request.user, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'},
                            status=http_status.HTTP_400_BAD_REQUEST)

        data = ProcurementAnalyticsService.get_requisition_pipeline(org)
        return Response(data)
