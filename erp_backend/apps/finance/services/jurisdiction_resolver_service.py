"""
JurisdictionResolverService
============================
Resolves the effective tax jurisdiction and rate for a transaction
based on origin, destination, counterparty profile, and configured rules.

This is the data-driven replacement for hardcoded country-specific logic.
It reads from TaxJurisdictionRule model to determine:
  - Effective VAT/sales tax rate
  - Whether reverse charge applies
  - Whether export zero-rating applies
  - The resolved jurisdiction code (e.g. "CI", "US-CA", "EU-DE")
"""
import logging
from decimal import Decimal
from datetime import date

logger = logging.getLogger(__name__)


class JurisdictionResolverService:
    """
    Stateless service that resolves tax jurisdiction for a transaction.

    Usage:
        result = JurisdictionResolverService.resolve(
            organization=org,
            origin_country='CI',
            destination_country='FR',
            destination_region=None,
            counterparty_country='FR',
            is_export=True,
            is_b2b=True,
        )
        # result = {
        #     'jurisdiction_code': 'FR',
        #     'effective_rate': Decimal('0'),
        #     'place_of_supply': 'DESTINATION',
        #     'is_reverse_charge': True,
        #     'is_zero_rated': True,
        #     'rule_id': 42,
        #     'rule_name': 'EU Intra-Community B2B',
        # }
    """

    @classmethod
    def resolve(
        cls,
        organization,
        origin_country: str = '',
        destination_country: str = '',
        destination_region: str = '',
        counterparty_country: str = '',
        is_export: bool = False,
        is_b2b: bool = False,
        tax_type: str = 'VAT',
        transaction_date: date = None,
    ) -> dict:
        """
        Resolve the effective tax jurisdiction and rate.

        Priority logic:
        1. If destination_country == origin_country → domestic (use origin rules)
        2. If is_export=True → check zero_rate_export on destination rule
        3. If is_b2b=True → check reverse_charge_allowed on destination rule
        4. If sub-national (region provided) → look up regional rate
        5. Fall back to origin country default rate

        Returns dict with:
            jurisdiction_code, effective_rate, place_of_supply,
            is_reverse_charge, is_zero_rated, rule_id, rule_name
        """
        from apps.finance.models.tax_jurisdiction_rule import TaxJurisdictionRule

        if not transaction_date:
            transaction_date = date.today()

        origin = origin_country.upper().strip() if origin_country else ''
        dest = destination_country.upper().strip() if destination_country else origin
        region = destination_region.strip() if destination_region else ''
        cp_country = counterparty_country.upper().strip() if counterparty_country else ''

        # Default result (fallback: domestic, no special behavior)
        result = {
            'jurisdiction_code': origin or 'UNKNOWN',
            'effective_rate': None,  # None = use org default rate
            'place_of_supply': 'ORIGIN',
            'is_reverse_charge': False,
            'is_zero_rated': False,
            'rule_id': None,
            'rule_name': None,
        }

        # ── 1. Purely domestic (no destination or same country) ────────
        if not dest or dest == origin:
            # Check for sub-national rules (e.g. US state tax)
            if region:
                rule = cls._find_best_rule(
                    organization, dest, region, tax_type, transaction_date
                )
                if rule:
                    result.update({
                        'jurisdiction_code': f"{dest}-{region}",
                        'effective_rate': rule.rate,
                        'place_of_supply': rule.place_of_supply_mode,
                        'rule_id': rule.id,
                        'rule_name': rule.name,
                    })
            return result

        # ── 2. Cross-border: destination differs from origin ──────────
        result['jurisdiction_code'] = f"{dest}-{region}" if region else dest

        # Look up destination country rule
        dest_rule = cls._find_best_rule(
            organization, dest, region, tax_type, transaction_date
        )

        if dest_rule:
            result['rule_id'] = dest_rule.id
            result['rule_name'] = dest_rule.name

            # Export zero-rating
            if is_export and dest_rule.zero_rate_export:
                result.update({
                    'effective_rate': Decimal('0'),
                    'is_zero_rated': True,
                    'place_of_supply': 'DESTINATION',
                })
                return result

            # B2B reverse charge
            if is_b2b and dest_rule.reverse_charge_allowed:
                result.update({
                    'effective_rate': Decimal('0'),
                    'is_reverse_charge': True,
                    'place_of_supply': 'REVERSE_CHARGE',
                })
                return result

            # Destination-based taxation (e.g. US nexus, EU post-threshold)
            if dest_rule.place_of_supply_mode == 'DESTINATION':
                result.update({
                    'effective_rate': dest_rule.rate,
                    'place_of_supply': 'DESTINATION',
                })
                return result

        # ── 3. Fallback: use origin rules ─────────────────────────────
        origin_rule = cls._find_best_rule(
            organization, origin, '', tax_type, transaction_date
        )
        if origin_rule:
            result.update({
                'effective_rate': origin_rule.rate,
                'place_of_supply': 'ORIGIN',
                'rule_id': origin_rule.id,
                'rule_name': origin_rule.name,
            })

        return result

    @classmethod
    def _find_best_rule(cls, organization, country_code: str, region_code: str,
                        tax_type: str, ref_date: date):
        """
        Find the highest-priority active rule matching the jurisdiction.
        Checks org-specific rules first, then system presets.
        Respects effective_from / effective_to date ranges.
        """
        from apps.finance.models.tax_jurisdiction_rule import TaxJurisdictionRule
        from django.db.models import Q

        if not country_code:
            return None

        base_q = Q(
            country_code=country_code,
            tax_type=tax_type,
            is_active=True,
        )

        # Region filter: exact match or null (country-wide)
        if region_code:
            base_q &= Q(region_code=region_code) | Q(region_code__isnull=True) | Q(region_code='')
        else:
            base_q &= Q(region_code__isnull=True) | Q(region_code='')

        # Date range filter
        date_q = (
            (Q(effective_from__isnull=True) | Q(effective_from__lte=ref_date)) &
            (Q(effective_to__isnull=True) | Q(effective_to__gte=ref_date))
        )

        # Org-specific first, then system presets
        org_q = Q(organization=organization)
        preset_q = Q(is_system_preset=True) & (Q(organization__isnull=True) | Q(organization=organization))

        # Try org-specific rules first
        rule = (
            TaxJurisdictionRule.objects
            .filter(base_q & date_q & org_q)
            .order_by('-priority', '-id')
            .first()
        )
        if rule:
            return rule

        # Fall back to system presets
        rule = (
            TaxJurisdictionRule.objects
            .filter(base_q & date_q & preset_q)
            .order_by('-priority', '-id')
            .first()
        )
        return rule

    @classmethod
    def get_available_jurisdictions(cls, organization) -> list:
        """
        List all active jurisdiction rules for an organization.
        Useful for UI dropdowns and previews.
        """
        from apps.finance.models.tax_jurisdiction_rule import TaxJurisdictionRule
        from django.db.models import Q

        rules = TaxJurisdictionRule.objects.filter(
            Q(organization=organization) | Q(is_system_preset=True),
            is_active=True,
        ).values(
            'id', 'name', 'country_code', 'region_code', 'tax_type',
            'rate', 'place_of_supply_mode', 'reverse_charge_allowed',
            'zero_rate_export', 'priority'
        ).order_by('country_code', 'region_code')

        return list(rules)
