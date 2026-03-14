"""
Workforce Connector Service
==============================
Exposes workforce capabilities to other modules via the Connector Governance Layer.

Capabilities:
  - workforce.services.get_score_engine → WorkforceScoreEngine class
"""
import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by auto-discovery in connector_registry.py."""

    @_cap(registry, 'workforce.services.get_score_engine',
          description='Get WorkforceScoreEngine class',
          cacheable=False, critical=False)
    def get_score_engine(org_id=0, **kw):
        from apps.workforce.services import WorkforceScoreEngine
        return WorkforceScoreEngine


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
