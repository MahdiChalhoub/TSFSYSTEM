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
from django.db import models
from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule, TaxJurisdictionRule
from apps.finance.serializers.tax_policy_serializers import (
    OrgTaxPolicySerializer, CounterpartyTaxProfileSerializer,
    CustomTaxRuleSerializer, TaxJurisdictionRuleSerializer
)
from apps.finance.models.counterparty_tax_profile import (
    PRESET_ASSUJETTI, PRESET_NON_ASSUJETTI, PRESET_FOREIGN_B2B,
    PRESET_AIRSI_SUBJECT, PRESET_EXPORT_CLIENT
)


# ══════════════════════════════════════════════════════════════════
# Shared Country Resolution Utility
# ══════════════════════════════════════════════════════════════════

def _resolve_org_country_code(org):
    """
    Resolve org country to ISO-2 code using the reference master data.
    Shared utility — used by OrgTaxPolicy, CounterpartyTaxProfile, and CustomTaxRule viewsets.
    Priority chain (all dynamic, zero hardcoded mappings):
      1. OrgCountry default (reference.OrgCountry where is_default=True)
      2. Organization.base_country FK → reference.Country.iso2
      3. Organization.country string → reference.Country name/iso2/iso3 lookup
      4. Organization.settings.countryCode fallback
    """
    from apps.reference.models import Country as RefCountry, OrgCountry

    # Priority 1: OrgCountry default (the /settings/regional canonical source)
    try:
        org_country = OrgCountry.all_objects.filter(
            organization=org, is_default=True, is_enabled=True
        ).select_related('country').first()
        if org_country and org_country.country:
            return org_country.country.iso2.upper()
    except Exception:
        pass

    # Priority 2: Organization.base_country FK
    if hasattr(org, 'base_country') and org.base_country:
        iso2 = getattr(org.base_country, 'iso2', None)
        if iso2:
            return iso2.upper()

    # Priority 3: Parse Organization.country string → dynamic DB lookup
    if org.country:
        raw = org.country.strip()
        if len(raw) <= 3 and raw.isalpha():
            ref = RefCountry.objects.filter(
                models.Q(iso2__iexact=raw) | models.Q(iso3__iexact=raw)
            ).first()
            if ref:
                return ref.iso2.upper()
        else:
            ref = RefCountry.objects.filter(
                models.Q(name__iexact=raw) | models.Q(official_name__iexact=raw)
            ).first()
            if ref:
                return ref.iso2.upper()
            ref = RefCountry.objects.filter(name__icontains=raw).first()
            if ref:
                return ref.iso2.upper()

    # Priority 4: Settings JSON
    settings = org.settings or {}
    code = settings.get('countryCode') or settings.get('country_code')
    if code:
        return code.upper()

    return None


def _get_org_and_country(request=None):
    """Get org + resolved country code. Returns (org, country_code) or raises."""
    from erp.models import Organization
    org_id = get_current_tenant_id()
    if not org_id:
        return None, None
    org = Organization.objects.select_related('base_country').get(id=org_id)
    country_code = _resolve_org_country_code(org)
    return org, country_code


def _get_template(country_code):
    """Get CountryTaxTemplate for a country code or None."""
    from apps.finance.models.country_tax_template import CountryTaxTemplate
    try:
        return CountryTaxTemplate.objects.get(country_code=country_code.upper(), is_active=True)
    except CountryTaxTemplate.DoesNotExist:
        return None


