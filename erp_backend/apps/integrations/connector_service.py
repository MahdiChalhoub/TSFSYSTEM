"""
Integrations Connector Service
==================================
Exposes integrations capabilities to other modules via the Connector Governance Layer.

Capabilities:
  - integrations.events.get_domain_event_service → DomainEventService class
  - integrations.events.get_service              → DomainEventService class (alias)
"""
import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by auto-discovery in connector_registry.py."""

    # ─── SERVICES ────────────────────────────────────────────────────

    @_cap(registry, 'integrations.events.get_domain_event_service',
          description='Get DomainEventService class for event dispatching',
          cacheable=False, critical=False)
    def get_domain_event_service(org_id=0, **kw):
        from apps.integrations.event_service import DomainEventService
        return DomainEventService

    @_cap(registry, 'integrations.events.get_service',
          description='Get DomainEventService class (short alias)',
          cacheable=False, critical=False)
    def get_event_service(org_id=0, **kw):
        from apps.integrations.event_service import DomainEventService
        return DomainEventService


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
