"""
Reference Module Services
===========================
Auto-provisioning and business rule enforcement for org country/currency activation.
"""
import logging
from .models import Country, Currency, OrgCountry, OrgCurrency

logger = logging.getLogger(__name__)


class ReferenceProvisioningService:
    """
    Auto-provision org country/currency during organization setup.

    Called by the Organization provisioning flow to ensure every new org
    has at least one default country and one default currency enabled.
    """

    @staticmethod
    def provision_org_defaults(organization, base_country_iso2=None, base_currency_code=None):
        """
        Auto-provision org defaults:
        1. If base_country_iso2 provided → enable it, mark as default
        2. If base_currency_code provided → enable it, mark as default
        3. If country has a default_currency and no explicit currency → auto-enable it
        4. If nothing provided → skip (org can configure later)

        Returns: dict with 'country' and 'currency' OrgCountry/OrgCurrency objects or None
        """
        result = {'country': None, 'currency': None}

        # ── Step 1: Enable base country ──
        if base_country_iso2:
            try:
                country = Country.objects.get(iso2=base_country_iso2.upper(), is_active=True)
                org_country, _ = OrgCountry.all_objects.get_or_create(
                    organization=organization,
                    country=country,
                    defaults={
                        'is_enabled': True,
                        'is_default': True,
                        'display_order': 0,
                    }
                )
                # Ensure it's default even if it already existed
                if not org_country.is_default:
                    org_country.is_default = True
                    org_country.is_enabled = True
                    org_country.save(update_fields=['is_default', 'is_enabled'])

                result['country'] = org_country
                logger.info(f'[Reference] Provisioned base country {country.iso2} for org {organization.slug}')

                # If no explicit currency and country has default → use it
                if not base_currency_code and country.default_currency:
                    base_currency_code = country.default_currency.code

            except Country.DoesNotExist:
                logger.warning(f'[Reference] Country {base_country_iso2} not found for provisioning')

        # ── Step 2: Enable base currency ──
        if base_currency_code:
            try:
                currency = Currency.objects.get(code=base_currency_code.upper(), is_active=True)
                org_currency, _ = OrgCurrency.all_objects.get_or_create(
                    organization=organization,
                    currency=currency,
                    defaults={
                        'is_enabled': True,
                        'is_default': True,
                        'is_transaction_currency': True,
                        'is_reporting_currency': True,
                        'display_order': 0,
                    }
                )
                # Ensure it's default even if it already existed
                if not org_currency.is_default:
                    org_currency.is_default = True
                    org_currency.is_enabled = True
                    org_currency.save(update_fields=['is_default', 'is_enabled'])

                result['currency'] = org_currency
                logger.info(f'[Reference] Provisioned base currency {currency.code} for org {organization.slug}')

            except Currency.DoesNotExist:
                logger.warning(f'[Reference] Currency {base_currency_code} not found for provisioning')

        return result

    @staticmethod
    def get_org_base_country(organization):
        """Get the org's default country, or None."""
        try:
            return OrgCountry.all_objects.select_related('country').get(
                organization=organization,
                is_default=True,
                is_enabled=True,
            )
        except OrgCountry.DoesNotExist:
            return None

    @staticmethod
    def get_org_base_currency(organization):
        """Get the org's default/base currency, or None."""
        try:
            return OrgCurrency.all_objects.select_related('currency').get(
                organization=organization,
                is_default=True,
                is_enabled=True,
            )
        except OrgCurrency.DoesNotExist:
            return None

    @staticmethod
    def get_org_enabled_currencies(organization):
        """Get all enabled currencies for an org."""
        return OrgCurrency.all_objects.select_related('currency').filter(
            organization=organization,
            is_enabled=True,
        ).order_by('-is_default', 'display_order', 'currency__code')

    @staticmethod
    def get_org_enabled_countries(organization):
        """Get all enabled countries for an org."""
        return OrgCountry.all_objects.select_related('country').filter(
            organization=organization,
            is_enabled=True,
        ).order_by('-is_default', 'display_order', 'country__name')