# ══════════════════════════════════════════════════════════════════
# OrgTaxPolicy ViewSet
# ══════════════════════════════════════════════════════════════════

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

    @action(detail=False, methods=['get'], url_path='available-templates')
    def available_templates(self, request):
        """Returns country template presets for the org's country."""
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

        existing_names = set(OrgTaxPolicy.objects.filter(organization=org).values_list('name', flat=True))
        presets = template.org_policy_defaults or []
        enriched = [{**p, 'already_imported': p.get('name', '') in existing_names} for p in presets]

        return Response({
            'country_code': template.country_code, 'country_name': template.country_name,
            'currency_code': template.currency_code, 'presets': enriched,
            'total': len(presets), 'imported': sum(1 for p in enriched if p['already_imported']),
        })

    @action(detail=False, methods=['post'], url_path='import-from-template')
    def import_from_template(self, request):
        """Import presets from CountryTaxTemplate into org policies."""
        from decimal import Decimal

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
        presets = template.org_policy_defaults or []
        if preset_names:
            presets = [p for p in presets if p.get('name') in preset_names]

        existing_names = set(OrgTaxPolicy.objects.filter(organization=org).values_list('name', flat=True))

        FIELD_MAP = {
            'name': 'name', 'vat_output_enabled': 'vat_output_enabled',
            'vat_input_recoverability': 'vat_input_recoverability',
            'official_vat_treatment': 'official_vat_treatment',
            'internal_vat_treatment': 'internal_vat_treatment',
            'airsi_treatment': 'airsi_treatment',
            'purchase_tax_rate': 'purchase_tax_rate', 'purchase_tax_mode': 'purchase_tax_mode',
            'sales_tax_rate': 'sales_tax_rate', 'sales_tax_trigger': 'sales_tax_trigger',
            'periodic_amount': 'periodic_amount', 'periodic_interval': 'periodic_interval',
            'profit_tax_mode': 'profit_tax_mode', 'internal_cost_mode': 'internal_cost_mode',
            'internal_sales_vat_mode': 'internal_sales_vat_mode', 'allowed_scopes': 'allowed_scopes',
        }
        DECIMAL_FIELDS = ('vat_input_recoverability', 'purchase_tax_rate', 'sales_tax_rate', 'periodic_amount')

        created, skipped = [], []
        for preset in presets:
            pname = preset.get('name', 'Unnamed Policy')
            if pname in existing_names:
                skipped.append(pname); continue

            kwargs = {'organization': org, 'country_code': template.country_code, 'currency_code': template.currency_code}
            for src_key, dst_field in FIELD_MAP.items():
                if src_key in preset:
                    val = preset[src_key]
                    if dst_field in DECIMAL_FIELDS:
                        val = Decimal(str(val))
                    kwargs[dst_field] = val

            if not OrgTaxPolicy.objects.filter(organization=org, is_default=True).exists():
                kwargs['is_default'] = True

            OrgTaxPolicy.objects.create(**kwargs)
            created.append(pname)

        return Response({'created': created, 'skipped': skipped,
                         'message': f'{len(created)} policies imported, {len(skipped)} already existed.'})

    @action(detail=False, methods=['post'], url_path='apply-country-template')
    def apply_country_template(self, request):
        """
        POST /api/finance/org-tax-policies/apply-country-template/
        Body: {"country_code": "CI"}  (optional — auto-resolved from org if omitted)

        Idempotent operation that applies an entire CountryTaxTemplate to the tenant:
        - Creates OrgTaxPolicy presets
        - Creates CounterpartyTaxProfile presets
        - Creates TaxGroup entries from tax_group_presets
        - Auto-links GL accounts to the default policy

        Used by: Setup Wizard, Tax Health Dashboard "Fix" button.
        """
        from apps.finance.services.tax_template_service import TaxTemplateService
        from erp.models import Organization

        org, auto_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)

        country_code = request.data.get('country_code') or auto_code
        if not country_code:
            return Response({'error': 'Country code required. Pass country_code in body or configure your country in Settings.'}, status=400)

        result = TaxTemplateService.apply_country_template(org, country_code)

        if result.get('errors'):
            return Response({'success': False, 'errors': result['errors']}, status=404)

        return Response({
            'success': True,
            'template_name': result['template_name'],
            'country_code': result['country_code'],
            'policies_created': result['policies_created'],
            'profiles_created': result['profiles_created'],
            'rules_created': result['rules_created'],
            'tax_groups_created': result['tax_groups_created'],
            'message': (
                f"Template '{result['template_name']}' applied: "
                f"{len(result['policies_created'])} policies, "
                f"{len(result['profiles_created'])} profiles, "
                f"{len(result['tax_groups_created'])} tax groups created."
            ),
        })

    @action(detail=False, methods=['get'], url_path='tax-health')
    def tax_health(self, request):
        """
        GET /api/finance/org-tax-policies/tax-health/
        Returns a tax configuration health check for the current tenant.

        Used by: Tax Health Dashboard in /finance/tax-policy.
        """
        from apps.finance.services.tax_template_service import TaxTemplateService
        from erp.models import Organization

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        org = Organization.objects.select_related('base_country').get(id=org_id)
        health = TaxTemplateService.get_tax_health(org)
        return Response(health)



