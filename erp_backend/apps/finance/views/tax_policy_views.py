"""
Tax Policy Views
================
ViewSets for OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule,
and TaxJurisdictionRule.
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule, TaxJurisdictionRule
from apps.finance.serializers.tax_policy_serializers import (
    OrgTaxPolicySerializer, CounterpartyTaxProfileSerializer,
    CustomTaxRuleSerializer, TaxJurisdictionRuleSerializer
)
from apps.finance.models.counterparty_tax_profile import (
    PRESET_ASSUJETTI, PRESET_NON_ASSUJETTI, PRESET_FOREIGN_B2B,
    PRESET_AIRSI_SUBJECT, PRESET_EXPORT_CLIENT
)


class OrgTaxPolicyViewSet(TenantModelViewSet):
    queryset = OrgTaxPolicy.objects.all()
    serializer_class = OrgTaxPolicySerializer

    @action(detail=True, methods=['post'], url_path='set-default')
    def set_default(self, request, pk=None):
        """Make this policy the default for the organization."""
        policy = self.get_object()
        OrgTaxPolicy.objects.filter(
            organization=policy.organization
        ).update(is_default=False)
        policy.is_default = True
        policy.save(update_fields=['is_default'])
        return Response(OrgTaxPolicySerializer(policy).data)

    @action(detail=False, methods=['get'], url_path='default')
    def get_default(self, request):
        """Return the default tax policy for current org."""
        org_id = get_current_tenant_id()
        policy = OrgTaxPolicy.objects.filter(
            organization_id=org_id, is_default=True
        ).first()
        if not policy:
            return Response({'detail': 'No default tax policy configured.'}, status=404)
        return Response(OrgTaxPolicySerializer(policy).data)


class CounterpartyTaxProfileViewSet(TenantModelViewSet):
    queryset = CounterpartyTaxProfile.objects.all()
    serializer_class = CounterpartyTaxProfileSerializer

    def get_queryset(self):
        """Return org-specific profiles + system presets."""
        org_id = get_current_tenant_id()
        from django.db.models import Q
        return CounterpartyTaxProfile.objects.filter(
            Q(organization_id=org_id) | Q(organization_id__isnull=True)
        )

    @action(detail=False, methods=['post'], url_path='seed-presets')
    def seed_presets(self, request):
        """
        Create the 5 standard system presets for this organization if missing.
        Safe to call multiple times (idempotent).
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)

        presets = [
            dict(name=PRESET_ASSUJETTI,     vat_registered=True,  reverse_charge=False, airsi_subject=False, allowed_scopes=['OFFICIAL', 'INTERNAL']),
            dict(name=PRESET_NON_ASSUJETTI,  vat_registered=False, reverse_charge=False, airsi_subject=False, allowed_scopes=['OFFICIAL', 'INTERNAL']),
            dict(name=PRESET_FOREIGN_B2B,    vat_registered=False, reverse_charge=True,  airsi_subject=False, allowed_scopes=['OFFICIAL']),
            dict(name=PRESET_AIRSI_SUBJECT,  vat_registered=True,  reverse_charge=False, airsi_subject=True,  allowed_scopes=['OFFICIAL', 'INTERNAL']),
            dict(name=PRESET_EXPORT_CLIENT,  vat_registered=False, reverse_charge=False, airsi_subject=False, allowed_scopes=['OFFICIAL']),
        ]

        created = []
        for p in presets:
            obj, is_new = CounterpartyTaxProfile.objects.get_or_create(
                organization=org, name=p['name'],
                defaults={**p, 'is_system_preset': True}
            )
            if is_new:
                created.append(p['name'])

        return Response({
            'created': created,
            'total_presets': len(presets),
            'message': f'{len(created)} preset(s) created, {len(presets) - len(created)} already existed.'
        })


class CustomTaxRuleViewSet(TenantModelViewSet):
    queryset = CustomTaxRule.objects.all()
    serializer_class = CustomTaxRuleSerializer


class TaxJurisdictionRuleViewSet(TenantModelViewSet):
    queryset = TaxJurisdictionRule.objects.all()
    serializer_class = TaxJurisdictionRuleSerializer

    def get_queryset(self):
        """Return org-specific rules + system presets."""
        org_id = get_current_tenant_id()
        from django.db.models import Q
        return TaxJurisdictionRule.objects.filter(
            Q(organization_id=org_id) | Q(is_system_preset=True)
        )

    @action(detail=False, methods=['post'], url_path='resolve')
    def resolve_jurisdiction(self, request):
        """
        Preview jurisdiction resolution for given parameters.
        POST body: {origin_country, destination_country, destination_region,
                    counterparty_country, is_export, is_b2b, tax_type}
        """
        from apps.finance.services.jurisdiction_resolver_service import JurisdictionResolverService
        from erp.models import Organization

        org_id = get_current_tenant_id()
        org = Organization.objects.get(id=org_id)

        result = JurisdictionResolverService.resolve(
            organization=org,
            origin_country=request.data.get('origin_country', ''),
            destination_country=request.data.get('destination_country', ''),
            destination_region=request.data.get('destination_region', ''),
            counterparty_country=request.data.get('counterparty_country', ''),
            is_export=request.data.get('is_export', False),
            is_b2b=request.data.get('is_b2b', False),
            tax_type=request.data.get('tax_type', 'VAT'),
        )

        # Serialize Decimals
        for k, v in result.items():
            if hasattr(v, 'quantize'):
                result[k] = str(v)

        return Response(result)

