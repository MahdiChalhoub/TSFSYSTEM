"""
Financial Report Views
=======================
API endpoints for comprehensive financial reports.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from erp.views import TenantViewMixin
from erp.middleware import get_current_tenant_id
from apps.finance.services.financial_report_service import FinancialReportService
from apps.finance.serializers.report_serializers import (
    TrialBalanceSerializer,
    ProfitLossSerializer,
    BalanceSheetSerializer,
    CashFlowSerializer,
    ReportParametersSerializer,
)


class TrialBalanceView(TenantViewMixin, APIView):
    """
    Generate Trial Balance report.

    GET /api/finance/reports/trial-balance/
        ?start_date=2024-01-01
        &end_date=2024-12-31
        &include_opening=true
        &include_closing=true
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Parse parameters
        param_serializer = ReportParametersSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)

        start_date = param_serializer.validated_data['start_date']
        end_date = param_serializer.validated_data['end_date']
        include_opening = param_serializer.validated_data.get('include_opening', True)
        include_closing = param_serializer.validated_data.get('include_closing', True)

        # Generate report
        from erp.models import Organization
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, end_date)
        report = service.generate_trial_balance(
            include_opening=include_opening,
            include_closing=include_closing
        )

        serializer = TrialBalanceSerializer(report)
        return Response(serializer.data)


class ProfitLossView(TenantViewMixin, APIView):
    """
    Generate Profit & Loss Statement.

    GET /api/finance/reports/profit-loss/
        ?start_date=2024-01-01
        &end_date=2024-12-31
        &comparative=true
        &previous_start=2023-01-01
        &previous_end=2023-12-31
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Parse parameters
        param_serializer = ReportParametersSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)

        start_date = param_serializer.validated_data['start_date']
        end_date = param_serializer.validated_data['end_date']
        comparative = param_serializer.validated_data.get('comparative', False)
        previous_start = param_serializer.validated_data.get('previous_start')
        previous_end = param_serializer.validated_data.get('previous_end')

        # Generate report
        from erp.models import Organization
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, end_date)
        report = service.generate_profit_loss(
            comparative_period=comparative,
            previous_start=previous_start,
            previous_end=previous_end
        )

        serializer = ProfitLossSerializer(report)
        return Response(serializer.data)


class BalanceSheetView(TenantViewMixin, APIView):
    """
    Generate Balance Sheet.

    GET /api/finance/reports/balance-sheet/
        ?as_of_date=2024-12-31
        &comparative=true
        &previous_date=2023-12-31
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get as_of_date
        as_of_str = request.query_params.get('as_of_date')
        if not as_of_str:
            return Response({
                'error': 'as_of_date parameter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        as_of_date = date.fromisoformat(as_of_str)

        comparative = request.query_params.get('comparative', 'false').lower() == 'true'
        previous_date = None

        if comparative:
            previous_str = request.query_params.get('previous_date')
            if previous_str:
                previous_date = date.fromisoformat(previous_str)

        # Generate report
        # Use dummy start_date for service initialization
        start_date = as_of_date - relativedelta(years=1)

        from erp.models import Organization
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, as_of_date)
        report = service.generate_balance_sheet(
            as_of_date=as_of_date,
            comparative=comparative,
            previous_date=previous_date
        )

        serializer = BalanceSheetSerializer(report)
        return Response(serializer.data)


class CashFlowView(TenantViewMixin, APIView):
    """
    Generate Cash Flow Statement.

    GET /api/finance/reports/cash-flow/
        ?start_date=2024-01-01
        &end_date=2024-12-31
        &method=INDIRECT
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Parse parameters
        param_serializer = ReportParametersSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)

        start_date = param_serializer.validated_data['start_date']
        end_date = param_serializer.validated_data['end_date']
        method = param_serializer.validated_data.get('method', 'INDIRECT')

        # Generate report
        from erp.models import Organization
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, end_date)
        report = service.generate_cash_flow_statement(method=method)

        serializer = CashFlowSerializer(report)
        return Response(serializer.data)


class FinancialReportsDashboardView(TenantViewMixin, APIView):
    """
    Get financial reports dashboard with key metrics.

    GET /api/finance/reports/dashboard/
        ?period=CURRENT_MONTH|CURRENT_QUARTER|CURRENT_YEAR|YTD
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Determine period
        period = request.query_params.get('period', 'CURRENT_MONTH')

        today = date.today()

        if period == 'CURRENT_MONTH':
            start_date = date(today.year, today.month, 1)
            end_date = date(today.year, today.month, 1) + relativedelta(months=1, days=-1)
        elif period == 'CURRENT_QUARTER':
            quarter = (today.month - 1) // 3 + 1
            start_date = date(today.year, (quarter - 1) * 3 + 1, 1)
            end_date = start_date + relativedelta(months=3, days=-1)
        elif period == 'CURRENT_YEAR':
            start_date = date(today.year, 1, 1)
            end_date = date(today.year, 12, 31)
        elif period == 'YTD':
            start_date = date(today.year, 1, 1)
            end_date = today
        else:
            start_date = date(today.year, today.month, 1)
            end_date = today

        # Generate quick metrics
        from erp.models import Organization
        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, end_date)

        # Get P&L summary
        pl = service.generate_profit_loss()

        # Get balance sheet summary (as of end_date)
        bs = service.generate_balance_sheet(as_of_date=end_date)

        # Get cash flow summary
        cf = service.generate_cash_flow_statement()

        dashboard = {
            'period': period,
            'start_date': start_date,
            'end_date': end_date,
            'profit_loss': {
                'revenue': pl['revenue']['total'],
                'expenses': pl['expenses']['total'],
                'net_income': pl['net_income'],
                'net_margin': pl['net_margin_percentage'],
            },
            'balance_sheet': {
                'total_assets': bs['assets']['total'],
                'total_liabilities': bs['liabilities']['total'],
                'total_equity': bs['equity']['total'],
                'is_balanced': bs['is_balanced'],
            },
            'cash_flow': {
                'operating_cash': cf['operating_activities']['total'],
                'investing_cash': cf['investing_activities']['total'],
                'financing_cash': cf['financing_activities']['total'],
                'net_cash_change': cf['net_cash_change'],
                'ending_cash': cf['ending_cash'],
            }
        }

        return Response(dashboard)


