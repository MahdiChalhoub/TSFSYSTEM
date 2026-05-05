"""
Enhanced Asset Management Views
================================
Additional actions for asset depreciation, schedules, and disposal.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import date
from django.db import transaction
from kernel.performance import profile_view
from apps.finance.models import Asset, AmortizationSchedule, FinancialAccount
from apps.finance.services.depreciation_service import DepreciationService, DepreciationBatchService
from apps.finance.serializers.asset_serializers import (
    DepreciationPostingSerializer,
    AssetDisposalSerializer,
    DepreciationSummarySerializer,
    AssetRegisterSerializer,
)


class AssetDepreciationMixin:
    """
    Mixin to add depreciation management actions to AssetViewSet.

    Add this to existing AssetViewSet like:
        class AssetViewSet(AssetDepreciationMixin, TenantModelViewSet):
            ...
    """

    @action(detail=True, methods=['get'])
    @profile_view
    def depreciation_schedule(self, request, pk=None):
        """
        Get depreciation schedule for asset.

        GET /api/finance/assets/{id}/depreciation-schedule/

        Returns:
            List of depreciation periods with amounts
        """
        asset = self.get_object()

        service = DepreciationService(asset)

        # Generate schedule if doesn't exist
        if not asset.amortization_lines.exists():
            try:
                service.generate_depreciation_schedule()
            except Exception as e:
                return Response({
                    'error': f"Could not generate schedule: {str(e)}"
                }, status=status.HTTP_400_BAD_REQUEST)

        # Get schedule entries
        schedule = asset.amortization_lines.all().order_by('period_date')

        schedule_data = [
            {
                'period_date': entry.period_date,
                'amount': entry.amount,
                'is_posted': entry.is_posted,
                'journal_entry_id': entry.journal_entry.id if entry.journal_entry else None,
            }
            for entry in schedule
        ]

        return Response(schedule_data)

    @action(detail=True, methods=['post'])
    def regenerate_schedule(self, request, pk=None):
        """
        Regenerate depreciation schedule.

        POST /api/finance/assets/{id}/regenerate-schedule/

        Warning: This deletes existing unposted schedule entries!
        """
        asset = self.get_object()

        if asset.status == 'DISPOSED':
            return Response({
                'error': 'Cannot regenerate schedule for disposed assets'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if any entries are posted
        if asset.amortization_lines.filter(is_posted=True).exists():
            return Response({
                'error': 'Cannot regenerate schedule with posted entries'
            }, status=status.HTTP_400_BAD_REQUEST)

        service = DepreciationService(asset)

        try:
            schedule = service.generate_depreciation_schedule(regenerate=True)

            return Response({
                'message': 'Schedule regenerated successfully',
                'schedule_entries': len(schedule)
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], serializer_class=DepreciationPostingSerializer)
    def post_depreciation(self, request, pk=None):
        """
        Post depreciation for a specific month.

        POST /api/finance/assets/{id}/post-depreciation/
        {
            "month": 3,
            "year": 2024
        }

        Returns:
            Posting result with journal entry
        """
        asset = self.get_object()

        if asset.status not in ['ACTIVE', 'FULLY_DEPRECIATED']:
            return Response({
                'error': f'Cannot post depreciation for {asset.status} assets'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = DepreciationPostingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month = serializer.validated_data['month']
        year = serializer.validated_data['year']

        service = DepreciationService(asset)

        try:
            result = service.post_monthly_depreciation(month, year)

            return Response(result)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def depreciation_summary(self, request, pk=None):
        """
        Get comprehensive depreciation summary.

        GET /api/finance/assets/{id}/depreciation-summary/

        Returns:
            Depreciation summary with totals and status
        """
        asset = self.get_object()

        service = DepreciationService(asset)
        summary = service.get_depreciation_summary()

        serializer = DepreciationSummarySerializer(summary)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], serializer_class=AssetDisposalSerializer)
    def dispose(self, request, pk=None):
        """
        Dispose of an asset.

        POST /api/finance/assets/{id}/dispose/
        {
            "disposal_date": "2024-03-12",
            "disposal_amount": "15000.00",
            "disposal_account_id": 123,
            "notes": "Sold to ABC Company"
        }

        Returns:
            Disposal result with gain/loss
        """
        asset = self.get_object()

        if asset.status == 'DISPOSED':
            return Response({
                'error': 'Asset is already disposed'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = AssetDisposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        disposal_date = serializer.validated_data['disposal_date']
        disposal_amount = serializer.validated_data['disposal_amount']
        disposal_account_id = serializer.validated_data['disposal_account_id']
        notes = serializer.validated_data.get('notes', '')

        # Get disposal account
        try:
            disposal_account = FinancialAccount.objects.get(
                id=disposal_account_id,
                organization=asset.organization
            )
        except FinancialAccount.DoesNotExist:
            return Response({
                'error': 'Disposal account not found'
            }, status=status.HTTP_404_NOT_FOUND)

        service = DepreciationService(asset)

        try:
            result = service.dispose_asset(
                disposal_date=disposal_date,
                disposal_amount=disposal_amount,
                disposal_account=disposal_account,
                notes=notes
            )

            return Response(result)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], serializer_class=DepreciationPostingSerializer)
    @profile_view
    def post_batch_depreciation(self, request):
        """
        Post depreciation for all active assets for a month.

        POST /api/finance/assets/post-batch-depreciation/
        {
            "month": 3,
            "year": 2024
        }

        Returns:
            Batch posting results
        """
        serializer = DepreciationPostingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month = serializer.validated_data['month']
        year = serializer.validated_data['year']

        results = DepreciationBatchService.post_depreciation_for_month(
            organization=request.organization,
            month=month,
            year=year
        )

        return Response(results)

    @action(detail=False, methods=['get'])
    @profile_view
    def asset_register(self, request):
        """
        Get asset register report.

        GET /api/finance/assets/asset-register/

        Returns:
            List of all assets with depreciation details
        """
        register = DepreciationBatchService.get_asset_register(
            organization=request.organization
        )

        serializer = DepreciationSummarySerializer(register, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    @profile_view
    def fully_depreciated(self, request):
        """
        Get list of fully depreciated assets.

        GET /api/finance/assets/fully-depreciated/

        Returns:
            List of fully depreciated assets
        """
        assets = Asset.objects.filter(
            organization=request.organization,
            status='FULLY_DEPRECIATED'
        ).select_related('asset_coa')

        assets_data = [
            {
                'id': asset.id,
                'name': asset.name,
                'category': asset.category,
                'purchase_value': asset.purchase_value,
                'accumulated_depreciation': asset.accumulated_depreciation,
                'book_value': asset.book_value,
                'purchase_date': asset.purchase_date,
            }
            for asset in assets
        ]

        return Response(assets_data)

    @action(detail=False, methods=['get'])
    @profile_view
    def pending_depreciation(self, request):
        """
        Get assets with pending (unposted) depreciation for current month.

        GET /api/finance/assets/pending-depreciation/?month=3&year=2024

        Returns:
            List of assets with unposted depreciation
        """
        # Get month/year from query params or use current
        month = int(request.query_params.get('month', date.today().month))
        year = int(request.query_params.get('year', date.today().year))

        # Get period date
        from dateutil.relativedelta import relativedelta
        period_date = date(year, month, 1) + relativedelta(day=31)

        # Get unposted schedule entries for this period
        pending_entries = AmortizationSchedule.objects.filter(
            organization=request.organization,
            period_date=period_date,
            is_posted=False
        ).select_related('asset')

        pending_data = [
            {
                'asset_id': entry.asset.id,
                'asset_name': entry.asset.name,
                'category': entry.asset.category,
                'depreciation_amount': entry.amount,
                'period_date': entry.period_date,
            }
            for entry in pending_entries
        ]

        return Response({
            'month': month,
            'year': year,
            'period_date': period_date,
            'pending_count': len(pending_data),
            'total_amount': sum(entry['depreciation_amount'] for entry in pending_data),
            'assets': pending_data
        })
