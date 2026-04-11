from .base import (
    transaction, viewsets, status, Response, action,
    TenantModelViewSet, UDLEViewSetMixin, get_current_tenant_id,
    Organization
)
from apps.finance.models import FiscalYear, FiscalPeriod
from apps.finance.serializers import FiscalYearSerializer, FiscalPeriodSerializer
from apps.finance.services import LedgerService

class FiscalYearViewSet(UDLEViewSetMixin, TenantModelViewSet):
    queryset = FiscalYear.objects.all()
    serializer_class = FiscalYearSerializer

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

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        fiscal_year = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        
        try:
            from apps.finance.services import FiscalYearService
            FiscalYearService.close_fiscal_year(organization, fiscal_year)
            return Response({"status": "Fiscal Year Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        fiscal_year = self.get_object()
        if not fiscal_year.is_closed:
            return Response({"error": "Year must be closed before locking"}, status=status.HTTP_400_BAD_REQUEST)
        
        fiscal_year.is_hard_locked = True
        fiscal_year.save()
        return Response({"status": "Fiscal Year Locked"})


class FiscalPeriodViewSet(TenantModelViewSet):
    queryset = FiscalPeriod.objects.all()
    serializer_class = FiscalPeriodSerializer

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        period = self.get_object()
        organization_id = get_current_tenant_id()
        organization = Organization.objects.get(id=organization_id)
        
        try:
            # Validate control accounts
            LedgerService.validate_closure(organization, fiscal_period=period)
            
            period.is_closed = True
            period.save()
            return Response({"status": "Period Closed"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
