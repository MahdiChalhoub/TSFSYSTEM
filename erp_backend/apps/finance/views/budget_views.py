"""
Budget Variance Views
=====================
API endpoints for budget management and variance analysis.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from erp.views import TenantModelViewSet
from erp.mixins import UDLEViewSetMixin
from kernel.performance import profile_view
from apps.finance.models.budget_models import Budget, BudgetLine
from apps.finance.services.budget_variance_service import BudgetVarianceService
from apps.finance.serializers.budget_serializers import (
    BudgetSerializer,
    BudgetLineSerializer,
    VarianceReportSerializer,
    VarianceAlertSerializer,
    BudgetPerformanceSerializer,
    RefreshActualsSerializer,
)


class BudgetViewSet(UDLEViewSetMixin, TenantModelViewSet):
    """ViewSet for budget management."""

    queryset = Budget.objects.select_related('fiscal_year', 'created_by', 'approved_by').all()
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['fiscal_year', 'version', 'status']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'fiscal_year__start_date', 'status']
    ordering = ['-fiscal_year__start_date', 'version']

    @action(detail=True, methods=['post'], serializer_class=RefreshActualsSerializer)
    def refresh_actuals(self, request, pk=None):
        """
        Refresh actual amounts from journal entries.

        POST /api/finance/budgets/{id}/refresh-actuals/
        {
            "force": true
        }

        Returns:
            Refresh statistics
        """
        budget = self.get_object()

        serializer = RefreshActualsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = BudgetVarianceService(budget)
        stats = service.refresh_all_actuals()

        return Response({
            'message': 'Actuals refreshed successfully',
            'stats': stats
        })

    @action(detail=True, methods=['get'])
    @profile_view
    def variance_report(self, request, pk=None):
        """
        Get comprehensive variance report.

        GET /api/finance/budgets/{id}/variance-report/
            ?period=ALL|CURRENT|YTD|{period_id}
            &account={account_id},{account_id}
            &cost_center={code}

        Returns:
            Variance analysis with breakdowns
        """
        budget = self.get_object()

        # Get query parameters
        period_filter = request.query_params.get('period', 'ALL')
        account_filter = request.query_params.get('account')
        cost_center_filter = request.query_params.get('cost_center')

        # Parse account filter
        account_ids = None
        if account_filter:
            account_ids = [int(aid) for aid in account_filter.split(',')]

        service = BudgetVarianceService(budget)
        report = service.get_variance_report(
            period_filter=period_filter,
            account_filter=account_ids,
            cost_center_filter=cost_center_filter
        )

        # Serialize summary (skip detailed lists for now)
        summary = {
            'budget_id': report['budget_id'],
            'budget_name': report['budget_name'],
            'fiscal_year': report['fiscal_year'],
            'total_budget': report['total_budget'],
            'total_actual': report['total_actual'],
            'total_committed': report['total_committed'],
            'total_variance': report['total_variance'],
            'total_available': report['total_available'],
            'variance_percentage': report['variance_percentage'],
            'utilization_percentage': report['utilization_percentage'],
            'over_budget_count': report['over_budget_count'],
        }

        serializer = VarianceReportSerializer(summary)

        return Response({
            **serializer.data,
            'by_account': report['by_account'],
            'by_period': report['by_period'],
            'by_cost_center': report['by_cost_center'],
            'over_budget_items': report['over_budget_items'][:10],  # Limit to top 10
        })

    @action(detail=True, methods=['get'])
    @profile_view
    def variance_alerts(self, request, pk=None):
        """
        Get variance alerts for over-budget items.

        GET /api/finance/budgets/{id}/variance-alerts/?threshold=10

        Returns:
            List of alerts sorted by severity
        """
        budget = self.get_object()

        # Get threshold from query params
        from decimal import Decimal
        threshold = request.query_params.get('threshold', '10')
        threshold_pct = Decimal(threshold)

        service = BudgetVarianceService(budget)
        alerts = service.generate_variance_alerts(threshold_pct=threshold_pct)

        serializer = VarianceAlertSerializer(alerts, many=True)
        return Response({
            'total_alerts': len(alerts),
            'critical_count': sum(1 for a in alerts if a['severity'] == 'CRITICAL'),
            'warning_count': sum(1 for a in alerts if a['severity'] == 'WARNING'),
            'info_count': sum(1 for a in alerts if a['severity'] == 'INFO'),
            'alerts': serializer.data
        })

    @action(detail=True, methods=['get'])
    def performance_summary(self, request, pk=None):
        """
        Get budget performance summary.

        GET /api/finance/budgets/{id}/performance-summary/

        Returns:
            Performance metrics
        """
        budget = self.get_object()

        service = BudgetVarianceService(budget)
        summary = service.get_budget_performance_summary()

        serializer = BudgetPerformanceSerializer(summary)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def compare_to_previous(self, request, pk=None):
        """
        Compare to previous period's budget.

        GET /api/finance/budgets/{id}/compare-to-previous/
            ?previous_budget_id={id}

        Returns:
            Period-over-period comparison
        """
        budget = self.get_object()

        # Get previous budget ID from query params
        previous_budget_id = request.query_params.get('previous_budget_id')

        if not previous_budget_id:
            return Response({
                'error': 'previous_budget_id query parameter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        from erp.middleware import get_current_tenant_id
        org_id = get_current_tenant_id()
        try:
            previous_budget = Budget.objects.get(
                id=previous_budget_id,
                organization_id=org_id
            )
        except Budget.DoesNotExist:
            return Response({
                'error': 'Previous budget not found'
            }, status=status.HTTP_404_NOT_FOUND)

        service = BudgetVarianceService(budget)
        comparison = service.compare_to_previous_period(previous_budget)

        return Response(comparison)

    @action(detail=False, methods=['get'])
    @profile_view
    def all_alerts(self, request):
        """
        Get variance alerts for all approved budgets.

        GET /api/finance/budgets/all-alerts/?threshold=10

        Returns:
            Consolidated alerts across all budgets
        """
        from decimal import Decimal

        threshold = request.query_params.get('threshold', '10')
        threshold_pct = Decimal(threshold)

        # Get all approved budgets
        from erp.middleware import get_current_tenant_id
        org_id = get_current_tenant_id()
        budgets = Budget.objects.filter(
            organization_id=org_id,
            status__in=['APPROVED', 'LOCKED']
        )

        all_alerts = []

        for budget in budgets:
            service = BudgetVarianceService(budget)
            alerts = service.generate_variance_alerts(threshold_pct=threshold_pct)

            # Add budget info to each alert
            for alert in alerts:
                alert['budget_id'] = budget.id
                alert['budget_name'] = budget.name
                alert['fiscal_year'] = budget.fiscal_year.name

            all_alerts.extend(alerts)

        # Sort by severity and percentage
        severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
        all_alerts.sort(key=lambda x: (severity_order[x['severity']], -x['over_budget_percentage']))

        serializer = VarianceAlertSerializer(all_alerts, many=True)

        return Response({
            'total_alerts': len(all_alerts),
            'critical_count': sum(1 for a in all_alerts if a['severity'] == 'CRITICAL'),
            'warning_count': sum(1 for a in all_alerts if a['severity'] == 'WARNING'),
            'info_count': sum(1 for a in all_alerts if a['severity'] == 'INFO'),
            'budgets_count': budgets.count(),
            'alerts': serializer.data[:50]  # Limit to top 50
        })

    @action(detail=False, methods=['get'])
    @profile_view
    def dashboard(self, request):
        """
        Get budget dashboard with key metrics.

        GET /api/finance/budgets/dashboard/

        Returns:
            Dashboard metrics for all active budgets
        """
        from erp.middleware import get_current_tenant_id
        org_id = get_current_tenant_id()
        budgets = Budget.objects.filter(
            organization_id=org_id,
            status__in=['APPROVED', 'LOCKED']
        ).select_related('fiscal_year')

        dashboard_data = []

        for budget in budgets:
            service = BudgetVarianceService(budget)
            summary = service.get_budget_performance_summary()

            dashboard_data.append({
                'budget_id': budget.id,
                'budget_name': budget.name,
                'fiscal_year': budget.fiscal_year.name,
                'version': budget.version,
                'total_budget': summary['total_budget'],
                'total_actual': summary['total_actual'],
                'utilization_rate': summary['utilization_rate'],
                'variance_percentage': summary['variance_percentage'],
                'over_budget_count': summary['over_budget_count'],
            })

        return Response({
            'budgets_count': len(dashboard_data),
            'budgets': dashboard_data
        })


class BudgetLineViewSet(UDLEViewSetMixin, TenantModelViewSet):
    """ViewSet for budget lines."""

    queryset = BudgetLine.objects.select_related('budget', 'account', 'fiscal_period').all()
    serializer_class = BudgetLineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['budget', 'account', 'fiscal_period', 'cost_center']
    ordering_fields = ['budgeted_amount', 'actual_amount', 'variance_amount']
    ordering = ['account__code']

    @action(detail=True, methods=['post'])
    def refresh_actual(self, request, pk=None):
        """
        Refresh actual amount for a single budget line.

        POST /api/finance/budget-lines/{id}/refresh-actual/

        Returns:
            Updated line data
        """
        line = self.get_object()

        service = BudgetVarianceService(line.budget)
        actual_amount = service.refresh_line_actual(line)

        # Refresh from DB
        line.refresh_from_db()

        serializer = self.get_serializer(line)
        return Response({
            'message': 'Actual amount refreshed',
            'actual_amount': actual_amount,
            'line': serializer.data
        })
