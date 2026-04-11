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

    @action(detail=False, methods=['get'], url_path='available-templates')
    def available_templates(self, request):
        """Returns tax group presets from the org's country template."""
        from apps.finance.views.tax_policy_views import _get_org_and_country, _get_template

        org, country_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)
        if not country_code:
            return Response({'country_code': None, 'country_name': None, 'presets': [],
                             'message': 'No country configured. Set your country in Organization Settings.'})

        template = _get_template(country_code)
        if not template:
            return Response({'country_code': country_code, 'country_name': org.country or country_code,
                             'presets': [], 'message': f'No tax template for country {country_code}.'})

        existing_names = set(TaxGroup.objects.filter(organization=org).values_list('name', flat=True))
        presets = template.tax_group_presets or []
        enriched = [{**p, 'already_imported': p.get('name', '') in existing_names} for p in presets]

        return Response({
            'country_code': template.country_code, 'country_name': template.country_name,
            'currency_code': template.currency_code, 'presets': enriched,
            'total': len(presets), 'imported': sum(1 for p in enriched if p['already_imported']),
        })

    @action(detail=False, methods=['post'], url_path='import-from-template')
    def import_from_template(self, request):
        """Import tax group presets from country template into org's tax groups."""
        from decimal import Decimal
        from apps.finance.views.tax_policy_views import _get_org_and_country, _get_template

        org, auto_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)

        country_code = request.data.get('country_code') or auto_code
        if not country_code:
            return Response({'error': 'Country code required'}, status=400)

        template = _get_template(country_code)
        if not template:
            return Response({'error': f'No template for {country_code}'}, status=404)

        preset_names = request.data.get('preset_names') or []
        presets = template.tax_group_presets or []
        if preset_names:
            presets = [p for p in presets if p.get('name') in preset_names]

        existing_names = set(TaxGroup.objects.filter(organization=org).values_list('name', flat=True))

        created, skipped = [], []
        for preset in presets:
            pname = preset.get('name', 'Unnamed Tax Group')
            if pname in existing_names:
                skipped.append(pname); continue

            TaxGroup.objects.create(
                organization=org,
                name=pname,
                rate=Decimal(str(preset.get('rate', '0.00'))),
                tax_type=preset.get('tax_type', 'STANDARD'),
                is_default=preset.get('is_default', False) and not TaxGroup.objects.filter(organization=org, is_default=True).exists(),
                description=preset.get('description', ''),
            )
            created.append(pname)

        return Response({'created': created, 'skipped': skipped,
                         'message': f'{len(created)} tax groups imported, {len(skipped)} already existed.'})


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
