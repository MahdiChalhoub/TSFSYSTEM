from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import TaxGroup
from apps.finance.serializers import TaxGroupSerializer


class TaxGroupViewSet(TenantModelViewSet):
    queryset = TaxGroup.objects.all()
    serializer_class = TaxGroupSerializer

    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """Set a tax group as the default for this organization."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({"error": "Tenant context missing"}, status=400)
        tax_group_id = request.data.get('tax_group_id')
        if not tax_group_id:
            return Response({"error": "tax_group_id required"}, status=400)
        try:
            TaxGroup.objects.filter(organization_id=organization_id).update(is_default=False)
            tg = TaxGroup.objects.get(id=tax_group_id, organization_id=organization_id)
            tg.is_default = True
            tg.save()
            return Response(TaxGroupSerializer(tg).data)
        except TaxGroup.DoesNotExist:
            return Response({"error": "Tax group not found"}, status=404)


class VATSettlementViewSet(TenantModelViewSet):
    """
    VAT Settlement API
    ==================
    Exposes the VATSettlementService for a given period.

    Endpoints:
        GET  /api/finance/vat-settlement/calculate/?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
        POST /api/finance/vat-settlement/post/

    POST body:
        {
            "period_start": "YYYY-MM-DD",
            "period_end": "YYYY-MM-DD",
            "bank_account_id": <int>       ← required when net_due > 0 (we owe DGI)
        }

    Refund logic (net_due < 0):
        → DR VAT Refund Receivable (not Bank)
        → Bank entry posted only when DGI pays (separate receipt entry)
    """

    # No DB model — this is a service-only ViewSet
    queryset = TaxGroup.objects.none()
    serializer_class = TaxGroupSerializer

    @action(detail=False, methods=['get'])
    def calculate(self, request):
        """
        Preview: calculate VAT position without posting.
        Returns vat_collected, vat_recoverable, net_due, period.
        """
        from apps.finance.services.vat_settlement_service import VATSettlementService
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
            report = VATSettlementService.calculate_settlement(org, period_start, period_end)
            return Response(report)
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='post')
    def post_settlement(self, request):
        """
        Post the VAT settlement journal entry for the period.

        When net_due < 0 (DGI owes us):
            DR TVA Collectée | CR TVA Récupérable | DR VAT Refund Receivable
        When net_due > 0 (we owe DGI):
            DR TVA Collectée | CR TVA Récupérable | CR Bank
        """
        from apps.finance.services.vat_settlement_service import VATSettlementService
        from erp.models import Organization
        from django.core.exceptions import ValidationError

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        period_start   = request.data.get('period_start')
        period_end     = request.data.get('period_end')
        bank_account_id = request.data.get('bank_account_id')

        if not period_start or not period_end:
            return Response({'error': 'period_start and period_end required'}, status=400)

        try:
            org = Organization.objects.get(id=org_id)
            result = VATSettlementService.post_settlement(
                organization=org,
                period_start=period_start,
                period_end=period_end,
                bank_account_id=bank_account_id,
                user=request.user if request.user.is_authenticated else None,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
