"""
Connector Capability Registry
================================
The brain of the Connector Governance Layer.

Instead of:
    from apps.crm.models import Contact
    contact = Contact.objects.get(id=x)

Modules declare capabilities:
    @connector.capability('crm.contacts.get_detail')
    def get_contact_detail(org_id, contact_id): ...

And callers use:
    contact = connector.require('crm.contacts.get_detail', org_id, contact_id=5)

When CRM is deleted → connector returns None, applies policy, logs it.
When CRM is disabled → connector returns cached value or empty.

RULE: Modules declare capabilities. Callers require capabilities.
      The connector brokers everything in between.
"""

import logging
import time
import importlib
from typing import Any, Callable, Dict, List, Optional
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# CAPABILITY DESCRIPTOR
# =============================================================================

class Capability:
    """
    A single capability exposed by a module.

    Attributes:
        name:           Fully qualified name (e.g. 'crm.contacts.get_detail')
        module:         Module code (e.g. 'crm')
        domain:         Domain within module (e.g. 'contacts')
        action:         Specific action (e.g. 'get_detail')
        handler:        The callable that implements this capability
        fallback_type:  READ | WRITE | EVENT — determines fallback behavior
        critical:       If True, connector will FAIL HARD instead of soft-fail
        cacheable:      If True, connector caches results for fallback
        cache_ttl:      Cache TTL in seconds
        description:    Human-readable description
    """

    __slots__ = (
        'name', 'module', 'domain', 'action', 'handler',
        'fallback_type', 'critical', 'cacheable', 'cache_ttl',
        'description', 'version',
    )

    def __init__(
        self,
        name: str,
        handler: Callable,
        fallback_type: str = 'READ',
        critical: bool = False,
        cacheable: bool = True,
        cache_ttl: int = 300,
        description: str = '',
        version: str = '1.0',
    ):
        self.name = name
        parts = name.split('.', 2)
        self.module = parts[0] if len(parts) > 0 else ''
        self.domain = parts[1] if len(parts) > 1 else ''
        self.action = parts[2] if len(parts) > 2 else ''
        self.handler = handler
        self.fallback_type = fallback_type
        self.critical = critical
        self.cacheable = cacheable
        self.cache_ttl = cache_ttl
        self.description = description
        self.version = version

    def __repr__(self):
        return f"<Capability {self.name} [{self.fallback_type}]>"


# =============================================================================
# CAPABILITY REGISTRY (Singleton)
# =============================================================================

class CapabilityRegistry:
    """
    Central registry of all module capabilities.
    Modules register at startup via their connector_service.py files.
    """

    def __init__(self):
        self._capabilities: Dict[str, Capability] = {}
        self._module_caps: Dict[str, List[str]] = {}  # module → [cap_names]
        self._discovered = set()

    def register(
        self,
        name: str,
        handler: Callable,
        fallback_type: str = 'READ',
        critical: bool = False,
        cacheable: bool = True,
        cache_ttl: int = 300,
        description: str = '',
        version: str = '1.0',
    ) -> Capability:
        """Register a capability."""
        cap = Capability(
            name=name,
            handler=handler,
            fallback_type=fallback_type,
            critical=critical,
            cacheable=cacheable,
            cache_ttl=cache_ttl,
            description=description,
            version=version,
        )
        self._capabilities[name] = cap

        # Index by module
        if cap.module not in self._module_caps:
            self._module_caps[cap.module] = []
        if name not in self._module_caps[cap.module]:
            self._module_caps[cap.module].append(name)

        logger.debug(f"📋 Registered capability: {name}")
        return cap

    def get(self, name: str) -> Optional[Capability]:
        """Get a capability by name."""
        # Auto-discover if not found
        if name not in self._capabilities:
            module_code = name.split('.')[0] if '.' in name else name
            self._auto_discover(module_code)
        return self._capabilities.get(name)

    def list_module(self, module_code: str) -> List[Capability]:
        """List all capabilities for a module."""
        self._auto_discover(module_code)
        names = self._module_caps.get(module_code, [])
        return [self._capabilities[n] for n in names if n in self._capabilities]

    def list_all(self) -> Dict[str, List[Capability]]:
        """List all registered capabilities grouped by module."""
        return {
            module: self.list_module(module)
            for module in self._module_caps
        }

    def has(self, name: str) -> bool:
        """Check if a capability is registered."""
        return name in self._capabilities

    def _auto_discover(self, module_code: str):
        """Auto-discover capabilities from a module's connector_service.py."""
        if module_code in self._discovered:
            return
        self._discovered.add(module_code)

        try:
            mod = importlib.import_module(f'apps.{module_code}.connector_service')
            if hasattr(mod, 'register_capabilities'):
                mod.register_capabilities(self)
                logger.info(f"🔌 Auto-discovered capabilities from {module_code}")
        except ImportError:
            logger.debug(f"No connector_service.py found for {module_code}")
        except Exception as e:
            logger.warning(f"Error discovering capabilities for {module_code}: {e}")