# ══════════════════════════════════════════════════════════════════
# CounterpartyTaxProfile ViewSet
# ══════════════════════════════════════════════════════════════════

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
        """Create the 5 standard system presets for this organization if missing."""
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
            'created': created, 'total_presets': len(presets),
            'message': f'{len(created)} preset(s) created, {len(presets) - len(created)} already existed.'
        })

    @action(detail=False, methods=['get'], url_path='available-templates')
    def available_templates(self, request):
        """Returns counterparty profile presets from the org's country template."""
        org, country_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)
        if not country_code:
            return Response({'country_code': None, 'country_name': None, 'presets': [],
                             'message': 'No country configured.'})

        template = _get_template(country_code)
        if not template:
            return Response({'country_code': country_code, 'country_name': org.country or country_code,
                             'presets': [], 'message': f'No tax template for {country_code}.'})

        existing_names = set(
            CounterpartyTaxProfile.objects.filter(organization=org).values_list('name', flat=True)
        )
        presets = template.counterparty_presets or []
        enriched = [{**p, 'already_imported': p.get('name', '') in existing_names} for p in presets]

        return Response({
            'country_code': template.country_code, 'country_name': template.country_name,
            'currency_code': template.currency_code, 'presets': enriched,
            'total': len(presets), 'imported': sum(1 for p in enriched if p['already_imported']),
        })

    @action(detail=False, methods=['post'], url_path='import-from-template')
    def import_from_template(self, request):
        """Import counterparty profile presets from country template."""
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
        presets = template.counterparty_presets or []
        if preset_names:
            presets = [p for p in presets if p.get('name') in preset_names]

        existing_names = set(
            CounterpartyTaxProfile.objects.filter(organization=org).values_list('name', flat=True)
        )

        FIELD_MAP = {
            'name': 'name', 'vat_registered': 'vat_registered',
            'reverse_charge': 'reverse_charge', 'allowed_scopes': 'allowed_scopes',
        }

        created, skipped = [], []
        for preset in presets:
            pname = preset.get('name', 'Unnamed Profile')
            if pname in existing_names:
                skipped.append(pname); continue

            kwargs = {
                'organization': org, 'country_code': template.country_code,
                'required_documents': preset.get('required_documents', []),
            }
            for src_key, dst_field in FIELD_MAP.items():
                if src_key in preset:
                    kwargs[dst_field] = preset[src_key]

            CounterpartyTaxProfile.objects.create(**kwargs)
            created.append(pname)

        return Response({'created': created, 'skipped': skipped,
                         'message': f'{len(created)} profiles imported, {len(skipped)} already existed.'})


# ══════════════════════════════════════════════════════════════════
# CustomTaxRule ViewSet
# ══════════════════════════════════════════════════════════════════

