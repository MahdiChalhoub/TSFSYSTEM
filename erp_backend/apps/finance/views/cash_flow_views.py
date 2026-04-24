"""Cash-flow forecast endpoint."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.middleware import get_current_tenant_id
from erp.models import Organization


class CashFlowForecastViewSet(viewsets.ViewSet):
    """Single read endpoint driving the forecast dashboard."""

    @action(detail=False, methods=['get'], url_path='forecast')
    def forecast(self, request):
        """Cash-flow projection.

        Query params:
          horizon_days: 1-365 (default 90)
          granularity: DAILY | WEEKLY | MONTHLY (default DAILY)
          include_recurring: 0 | 1 (default 1)
        """
        from apps.finance.services.cash_flow_forecast_service import (
            CashFlowForecastService,
        )

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)
        organization = Organization.objects.get(id=org_id)

        try:
            horizon_days = int(request.query_params.get('horizon_days') or 90)
        except ValueError:
            horizon_days = 90
        granularity = (request.query_params.get('granularity') or 'DAILY').upper()
        include_recurring_raw = request.query_params.get('include_recurring', '1')
        include_recurring = include_recurring_raw not in ('0', 'false', 'False')

        return Response(
            CashFlowForecastService.forecast(
                organization,
                horizon_days=horizon_days,
                granularity=granularity,
                include_recurring=include_recurring,
            )
        )