# Global singleton
capability_registry = CapabilityRegistry()


# =============================================================================
# CONNECTOR FACADE — The simple API that modules use
# =============================================================================

class ConnectorFacade:
    """
    The simple, clean API that any module uses to talk to any other module.

    Usage:
        from erp.connector_registry import connector

        # Read data from another module
        contact = connector.require('crm.contacts.get_detail',
                                     org_id=org.id, contact_id=123)

        # Write to another module
        result = connector.execute('finance.journal.post_entry',
                                    org_id=org.id, data={...})

        # Check if capability exists
        if connector.available('inventory.stock.reserve'):
            connector.execute('inventory.stock.reserve', ...)

        # Get with explicit fallback
        products = connector.require('inventory.products.list',
                                      org_id=org.id, fallback=[])
    """

    def __init__(self, registry: CapabilityRegistry):
        self._registry = registry
        self._engine = None  # Lazy-loaded ConnectorEngine

    @property
    def engine(self):
        """Lazy-load the ConnectorEngine to avoid circular imports."""
        if self._engine is None:
            from erp.connector_engine import connector_engine
            self._engine = connector_engine
        return self._engine

    # ─── READ OPERATIONS ─────────────────────────────────────────────

    def require(
        self,
        capability_name: str,
        org_id: int,
        fallback: Any = None,
        user_id: Optional[int] = None,
        source: str = 'unknown',
        **kwargs,
    ) -> Any:
        """
        Require data from another module via a registered capability.

        Returns the capability result, or `fallback` if the module is unavailable.
        Never crashes — always returns a value.

        Args:
            capability_name: e.g. 'crm.contacts.get_detail'
            org_id:          Organization ID for tenant scoping
            fallback:        Value to return if module unavailable
            user_id:         Optional user for permission checking
            source:          Calling module name for audit trail
            **kwargs:        Arguments passed to the capability handler
        """
        start = time.time()
        cap = self._registry.get(capability_name)

        if cap is None:
            logger.warning(
                f"⚠️ Capability '{capability_name}' not registered. "
                f"Module may be uninstalled."
            )
            self._log(source, capability_name, 'READ', 'missing', 'fallback',
                      org_id, user_id, False, 0, f"Capability not registered")
            return fallback

        # Check module state
        module_code = cap.module
        try:
            state = self.engine.get_module_state(module_code, org_id, user_id)
        except Exception:
            state = None

        from erp.connector_engine import ModuleState
        if state != ModuleState.AVAILABLE:
            state_str = state.value if state else 'unknown'
            logger.info(
                f"🔌 Module '{module_code}' is {state_str} — "
                f"applying fallback for '{capability_name}'"
            )

            # Try cache if available
            if cap.cacheable:
                cached = self._get_cache(capability_name, org_id, kwargs)
                if cached is not None:
                    self._log(source, capability_name, 'READ', state_str,
                              'cached', org_id, user_id, True,
                              int((time.time() - start) * 1000), 'Served from cache')
                    return cached

            # Critical capabilities fail hard
            if cap.critical:
                raise RuntimeError(
                    f"Critical capability '{capability_name}' unavailable — "
                    f"module '{module_code}' is {state_str}"
                )

            self._log(source, capability_name, 'READ', state_str, 'fallback',
                      org_id, user_id, False,
                      int((time.time() - start) * 1000), f"Module {state_str}")
            return fallback

        # Module is available — execute the capability
        try:
            result = cap.handler(org_id=org_id, **kwargs)

            # Cache the result for future fallback
            if cap.cacheable and result is not None:
                self._set_cache(capability_name, org_id, kwargs, result, cap.cache_ttl)

            self._log(source, capability_name, 'READ', 'available', 'forward',
                      org_id, user_id, True,
                      int((time.time() - start) * 1000))
            return result

        except Exception as e:
            logger.error(f"Capability '{capability_name}' execution failed: {e}")
            self.engine._increment_failure(module_code, org_id)

            # Try cache as fallback
            if cap.cacheable:
                cached = self._get_cache(capability_name, org_id, kwargs)
                if cached is not None:
                    return cached

            if cap.critical:
                raise

            self._log(source, capability_name, 'READ', 'available', 'fallback',
                      org_id, user_id, False,
                      int((time.time() - start) * 1000), str(e))
            return fallback

    # ─── WRITE OPERATIONS ────────────────────────────────────────────

    def execute(
        self,
        capability_name: str,
        org_id: int,
        user_id: Optional[int] = None,
        source: str = 'unknown',
        **kwargs,
    ) -> Any:
        """
        Execute a write/action capability on another module.

        If the module is unavailable, the request is BUFFERED for replay.
        Critical writes will FAIL HARD instead of buffering.

        Args:
            capability_name: e.g. 'finance.journal.post_entry'
            org_id:          Organization ID
            user_id:         Optional user ID
            source:          Calling module name
            **kwargs:        Arguments passed to the capability handler
        """
        start = time.time()
        cap = self._registry.get(capability_name)

        if cap is None:
            logger.warning(f"⚠️ WRITE capability '{capability_name}' not registered")
            # Buffer unregistered writes for potential later replay
            self._buffer_write(capability_name, org_id, source, kwargs)
            return None

        module_code = cap.module
        try:
            state = self.engine.get_module_state(module_code, org_id, user_id)
        except Exception:
            state = None

        from erp.connector_engine import ModuleState
        if state != ModuleState.AVAILABLE:
            state_str = state.value if state else 'unknown'

            if cap.critical:
                raise RuntimeError(
                    f"Critical write capability '{capability_name}' unavailable — "
                    f"module '{module_code}' is {state_str}"
                )

            # Buffer the write for replay
            self._buffer_write(capability_name, org_id, source, kwargs)
            self._log(source, capability_name, 'WRITE', state_str, 'buffer',
                      org_id, user_id, False,
                      int((time.time() - start) * 1000), f"Buffered for replay")
            return None

        # Module is available — execute
        try:
            result = cap.handler(org_id=org_id, **kwargs)
            self._log(source, capability_name, 'WRITE', 'available', 'forward',
                      org_id, user_id, True,
                      int((time.time() - start) * 1000))
            return result

        except Exception as e:
            logger.error(f"WRITE capability '{capability_name}' failed: {e}")
            self.engine._increment_failure(module_code, org_id)

            if cap.critical:
                raise

            # Buffer the failed write
            self._buffer_write(capability_name, org_id, source, kwargs)
            self._log(source, capability_name, 'WRITE', 'available', 'buffer',
                      org_id, user_id, False,
                      int((time.time() - start) * 1000), str(e))
            return None

    # ─── AVAILABILITY CHECK ──────────────────────────────────────────

    def available(self, capability_name: str, org_id: int = 0) -> bool:
        """Check if a capability is available right now."""
        cap = self._registry.get(capability_name)
        if cap is None:
            return False
        if org_id == 0:
            return True  # No org check, just capability exists
        try:
            from erp.connector_engine import ModuleState
            state = self.engine.get_module_state(cap.module, org_id)
            return state == ModuleState.AVAILABLE
        except Exception:
            return False

    # ─── INTERNAL HELPERS ────────────────────────────────────────────

    def _get_cache(self, cap_name, org_id, params):
        """Get cached capability result."""
        cache_key = f"cap:{cap_name}:{org_id}:{hash(str(sorted(params.items())))}"
        return self.engine._get_cached_response(cap_name.split('.')[0], cache_key, org_id)

    def _set_cache(self, cap_name, org_id, params, value, ttl):
        """Cache a capability result."""
        cache_key = f"cap:{cap_name}:{org_id}:{hash(str(sorted(params.items())))}"
        self.engine._cache_response(cap_name.split('.')[0], cache_key, org_id, value, ttl)

    def _buffer_write(self, cap_name, org_id, source, kwargs):
        """Buffer a failed write for later replay."""
        try:
            self.engine.buffer_request(
                target_module=cap_name.split('.')[0],
                endpoint=cap_name,
                data={'capability': cap_name, 'kwargs': kwargs},
                organization_id=org_id,
                source_module=source,
                method='CAPABILITY',
                ttl_seconds=86400,
            )
            logger.info(f"📦 Buffered write: {cap_name}")
        except Exception as e:
            logger.error(f"Failed to buffer write {cap_name}: {e}")

    def _log(self, source, cap_name, op, state, decision,
             org_id, user_id, success, latency_ms, error=None):
        """Log a connector routing decision."""
        try:
            self.engine._load_models()
            self.engine._ConnectorLog.objects.create(
                source_module=source,
                target_module=cap_name.split('.')[0] if '.' in cap_name else cap_name,
                target_endpoint=cap_name,
                operation=op,
                module_state=state,
                decision=decision,
                organization_id=org_id,
                user_id=user_id,
                success=success,
                response_time_ms=latency_ms,
                error_message=error,
            )
        except Exception:
            pass  # Logging must never crash the main operation


# Global singleton facade
connector = ConnectorFacade(capability_registry)
