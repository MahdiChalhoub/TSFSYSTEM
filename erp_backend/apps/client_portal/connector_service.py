"""
Client Portal Connector Service
==================================
Exposes client_portal capabilities to other modules via the Connector Governance Layer.

Capabilities:
  - client_portal.orders.get_model        → ClientOrder model class
  - client_portal.orders.get_line_model   → ClientOrderLine model class
  - client_portal.config.get_model        → ClientPortalConfig model class
"""
import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by auto-discovery in connector_registry.py."""

    # ─── MODELS ──────────────────────────────────────────────────────

    @_cap(registry, 'client_portal.orders.get_model',
          description='Get ClientOrder model class',
          cacheable=False, critical=False)
    def get_client_order_model(org_id=0, **kw):
        from apps.client_portal.models import ClientOrder
        return ClientOrder

    @_cap(registry, 'client_portal.orders.get_line_model',
          description='Get ClientOrderLine model class',
          cacheable=False, critical=False)
    def get_client_order_line_model(org_id=0, **kw):
        from apps.client_portal.models import ClientOrderLine
        return ClientOrderLine

    @_cap(registry, 'client_portal.config.get_model',
          description='Get ClientPortalConfig model class',
          cacheable=False, critical=False)
    def get_client_portal_config_model(org_id=0, **kw):
        from apps.client_portal.models import ClientPortalConfig
        return ClientPortalConfig


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
