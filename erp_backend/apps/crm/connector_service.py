"""
CRM Connector Service
======================
Declares all capabilities that the CRM module exposes to other modules.

Other modules NEVER import apps.crm.models directly.
They call: connector.require('crm.contacts.get_detail', org_id=X, contact_id=Y)

This file is auto-discovered by the CapabilityRegistry.
"""

import logging
from django.db.models import Q

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """
    Called by the CapabilityRegistry during auto-discovery.
    Registers all CRM capabilities.
    """

    # ─── CONTACTS ────────────────────────────────────────────────────

    @_cap(registry, 'crm.contacts.get_detail',
          description='Get a single contact by ID',
          cacheable=True, cache_ttl=120)
    def get_contact_detail(org_id, contact_id=None, **kw):
        from apps.crm.models import Contact
        if not contact_id:
            return None
        try:
            contact = Contact.objects.get(id=contact_id, organization_id=org_id)
            return {
                'id': contact.id,
                'name': contact.name,
                'email': getattr(contact, 'email', ''),
                'phone': getattr(contact, 'phone', ''),
                'type': getattr(contact, 'type', ''),
                'balance': float(getattr(contact, 'balance', 0) or 0),
                'current_balance': float(getattr(contact, 'current_balance', 0) or 0),
                'tax_id': getattr(contact, 'tax_id', ''),
                'is_active': getattr(contact, 'is_active', True),
            }
        except Exception:
            return None

    @_cap(registry, 'crm.contacts.list',
          description='List contacts for an organization',
          cacheable=True, cache_ttl=60)
    def list_contacts(org_id, contact_type=None, search=None, limit=100, **kw):
        from apps.crm.models import Contact
        qs = Contact.objects.filter(organization_id=org_id)
        if contact_type:
            qs = qs.filter(type=contact_type)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))
        return list(qs.values('id', 'name', 'email', 'phone', 'type', 'is_active')[:limit])

    @_cap(registry, 'crm.contacts.get_suppliers',
          description='List all supplier contacts',
          cacheable=True, cache_ttl=120)
    def get_suppliers(org_id, limit=200, **kw):
        from apps.crm.models import Contact
        return list(
            Contact.objects.filter(
                organization_id=org_id,
                type='SUPPLIER',
                is_active=True,
            ).values('id', 'name', 'email', 'phone', 'balance')[:limit]
        )

    @_cap(registry, 'crm.contacts.get_customers',
          description='List all customer contacts',
          cacheable=True, cache_ttl=120)
    def get_customers(org_id, limit=200, **kw):
        from apps.crm.models import Contact
        return list(
            Contact.objects.filter(
                organization_id=org_id,
                type__in=['CLIENT', 'CUSTOMER'],
                is_active=True,
            ).values('id', 'name', 'email', 'phone', 'balance')[:limit]
        )

    @_cap(registry, 'crm.contacts.get_model',
          description='Get the Contact model class (for ForeignKey resolution)',
          cacheable=False, critical=False)
    def get_contact_model(org_id=0, **kw):
        """Returns the actual Django model class. Use sparingly — prefer data queries."""
        from apps.crm.models import Contact
        return Contact

    # ─── PRICING ─────────────────────────────────────────────────────

    @_cap(registry, 'crm.pricing.get_price_groups',
          description='Get price groups for an organization',
          cacheable=True, cache_ttl=300)
    def get_price_groups(org_id, **kw):
        try:
            from apps.crm.models.pricing_models import PriceGroup
            return list(PriceGroup.objects.filter(
                organization_id=org_id
            ).values('id', 'name', 'discount_percent', 'is_active'))
        except ImportError:
            return []

    @_cap(registry, 'crm.pricing.get_service',
          description='Get PricingService class',
          cacheable=False, critical=False)
    def get_pricing_service(org_id=0, **kw):
        from apps.crm.services.pricing_service import PricingService
        return PricingService
    @_cap(registry, 'crm.pricing.get_client_price_rule_model',
          description='Get ClientPriceRule model class',
          cacheable=False, critical=False)
    def get_client_price_rule_model(org_id=0, **kw):
        from apps.crm.models.pricing_models import ClientPriceRule
        return ClientPriceRule

    @_cap(registry, 'crm.pricing.get_price_group_member_model',
          description='Get PriceGroupMember model class',
          cacheable=False, critical=False)
    def get_price_group_member_model(org_id=0, **kw):
        from apps.crm.models.pricing_models import PriceGroupMember
        return PriceGroupMember

    @_cap(registry, 'crm.pricing.get_price_group_model',
          description='Get PriceGroup model class',
          cacheable=False, critical=False)
    def get_price_group_model(org_id=0, **kw):
        from apps.crm.models.pricing_models import PriceGroup
        return PriceGroup

    # ─── LOYALTY ─────────────────────────────────────────────────────

    @_cap(registry, 'crm.services.get_loyalty_service',
          description='Get LoyaltyService class',
          cacheable=False, critical=False)
    def get_loyalty_service(org_id=0, **kw):
        from apps.crm.services.loyalty_service import LoyaltyService
        return LoyaltyService


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator

