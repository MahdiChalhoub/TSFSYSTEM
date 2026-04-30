"""
FiscalPeriodViewSet — fiscal period CRUD + lock/reopen actions.

Extracted from `fiscal_views.py` for the 300-line maintainability
ceiling. Re-exported by `fiscal_views.py` so URL routing stays
unchanged.
"""
from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, get_current_tenant_id, Organization,
)
from apps.finance.models import FiscalPeriod
from apps.finance.serializers import FiscalPeriodSerializer
from apps.finance.services import LedgerService

from .fiscal_permissions import FiscalActionPermission


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer
    permission_classes = [FiscalActionPermission]
    default_permission = 'finance.view_fiscal_years'
    action_permission_map = {
        'list': 'finance.view_fiscal_years',
        'retrieve': 'finance.view_fiscal_years',
        'create': 'finance.manage_fiscal_years',
        'update': 'finance.manage_fiscal_years',
        'partial_update': 'finance.manage_fiscal_years',
        'destroy': 'finance.manage_fiscal_years',
        'close': 'finance.close_fiscal_year',
        'soft_lock': 'finance.close_fiscal_year',
        'hard_lock': 'finance.close_fiscal_year',
        'reopen': 'finance.manage_fiscal_years',
    }

    def perform_update(self, serializer):
        """Block status changes if the fiscal year is hard-locked."""
        period = serializer.instance
        if period.fiscal_year.is_hard_locked:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Cannot modify periods in a permanently locked fiscal year.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        period = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)

        try:
            # Validate control accounts
            LedgerService.validate_closure(organization, fiscal_period=period)
            user = request.user if request.user.is_authenticated else None
            period.transition_to('CLOSED', user=user)
            return Response({"status": "Period Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='soft-lock')
    def soft_lock(self, request, pk=None):
        """Soft-lock a period: only supervisors can post afterwards."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.soft_lock_period(period.organization, period, user=user)
            return Response({"status": "Period Soft-Locked"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='hard-lock')
    def hard_lock(self, request, pk=None):
        """Hard-lock a period: no posting allowed at all."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.hard_lock_period(period.organization, period, user=user)
            return Response({"status": "Period Hard-Locked"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen a closed/locked period (superuser-only, enforced in service)."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            from apps.finance.services.closing_service import ClosingService
            ClosingService.reopen_period(period.organization, period, user=user)
            return Response({"status": "Period Reopened"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='request-reopen')
    def request_reopen(self, request, pk=None):
        """Non-superuser path: fire PERIOD_REOPEN_REQUEST so the auto-task
        engine routes it to whoever is configured (specific user, role, or
        ad-hoc user group). The requester identifies themselves and the
        reason; the approver sees both in the generated task."""
        period = self.get_object()
        user = request.user if request.user.is_authenticated else None
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response(
                {"error": "A reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from apps.workspace.auto_task_service import fire_auto_tasks
            requester_name = (
                user.get_full_name() or user.username if user else 'Anonymous'
            )
            created = fire_auto_tasks(
                period.organization,
                'PERIOD_REOPEN_REQUEST',
                {
                    'user': user,
                    'reference': f'Period {period.name}',
                    'extra': {
                        'object_type': 'FiscalPeriod',
                        'object_id': period.id,
                        'Period': period.name,
                        'Status': period.status,
                        'Requested by': requester_name,
                        'Reason': reason,
                    },
                },
            )
            return Response({
                "status": "Request sent",
                "tasks_created": len(created),
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