class AccountDrillDownView(TenantViewMixin, APIView):
    """
    Get detailed transactions for an account.

    GET /api/finance/reports/account-drilldown/{account_id}/
        ?start_date=2024-01-01
        &end_date=2024-12-31
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, account_id):
        from apps.finance.models import ChartOfAccount, JournalEntryLine

        # Get account
        org_id = get_current_tenant_id()
        try:
            account = ChartOfAccount.objects.get(
                id=account_id,
                organization_id=org_id
            )
        except ChartOfAccount.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Parse dates
        param_serializer = ReportParametersSerializer(data=request.query_params)
        param_serializer.is_valid(raise_exception=True)

        start_date = param_serializer.validated_data['start_date']
        end_date = param_serializer.validated_data['end_date']

        # Get transactions
        transactions = JournalEntryLine.objects.filter(
            organization_id=org_id,
            account=account,
            entry__status='POSTED',
            entry__transaction_date__gte=start_date,
            entry__transaction_date__lte=end_date
        ).select_related('entry').order_by('entry__transaction_date', 'entry__id')

        # Format response
        transaction_list = []
        from erp.models import Organization
        organization = Organization.objects.get(id=org_id)
        service = FinancialReportService(organization, start_date, end_date)
        running_balance = service._calculate_account_balance(
            account,
            end_date=start_date - timedelta(days=1)
        )

        for txn in transactions:
            debit = txn.debit
            credit = txn.credit

            # Update running balance
            if account.normal_balance == 'DEBIT':
                running_balance += debit - credit
            else:
                running_balance += credit - debit

            transaction_list.append({
                'date': txn.entry.transaction_date,
                'entry_number': txn.entry.entry_number,
                'description': txn.entry.description,
                'debit': debit,
                'credit': credit,
                'balance': running_balance,
            })

        return Response({
            'account_code': account.code,
            'account_name': account.name,
            'start_date': start_date,
            'end_date': end_date,
            'opening_balance': running_balance - sum(
                txn['debit'] - txn['credit'] if account.normal_balance == 'DEBIT'
                else txn['credit'] - txn['debit']
                for txn in transaction_list
            ),
            'transactions': transaction_list,
            'closing_balance': running_balance,
        })
