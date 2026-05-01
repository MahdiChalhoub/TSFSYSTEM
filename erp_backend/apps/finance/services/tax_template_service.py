"""
Tax Template Service
=====================
Centralizes the logic for applying SaaS-level CountryTaxTemplates to tenant orgs.

Used by:
  - Management commands (seed_org_tax_policy, seed_country_tax_templates)
  - ViewSet actions (POST /org-tax-policies/apply-country-template/)
  - Setup Wizard (post-COA-template step)
"""
import logging
from decimal import Decimal
from django.db import transaction

logger = logging.getLogger(__name__)


class TaxTemplateService:
    """
    Applies a CountryTaxTemplate to an organization (idempotent).

    Entry point:
        TaxTemplateService.apply_country_template(org, country_code)

    This will:
      1. Lookup the active CountryTaxTemplate for the country_code
      2. Create OrgTaxPolicy presets from org_policy_defaults (skip existing by name)
      3. Create CounterpartyTaxProfile presets from counterparty_presets
      4. Create CustomTaxRule presets from custom_tax_rule_presets
      5. Seed TaxGroup entries from tax_group_presets
      6. Auto-link GL accounts to the default OrgTaxPolicy
    """

    # ── Public API ───────────────────────────────────────────────────────

    @classmethod
    def apply_country_template(cls, org, country_code: str) -> dict:
        """
        Idempotent: safe to call multiple times. Returns a summary dict.

        Args:
            org: Organization instance
            country_code: ISO 3166-1 alpha-2 code (e.g. 'CI', 'FR', 'US')

        Returns:
            dict with keys: template_name, policies_created, profiles_created,
                            rules_created, tax_groups_created, errors (list)
        """
        from apps.finance.models.country_tax_template import CountryTaxTemplate

        country_code = country_code.strip().upper()
        result = {
            'template_name': None,
            'country_code': country_code,
            'policies_created': [],
            'profiles_created': [],
            'rules_created': [],
            'tax_groups_created': [],
            'errors': [],
        }

        try:
            template = CountryTaxTemplate.objects.get(
                country_code=country_code, is_active=True
            )
        except CountryTaxTemplate.DoesNotExist:
            result['errors'].append(
                f"No active CountryTaxTemplate for '{country_code}'. "
                "Run: python manage.py seed_country_tax_templates"
            )
            return result

        result['template_name'] = template.country_name

        with transaction.atomic():
            result['policies_created'] = cls._seed_policies(org, template)
            result['profiles_created'] = cls._seed_profiles(org, template)
            result['rules_created'] = cls._seed_custom_rules(org, template)
            result['tax_groups_created'] = cls._seed_tax_groups(org, template)
            cls._auto_link_accounts(org)

        logger.info(
            "[TaxTemplateService] Applied template '%s' to org %s: "
            "%d policies, %d profiles, %d rules, %d tax groups",
            country_code, org.id,
            len(result['policies_created']), len(result['profiles_created']),
            len(result['rules_created']), len(result['tax_groups_created'])
        )
        return result

    @classmethod
    def get_tax_health(cls, org) -> dict:
        """
        Returns a health status dict for the tenant's tax engine configuration.
        Used by the Tax Health Dashboard in the frontend.
        """
        from apps.finance.models import OrgTaxPolicy, CounterpartyTaxProfile, CustomTaxRule
        from apps.finance.models.country_tax_template import CountryTaxTemplate

        # 1. Policy
        policy = OrgTaxPolicy.objects.filter(
            organization=org, is_default=True
        ).first()
        has_policy = policy is not None

        # 2. GL accounts linked
        gl_linked = False
        if policy:
            gl_linked = any([
                getattr(policy, 'vat_collected_account_id', None),
                getattr(policy, 'vat_recoverable_account_id', None),
            ])

        # 3. Counterparty profiles
        profiles_count = CounterpartyTaxProfile.objects.filter(organization=org).count()

        # 4. Tax groups (TaxGroup)
        tax_groups_count = 0
        try:
            from apps.finance.models import TaxGroup
            tax_groups_count = TaxGroup.objects.filter(organization=org).count()
        except Exception:
            pass

        # 5. Country template available
        country_code = cls._resolve_country_code(org)
        template_available = False
        if country_code:
            template_available = CountryTaxTemplate.objects.filter(
                country_code=country_code.upper(), is_active=True
            ).exists()

        # 6. E-invoice status
        einvoice_configured = False
        einvoice_enforcement = 'NONE'
        try:
            from apps.finance.models.country_tax_template import CountryTaxTemplate as CTT
            tpl = CTT.objects.filter(
                country_code=(country_code or '').upper(), is_active=True
            ).first()
            if tpl:
                einvoice_enforcement = getattr(tpl, 'einvoice_enforcement', 'NONE') or 'NONE'
                org_settings = getattr(org, 'settings', {}) or {}
                einvoice_settings = org_settings.get('einvoice', {})
                einvoice_configured = bool(einvoice_settings.get('is_active'))
        except Exception:
            pass

        indicators = [
            {
                'key': 'policy_configured',
                'status': 'ok' if has_policy else 'error',
                'label': 'Tax Policy',
                'description': f"Default policy: {policy.name}" if policy else 'No default OrgTaxPolicy configured',
            },
            {
                'key': 'gl_accounts_linked',
                'status': 'ok' if gl_linked else 'warning',
                'label': 'GL Accounts Linked',
                'description': 'VAT accounts are linked to policy' if gl_linked else 'VAT accounts not linked — auto-link available',
            },
            {
                'key': 'counterparty_profiles',
                'status': 'ok' if profiles_count >= 2 else 'warning',
                'label': 'Counterparty Profiles',
                'description': f'{profiles_count} profile(s) configured' if profiles_count else 'No counterparty profiles — import from template',
            },
            {
                'key': 'tax_groups',
                'status': 'ok' if tax_groups_count >= 1 else 'warning',
                'label': 'Tax Groups (VAT Rates)',
                'description': f'{tax_groups_count} rate group(s) seeded' if tax_groups_count else 'No tax rate groups — import from template',
            },
            {
                'key': 'country_template',
                'status': 'ok' if template_available else 'info',
                'label': 'Country Template',
                'description': f"Template available for {country_code}" if template_available else f'No template for country {country_code or "(not set)"}',
            },
            {
                'key': 'einvoice',
                'status': (
                    'ok' if einvoice_configured
                    else ('error' if einvoice_enforcement == 'MANDATORY' else 'warning' if einvoice_enforcement in ('RECOMMENDED', 'OPTIONAL') else 'info')
                ),
                'label': 'E-Invoicing',
                'description': (
                    'E-invoicing is active' if einvoice_configured
                    else f'E-invoicing {einvoice_enforcement.lower()} for {country_code or "this country"} — not yet configured'
                ),
            },
        ]

        overall_ok = all(i['status'] == 'ok' for i in indicators if i['status'] != 'info')
        return {
            'overall_ok': overall_ok,
            'country_code': country_code,
            'indicators': indicators,
        }

    # ── Internal helpers ─────────────────────────────────────────────────

    @classmethod
    def _resolve_country_code(cls, org) -> str | None:
        """Resolve the org's country code using the same chain as tax_policy_views.py."""
        try:
            from erp.connector_registry import connector
            OrgCountry = connector.require('reference.org_country.get_model', org_id=org.id)
            if OrgCountry is not None:
                oc = OrgCountry.all_objects.filter(
                    organization=org, is_default=True, is_enabled=True
                ).select_related('country').first()
                if oc and oc.country:
                    return oc.country.iso2.upper()
        except Exception:
            pass

        if hasattr(org, 'base_country') and org.base_country:
            iso2 = getattr(org.base_country, 'iso2', None)
            if iso2:
                return iso2.upper()

        if org.country:
            raw = org.country.strip()
            if len(raw) <= 3 and raw.isalpha():
                return raw.upper()

        settings = getattr(org, 'settings', {}) or {}
        return (settings.get('countryCode') or settings.get('country_code', '')).upper() or None

    @classmethod
    def _seed_policies(cls, org, template) -> list:
        from apps.finance.models import OrgTaxPolicy
        existing = set(OrgTaxPolicy.objects.filter(organization=org).values_list('name', flat=True))
        presets = template.org_policy_defaults or []
        created = []
        DECIMAL_FIELDS = ('vat_input_recoverability', 'purchase_tax_rate', 'sales_tax_rate', 'periodic_amount')
        FIELD_MAP = {
            'name', 'vat_output_enabled', 'vat_input_recoverability',
            'airsi_treatment', 'purchase_tax_rate', 'purchase_tax_mode',
            'sales_tax_rate', 'sales_tax_trigger', 'periodic_amount',
            'periodic_interval', 'profit_tax_mode', 'internal_cost_mode',
        }
        for preset in presets:
            name = preset.get('name', 'Policy')
            if name in existing:
                continue
            kwargs = {
                'organization': org,
                'country_code': template.country_code,
                'currency_code': template.currency_code,
            }
            for field in FIELD_MAP:
                if field in preset:
                    val = preset[field]
                    if field in DECIMAL_FIELDS:
                        val = Decimal(str(val))
                    kwargs[field] = val
            if not OrgTaxPolicy.objects.filter(organization=org, is_default=True).exists():
                kwargs['is_default'] = True
            OrgTaxPolicy.objects.create(**kwargs)
            created.append(name)
        return created

    @classmethod
    def _seed_profiles(cls, org, template) -> list:
        from apps.finance.models import CounterpartyTaxProfile
        existing = set(CounterpartyTaxProfile.objects.filter(organization=org).values_list('name', flat=True))
        presets = template.counterparty_presets or []
        created = []
        FIELD_MAP = {'name', 'vat_registered', 'reverse_charge', 'allowed_scopes'}
        for preset in presets:
            name = preset.get('name', 'Profile')
            if name in existing:
                continue
            kwargs = {
                'organization': org,
                'country_code': template.country_code,
                'required_documents': preset.get('required_documents', []),
            }
            for field in FIELD_MAP:
                if field in preset:
                    kwargs[field] = preset[field]
            CounterpartyTaxProfile.objects.create(**kwargs)
            created.append(name)
        return created

    @classmethod
    def _seed_custom_rules(cls, org, template) -> list:
        from apps.finance.models import CustomTaxRule
        existing = set(CustomTaxRule.objects.filter(organization=org).values_list('name', flat=True))
        presets = template.custom_tax_rule_presets or []
        created = []
        FIELD_MAP = {
            'name', 'rate', 'transaction_type', 'math_behavior',
            'purchase_cost_treatment', 'tax_base_mode', 'base_tax_type',
            'calculation_order', 'compound_group', 'is_active',
        }
        for preset in presets:
            name = preset.get('name', 'Rule')
            if name in existing:
                continue
            kwargs = {'organization': org}
            for field in FIELD_MAP:
                if field in preset:
                    val = preset[field]
                    if field == 'rate':
                        val = Decimal(str(val))
                    kwargs[field] = val
            CustomTaxRule.objects.create(**kwargs)
            created.append(name)
        return created

    @classmethod
    def _seed_tax_groups(cls, org, template) -> list:
        """Seed TaxGroup records from template.tax_group_presets."""
        try:
            from apps.finance.models import TaxGroup
        except ImportError:
            return []

        presets = getattr(template, 'tax_group_presets', None) or []
        created = []
        for preset in presets:
            name = preset.get('name', '')
            if not name:
                continue
            rate = Decimal(str(preset.get('rate', '0')))
            is_default = preset.get('is_default', False)
            obj, is_new = TaxGroup.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'rate': rate,
                    'description': preset.get('description', ''),
                }
            )
            if not is_new and obj.rate != rate:
                obj.rate = rate
                obj.save(update_fields=['rate'])
            if is_new:
                created.append(name)
            # Set first default if none exists
            if is_default and not TaxGroup.objects.filter(
                organization=org, is_default=True
            ).exclude(id=obj.id).exists():
                obj.is_default = True
                obj.save(update_fields=['is_default'])
        return created

    @classmethod
    def _auto_link_accounts(cls, org):
        """Auto-fill GL account FKs on the default OrgTaxPolicy via system_role lookups."""
        try:
            from apps.finance.models import OrgTaxPolicy
            policy = OrgTaxPolicy.objects.filter(
                organization=org, is_default=True
            ).first()
            if policy:
                policy.auto_link_accounts()
        except Exception as exc:
            logger.debug("[TaxTemplateService] auto_link_accounts skipped: %s", exc)
