"""
Fiscal Year & Fiscal Period viewsets — entry point.

This module is the public import target for URL routing
(`apps.finance.urls.py`). ViewSet bodies have been split for the
300-line maintainability ceiling:

  fiscal_permissions             → FiscalActionPermission
  fiscal_period_views            → FiscalPeriodViewSet
  fiscal_close_views             → finalize, close_preview, draft_audit
  fiscal_summary_views           → summary
  fiscal_history_views           → year_history
  fiscal_pp_adjustment_views     → prior_period_adjustment + list
  fiscal_snapshot_chain_views    → snapshot_chain
  fiscal_multi_year_views        → multi_year_comparison
  fiscal_yoy_views               → yoy_comparison
  fiscal_checklist_views         → 4 checklist actions + integrity_canary

`FiscalYearViewSet` keeps the `/api/finance/fiscal-years/` router
registration and inherits every @action via mixins so URL routes are
identical to the pre-split layout.
"""
from .base import (
    transaction, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization,
)
from apps.finance.models import FiscalYear
from apps.finance.serializers import FiscalYearSerializer, FiscalPeriodSerializer

from .fiscal_permissions import FiscalActionPermission
from .fiscal_period_views import FiscalPeriodViewSet  # noqa: F401  re-export
from .fiscal_close_views import (
    FiscalYearFinalizeMixin, FiscalYearClosePreviewMixin,
)
from .fiscal_summary_views import FiscalYearSummaryMixin
from .fiscal_history_views import FiscalYearHistoryMixin
from .fiscal_pp_adjustment_views import FiscalYearPPAdjustmentMixin
from .fiscal_snapshot_chain_views import FiscalYearSnapshotChainMixin
from .fiscal_multi_year_views import FiscalYearMultiYearMixin
from .fiscal_yoy_views import FiscalYearYoYMixin
from .fiscal_checklist_views import FiscalYearChecklistMixin


class FiscalYearViewSet(
    FiscalYearFinalizeMixin,
    FiscalYearClosePreviewMixin,
    FiscalYearSummaryMixin,
    FiscalYearHistoryMixin,
    FiscalYearPPAdjustmentMixin,
    FiscalYearSnapshotChainMixin,
    FiscalYearMultiYearMixin,
    FiscalYearYoYMixin,
    FiscalYearChecklistMixin,
    UDLEViewSetMixin,
    TenantModelViewSet,
):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer
    permission_classes = [FiscalActionPermission]
    default_permission = 'finance.view_fiscal_years'
    action_permission_map = {
        'list': 'finance.view_fiscal_years',
        'retrieve': 'finance.view_fiscal_years',
        'create': 'finance.manage_fiscal_years',
        'update': 'finance.manage_fiscal_years',
        'partial_update': 'finance.manage_fiscal_years',
        'destroy': 'finance.manage_fiscal_years',
        'close': 'finance.soft_close_year',
        'finalize': 'finance.hard_close_year',
        'close_preview': 'finance.view_fiscal_years',
        'lock': 'finance.hard_close_year',
        'summary': 'finance.view_fiscal_years',
        'year_history': 'finance.view_fiscal_years',
        'draft_audit': 'finance.view_fiscal_years',
        'current': 'finance.view_fiscal_years',
        'fill_missing_periods': 'finance.manage_fiscal_years',
    }

    def perform_destroy(self, instance):
        """
        Clean up related data before deleting a fiscal year.

        JournalEntries are deliberately NOT destroyed — they are immutable
        financial records. They are detached (fiscal_year=NULL, fiscal_period=NULL)
        and survive as orphans, recoverable later via close_fiscal_year's
        date-based backfill. This preserves the audit trail.

        Order matters: detach JEs first (PROTECT FK), delete OpeningBalances
        explicitly, then cascade-delete periods (CASCADE FK from FiscalYear).
        """
        if instance.is_hard_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot delete a permanently locked fiscal year.")
        from apps.finance.models import OpeningBalance, JournalEntry
        with transaction.atomic():
            OpeningBalance.objects.filter(fiscal_year=instance).delete()
            JournalEntry.objects.filter(fiscal_year=instance).update(fiscal_year=None, fiscal_period=None)
            instance.periods.all().delete()
            instance.delete()

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)

        organization = Organization.objects.get(id=organization_id)

        try:
            from apps.finance.services import FiscalYearService
            fiscal_year = FiscalYearService.create_fiscal_year(
                organization=organization,
                data=request.data
            )
            serializer = self.get_serializer(fiscal_year)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='fill-missing-periods')
    def fill_missing_periods(self, request, pk=None):
        """Generate any periods missing from this fiscal year. Detects
        MONTHLY/QUARTERLY frequency from existing periods. Pass
        `frequency=MONTHLY|QUARTERLY` in the body to override. Never modifies
        existing periods. Returns the list of newly-created periods."""
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        try:
            from apps.finance.services import FiscalYearService
            frequency = request.data.get('frequency') if hasattr(request, 'data') else None
            created = FiscalYearService.fill_missing_periods(
                organization, fiscal_year, frequency=frequency,
            )
            return Response({
                'created_count': len(created),
                'periods': FiscalPeriodSerializer(created, many=True).data,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.soft_close_fiscal_year(
                organization, fiscal_year,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({"status": "Fiscal Year Soft Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        fiscal_year = self.get_object()
        if fiscal_year.status != 'CLOSED':
            return Response({"error": "Year must be closed before locking"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user if request.user.is_authenticated else None
        try:
            fiscal_year.transition_to('FINALIZED', user=user)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "Fiscal Year Locked"})

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Return the fiscal year whose [start_date, end_date] contains today."""
        from django.utils import timezone as tz
        today = tz.localdate()
        organization_id = get_current_tenant_id()
        fy = FiscalYear.objects.filter(
            organization_id=organization_id,
            start_date__lte=today,
            end_date__gte=today,
        ).order_by('start_date').first()
        if not fy:
            return Response({'detail': 'No fiscal year covers today.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(fy).data)