class CustomTaxRuleViewSet(TenantModelViewSet):
    queryset = CustomTaxRule.objects.all()
    serializer_class = CustomTaxRuleSerializer

    @action(detail=False, methods=['get'], url_path='available-templates')
    def available_templates(self, request):
        """Returns custom tax rule presets from the org's country template."""
        org, country_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)
        if not country_code:
            return Response({'country_code': None, 'country_name': None, 'presets': [],
                             'message': 'No country configured.'})

        template = _get_template(country_code)
        if not template:
            return Response({'country_code': country_code, 'country_name': org.country or country_code,
                             'presets': [], 'message': f'No tax template for {country_code}.'})

        existing_names = set(
            CustomTaxRule.objects.filter(organization=org).values_list('name', flat=True)
        )
        presets = template.custom_tax_rule_presets or []
        enriched = [{**p, 'already_imported': p.get('name', '') in existing_names} for p in presets]

        return Response({
            'country_code': template.country_code, 'country_name': template.country_name,
            'currency_code': template.currency_code, 'presets': enriched,
            'total': len(presets), 'imported': sum(1 for p in enriched if p['already_imported']),
        })

    @action(detail=False, methods=['post'], url_path='import-from-template')
    def import_from_template(self, request):
        """Import custom tax rule presets from country template."""
        from decimal import Decimal

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
        presets = template.custom_tax_rule_presets or []
        if preset_names:
            presets = [p for p in presets if p.get('name') in preset_names]

        existing_names = set(
            CustomTaxRule.objects.filter(organization=org).values_list('name', flat=True)
        )

        FIELD_MAP = {
            'name': 'name', 'rate': 'rate',
            'transaction_type': 'transaction_type', 'math_behavior': 'math_behavior',
            'purchase_cost_treatment': 'purchase_cost_treatment',
            'tax_base_mode': 'tax_base_mode', 'base_tax_type': 'base_tax_type',
            'calculation_order': 'calculation_order', 'compound_group': 'compound_group',
            'is_active': 'is_active',
        }

        created, skipped = [], []
        for preset in presets:
            pname = preset.get('name', 'Unnamed Rule')
            if pname in existing_names:
                skipped.append(pname); continue

            kwargs = {'organization': org}
            for src_key, dst_field in FIELD_MAP.items():
                if src_key in preset:
                    val = preset[src_key]
                    if dst_field == 'rate':
                        val = Decimal(str(val))
                    kwargs[dst_field] = val

            CustomTaxRule.objects.create(**kwargs)
            created.append(pname)

        return Response({'created': created, 'skipped': skipped,
                         'message': f'{len(created)} rules imported, {len(skipped)} already existed.'})


# ══════════════════════════════════════════════════════════════════
# TaxJurisdictionRule ViewSet
# ══════════════════════════════════════════════════════════════════

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
        """Preview jurisdiction resolution for given parameters."""
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

        for k, v in result.items():
            if hasattr(v, 'quantize'):
                result[k] = str(v)

        return Response(result)


# ══════════════════════════════════════════════════════════════════
# Country Tax Templates (SaaS-level, global)
# ══════════════════════════════════════════════════════════════════

from apps.finance.models.country_tax_template import CountryTaxTemplate
from rest_framework import serializers as drf_serializers


class CountryTaxTemplateSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = CountryTaxTemplate
        fields = '__all__'


class CountryTaxTemplateViewSet(TenantModelViewSet):
    """Country Tax Templates — global SaaS resource."""
    queryset = CountryTaxTemplate.objects.filter(is_active=True)
    serializer_class = CountryTaxTemplateSerializer

    def get_queryset(self):
        """Templates are global — no tenant filtering."""
        qs = CountryTaxTemplate.objects.filter(is_active=True)
        country = self.request.query_params.get('country_code')
        if country:
            qs = qs.filter(country_code=country.upper())
        return qs

    @action(detail=False, methods=['get'], url_path='by-country/(?P<country_code>[A-Z]{2,3})')
    def by_country(self, request, country_code=None):
        """GET /country-tax-templates/by-country/CI/ → returns template defaults."""
        try:
            tpl = CountryTaxTemplate.objects.get(country_code=country_code.upper(), is_active=True)
            return Response(CountryTaxTemplateSerializer(tpl).data)
        except CountryTaxTemplate.DoesNotExist:
            return Response({'detail': f'No template for country {country_code}'}, status=404)


# ══════════════════════════════════════════════════════════════════
# E-Invoice Standards (SaaS-level, global)
# ══════════════════════════════════════════════════════════════════

from apps.finance.models.einvoice_standard import EInvoiceStandard


class EInvoiceStandardSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = EInvoiceStandard
        fields = '__all__'


