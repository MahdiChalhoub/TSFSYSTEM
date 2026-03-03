"""
Tax Policy Views
================
ViewSets for OrgTaxPolicy and CounterpartyTaxProfile.
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule
from apps.finance.serializers.tax_policy_serializers import (
    OrgTaxPolicySerializer, CounterpartyTaxProfileSerializer, CustomTaxRuleSerializer
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
