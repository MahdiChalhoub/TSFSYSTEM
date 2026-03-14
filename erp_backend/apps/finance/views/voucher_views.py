from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id,
    Organization
)
from kernel.lifecycle.viewsets import LifecycleViewSetMixin
from apps.finance.models import Voucher, ProfitDistribution
from apps.finance.serializers import VoucherSerializer, ProfitDistributionSerializer
from apps.finance.services import VoucherService, ProfitDistributionService

class VoucherViewSet(LifecycleViewSetMixin, TenantModelViewSet):
    queryset = Voucher.objects.all()
    serializer_class = VoucherSerializer
    lifecycle_transaction_type = 'VOUCHER'

    def get_queryset(self):
        vtype = self.request.query_params.get('type')
        lc_status = self.request.query_params.get('status')
        qs = super().get_queryset().order_by('-created_at')
        if vtype:
            qs = qs.filter(voucher_type=vtype)
        if lc_status:
            qs = qs.filter(status=lc_status)
        return qs

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            voucher = VoucherService.create_voucher(
                organization=organization,
                data=request.data,
                user=request.user,
                scope=request.data.get('scope', 'OFFICIAL')
            )
            return Response(VoucherSerializer(voucher).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def update(self, request, *args, **kwargs):
        voucher = self.get_object()
        if not voucher.is_editable:
            return Response({"error": "Only OPEN vouchers can be edited."}, status=400)
        # Only allow updating certain fields
        allowed = {'amount', 'date', 'description', 'source_account_id',
                   'destination_account_id', 'financial_event_id', 'contact_id'}
        update_data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in update_data.items():
            setattr(voucher, key, value)
        voucher.save()
        return Response(VoucherSerializer(voucher).data)

    def destroy(self, request, *args, **kwargs):
        voucher = self.get_object()
        if not voucher.is_editable:
            return Response({"error": "Only OPEN vouchers can be deleted."}, status=400)
        voucher.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='post')
    def post_voucher(self, request, pk=None):
        """Standardize post action for Voucher."""
        voucher = self.get_object()
        try:
            from apps.finance.services import VoucherService
            voucher = VoucherService.post_voucher(voucher.organization, pk, user=request.user)
            return Response(VoucherSerializer(voucher).data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ProfitDistributionViewSet(TenantModelViewSet):
    queryset = ProfitDistribution.objects.all()
    serializer_class = ProfitDistributionSerializer

    @action(detail=False, methods=['post'])
    def calculate(self, request):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            result = ProfitDistributionService.calculate_distribution(
                organization=organization,
                fiscal_year_id=request.data.get('fiscal_year_id'),
                allocations=request.data.get('allocations', {})
            )
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def create(self, request, *args, **kwargs):
        organization_id = get_current_tenant_id()
        if not organization_id: return Response({"error": "Tenant context missing"}, status=400)
        organization = Organization.objects.get(id=organization_id)

        try:
            dist = ProfitDistributionService.create_distribution(
                organization=organization,
                fiscal_year_id=request.data.get('fiscal_year_id'),
                allocations=request.data.get('allocations', {}),
                distribution_date=request.data.get('distribution_date'),
                notes=request.data.get('notes', ''),
                user=request.user
            )
            return Response(ProfitDistributionSerializer(dist).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