class EInvoiceStandardViewSet(TenantModelViewSet):
    """E-Invoice Standards — global SaaS resource."""
    queryset = EInvoiceStandard.objects.filter(is_active=True)
    serializer_class = EInvoiceStandardSerializer

    def get_queryset(self):
        """Standards are global — no tenant filtering."""
        qs = EInvoiceStandard.objects.filter(is_active=True)
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region__icontains=region)
        code = self.request.query_params.get('code')
        if code:
            qs = qs.filter(code=code.upper())
        return qs

    @action(detail=False, methods=['get'], url_path='by-code/(?P<code>[A-Z0-9_]+)')
    def by_code(self, request, code=None):
        """GET /e-invoice-standards/by-code/ZATCA/ → returns standard details."""
        try:
            std = EInvoiceStandard.objects.get(code=code.upper(), is_active=True)
            return Response(EInvoiceStandardSerializer(std).data)
        except EInvoiceStandard.DoesNotExist:
            return Response({'detail': f'No standard with code {code}'}, status=404)

    @action(detail=False, methods=['get'], url_path='resolve-for-tenant')
    def resolve_for_tenant(self, request):
        """
        GET /e-invoice-standards/resolve-for-tenant/
        Resolves the current tenant's e-invoice standard from their country template.
        Returns the full standard definition + enforcement level + saved credentials.

        Flow: Org → country_code → CountryTaxTemplate → e_invoice_standard FK → EInvoiceStandard
        """
        from erp.models import Organization

        org, country_code = _get_org_and_country()
        if not org:
            return Response({'error': 'Tenant context missing'}, status=400)

        if not country_code:
            return Response({
                'resolved': False,
                'standard': None,
                'enforcement': 'NONE',
                'country_code': None,
                'country_name': None,
                'saved_credentials': {},
                'saved_branding': {},
                'message': 'No country configured. Set your country in Settings → Regional.',
            })

        template = _get_template(country_code)
        if not template:
            return Response({
                'resolved': False,
                'standard': None,
                'enforcement': 'NONE',
                'country_code': country_code,
                'country_name': org.country or country_code,
                'saved_credentials': {},
                'saved_branding': {},
                'message': f'No tax template for country {country_code}.',
            })

        if not template.e_invoice_standard:
            return Response({
                'resolved': False,
                'standard': None,
                'enforcement': getattr(template, 'einvoice_enforcement', 'NONE'),
                'country_code': country_code,
                'country_name': template.country_name,
                'saved_credentials': {},
                'saved_branding': {},
                'message': f'No e-invoicing standard assigned to {template.country_name}.',
            })

        std = template.e_invoice_standard
        # Get saved values from org settings
        org_settings = org.settings or {}
        einvoice_settings = org_settings.get('einvoice', {})

        return Response({
            'resolved': True,
            'standard': EInvoiceStandardSerializer(std).data,
            'enforcement': getattr(template, 'einvoice_enforcement', 'OPTIONAL'),
            'country_code': country_code,
            'country_name': template.country_name,
            'saved_credentials': einvoice_settings.get('credentials', {}),
            'saved_branding': einvoice_settings.get('branding', {}),
            'is_active': einvoice_settings.get('is_active', False),
            'message': None,
        })


# ══════════════════════════════════════════════════════════════════
# FNE E-Invoicing Certification Endpoints
# ══════════════════════════════════════════════════════════════════

from rest_framework.views import APIView


