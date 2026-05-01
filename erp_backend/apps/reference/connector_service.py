"""
Reference Connector Service
============================
Declares all capabilities that the Reference module exposes.

Other modules call:
    connector.require('reference.country.get_model', org_id=X)
    connector.require('reference.org_country.get_model', org_id=X)
    connector.require('reference.org_currency.get_model', org_id=X)

Auto-discovered by the CapabilityRegistry.
"""

import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by CapabilityRegistry during auto-discovery."""

    @_cap(registry, 'reference.country.get_model',
          description='Get Country model class (ISO 3166)',
          cacheable=False, critical=False)
    def get_country_model(org_id=0, **kw):
        from apps.reference.models import Country
        return Country

    @_cap(registry, 'reference.org_country.get_model',
          description='Get OrgCountry model class (per-tenant country settings)',
          cacheable=False, critical=False)
    def get_org_country_model(org_id=0, **kw):
        from apps.reference.models import OrgCountry
        return OrgCountry

    @_cap(registry, 'reference.org_currency.get_model',
          description='Get OrgCurrency model class (per-tenant currency settings)',
          cacheable=False, critical=False)
    def get_org_currency_model(org_id=0, **kw):
        from apps.reference.models import OrgCurrency
        return OrgCurrency


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