class FNECertifyView(APIView):
    """
    POST /api/finance/fne/certify/
    Certifies an invoice with the CI FNE platform.

    Body: {
        "invoice_type": "sale" | "creditNote" | "purchase",
        "payment_method": "cash" | "cheque" | "transfer" | "mobile-money" | "credit-card",
        "template": "B2C" | "B2B" | "B2G" | "B2F",
        "client_ncc": "9502363N",
        "client_company_name": "Company Name",
        "client_phone": "0709080765",
        "client_email": "email@example.com",
        "items": [
            {
                "description": "Product name",
                "quantity": 30,
                "amount": 20000,
                "taxes": ["TVA"],
                "reference": "REF001",
                "discount": 0,
                "measurementUnit": "pcs",
                "customTaxes": [{"name": "AIRSI", "amount": 2}]
            }
        ],
        "discount": 0,
        "parent_reference": "",
        "foreign_currency": "",
        "foreign_currency_rate": 0
    }
    """
    def post(self, request):
        from apps.finance.services.fne_service import (
            FNEService, FNEConfig, FNEInvoiceRequest,
            FNELineItem, FNECustomTax, get_fne_config
        )
        from erp.models import Organization

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        org = Organization.objects.get(id=org_id)
        config = get_fne_config(org)
        if not config:
            return Response({
                'error': 'FNE not configured. Go to Settings → E-Invoicing to set your API key.',
                'setup_required': True,
            }, status=400)

        data = request.data

        # Build line items
        items = []
        for item_data in data.get('items', []):
            custom_taxes = []
            for ct in item_data.get('customTaxes', []):
                custom_taxes.append(FNECustomTax(name=ct['name'], amount=ct['amount']))

            items.append(FNELineItem(
                description=item_data.get('description', ''),
                quantity=item_data.get('quantity', 1),
                amount=item_data.get('amount', 0),
                taxes=item_data.get('taxes', ['TVA']),
                reference=item_data.get('reference', ''),
                discount=item_data.get('discount', 0),
                measurement_unit=item_data.get('measurementUnit', ''),
                custom_taxes=custom_taxes,
            ))

        # Global custom taxes
        global_custom_taxes = []
        for ct in data.get('customTaxes', []):
            global_custom_taxes.append(FNECustomTax(name=ct['name'], amount=ct['amount']))

        # Build request
        fne_request = FNEInvoiceRequest(
            invoice_type=data.get('invoice_type', 'sale'),
            payment_method=data.get('payment_method', 'cash'),
            template=data.get('template', 'B2C'),
            items=items,
            client_ncc=data.get('client_ncc', ''),
            client_company_name=data.get('client_company_name', ''),
            client_phone=data.get('client_phone', ''),
            client_email=data.get('client_email', ''),
            client_seller_name=data.get('client_seller_name', ''),
            point_of_sale=data.get('point_of_sale', ''),
            establishment=data.get('establishment', ''),
            commercial_message=data.get('commercial_message', ''),
            footer=data.get('footer', ''),
            discount=data.get('discount', 0),
            parent_reference=data.get('parent_reference', ''),
            is_rne=data.get('is_rne', False),
            rne=data.get('rne', ''),
            foreign_currency=data.get('foreign_currency', ''),
            foreign_currency_rate=data.get('foreign_currency_rate', 0),
            custom_taxes=global_custom_taxes,
        )

        # Certify
        service = FNEService(config)
        result = service.sign_invoice(fne_request)

        if result.success:
            return Response({
                'success': True,
                'reference': result.reference,
                'ncc': result.ncc,
                'token': result.token,
                'qr_url': result.token,  # Same as token — URL for QR code
                'warning': result.warning,
                'balance_sticker': result.balance_sticker,
                'invoice_id': result.invoice_id,
                'invoice': result.invoice_data,
            })
        else:
            return Response({
                'success': False,
                'error': result.error_message,
                'raw': result.raw_response,
            }, status=502)


class FNETestConnectionView(APIView):
    """
    POST /api/finance/fne/test-connection/
    Tests the FNE API connection with a minimal request.

    Body: { "api_key": "...", "base_url": "..." }
    """
    def post(self, request):
        import requests as http_requests

        api_key = request.data.get('api_key', '')
        base_url = request.data.get('base_url', 'http://54.247.95.108/ws')

        if not api_key:
            return Response({'error': 'API key required'}, status=400)

        try:
            url = f"{base_url.rstrip('/')}/external/invoices/sign"
            resp = http_requests.post(
                url,
                json={},  # Empty body → should return 400, proving connection works
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}',
                },
                timeout=10,
            )

            if resp.status_code == 401:
                return Response({
                    'connected': True,
                    'authenticated': False,
                    'message': 'Connected to FNE but API key is invalid or expired.',
                })
            elif resp.status_code == 400:
                return Response({
                    'connected': True,
                    'authenticated': True,
                    'message': 'Successfully connected and authenticated with FNE.',
                })
            elif resp.status_code == 200:
                return Response({
                    'connected': True,
                    'authenticated': True,
                    'message': 'Successfully connected and authenticated with FNE.',
                })
            else:
                return Response({
                    'connected': True,
                    'authenticated': False,
                    'message': f'Unexpected response: {resp.status_code}',
                })

        except http_requests.exceptions.ConnectionError:
            return Response({
                'connected': False,
                'authenticated': False,
                'message': 'Cannot connect to FNE server. Check the URL and internet connection.',
            })
        except Exception as e:
            return Response({
                'connected': False,
                'authenticated': False,
                'message': f'Connection test failed: {str(e)}',
            })


# ══════════════════════════════════════════════════════════════════
# TaxRateCategory ViewSet
# ══════════════════════════════════════════════════════════════════

class TaxRateCategoryViewSet(TenantModelViewSet):
    """
    CRUD for per-product VAT rate categories.

    GET  /api/finance/tax-rate-categories/                 → list
    POST /api/finance/tax-rate-categories/                 → create
    GET  /api/finance/tax-rate-categories/{id}/            → retrieve
    PUT  /api/finance/tax-rate-categories/{id}/            → update
    DEL  /api/finance/tax-rate-categories/{id}/            → delete
    POST /api/finance/tax-rate-categories/seed-from-template/ → seed from CountryTaxTemplate
    """
    from apps.finance.models.tax_engine_ext import TaxRateCategory as _TaxRateCategory
    queryset = _TaxRateCategory.objects.all()
    filterset_fields = ['is_active', 'is_default', 'country_code']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'rate', 'is_default']
    ordering = ['-is_default', 'name']

    def get_serializer_class(self):
        # Inline serializer — simple enough to not need a dedicated file
        from rest_framework import serializers
        from apps.finance.models.tax_engine_ext import TaxRateCategory

        class TaxRateCategorySerializer(serializers.ModelSerializer):
            products_count = serializers.SerializerMethodField()

            class Meta:
                model = TaxRateCategory
                fields = [
                    'id', 'name', 'rate', 'country_code',
                    'is_default', 'description', 'is_active',
                    'created_at', 'updated_at', 'products_count',
                ]
                read_only_fields = ['id', 'created_at', 'updated_at', 'products_count']

            def get_products_count(self, obj):
                return obj.products.count() if hasattr(obj, 'products') else 0

        return TaxRateCategorySerializer

    @action(detail=False, methods=['post'], url_path='seed-from-template')
    def seed_from_template(self, request):
        """
        POST /api/finance/tax-rate-categories/seed-from-template/
        Body: {"country_code": "CI"}  — optional, auto-resolved from org if omitted

        Seeds TaxRateCategory records from the CountryTaxTemplate's tax_group_presets
        for the current tenant. Idempotent — skips categories that already exist.
        """
        from apps.finance.models import CountryTaxTemplate
        from apps.finance.models.tax_engine_ext import TaxRateCategory
        from erp.models import Organization

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'Tenant context missing'}, status=400)

        org = Organization.objects.filter(id=org_id).first()
        country_code = request.data.get('country_code') or _resolve_org_country_code(org)
        if not country_code:
            return Response({'error': 'Country code required'}, status=400)

        template = CountryTaxTemplate.objects.filter(
            country_code__iexact=country_code, is_active=True
        ).first()
        if not template:
            return Response({'error': f'No template found for country: {country_code}'}, status=404)

        created = []
        skipped = []

        for preset in template.tax_group_presets or []:
            name = preset.get('name', '')
            rate_pct = preset.get('rate', 0)
            # tax_group_presets rates are stored as percentages (e.g. 18 = 18%)
            # TaxRateCategory.rate is a decimal fraction (e.g. 0.18 = 18%)
            rate_fraction = round(float(rate_pct) / 100, 6)

            obj, is_new = TaxRateCategory.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'rate': rate_fraction,
                    'country_code': country_code.upper(),
                    'description': preset.get('description', ''),
                    'is_default': preset.get('is_default', False),
                    'is_active': True,
                }
            )
            (created if is_new else skipped).append({'id': obj.id, 'name': name, 'rate': str(rate_fraction)})

        return Response({
            'country_code': country_code.upper(),
            'created': created,
            'skipped': skipped,
            'message': f'{len(created)} rate categories created, {len(skipped)} already existed.',
        })
