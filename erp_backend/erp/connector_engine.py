"""
Connector Engine - Runtime Broker
==================================
The nervous system of the modular platform.

This is the core infrastructure that:
- Evaluates module states (AVAILABLE, MISSING, DISABLED, UNAUTHORIZED)
- Applies configured policies for fallback behavior
- Routes requests with graceful degradation
- Buffers writes for later replay
- Logs all routing decisions for audit

RULE: A module never decides what happens when another module is unavailable.
      Only the Connector decides. Modules only declare intent.
"""

import logging
import time
from enum import Enum
from typing import Any, Dict, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class ModuleState(Enum):
    """
    The 4 states a target module can be in relative to a request.
    These are NOT errors - they are states that the Connector manages.
    """
    AVAILABLE = "available"       # 🟢 Module installed and enabled
    MISSING = "missing"           # 🟡 Module not installed on system
    DISABLED = "disabled"         # 🔵 Module installed but disabled for tenant
    UNAUTHORIZED = "unauthorized"  # 🔴 Module exists but no permission


class OperationType(Enum):
    """Types of operations the Connector can route."""
    READ = "read"
    WRITE = "write"
    EVENT = "event"


class ConnectorResponse:
    """
    Standard response from the Connector.
    Includes metadata about how the request was handled.
    """
    def __init__(
        self,
        data: Any = None,
        state: ModuleState = ModuleState.AVAILABLE,
        from_cache: bool = False,
        buffered: bool = False,
        fallback_applied: bool = False,
        error: Optional[str] = None
    ):
        self.data = data
        self.state = state
        self.from_cache = from_cache
        self.buffered = buffered
        self.fallback_applied = fallback_applied
        self.error = error
        self.timestamp = timezone.now()
    
    def to_dict(self) -> Dict:
        return {
            'data': self.data,
            'state': self.state.value,
            'from_cache': self.from_cache,
            'buffered': self.buffered,
            'fallback_applied': self.fallback_applied,
            'error': self.error,
            'timestamp': self.timestamp.isoformat(),
        }
    
    @property
    def success(self) -> bool:
        return self.error is None



from .connector_state import ConnectorStateMixin
from .connector_routing import ConnectorRoutingMixin
from .connector_events import ConnectorEventsMixin

class ConnectorEngine(ConnectorStateMixin, ConnectorRoutingMixin, ConnectorEventsMixin):
        
        def __init__(self):
            # Lazy imports to avoid circular dependencies
            self._models_loaded = False
            self._cache = {}  # In-memory cache for circuit breaker

        def _get_cached_response(self, module, key, org_id):
            """Get a cached value (circuit breaker, response cache)."""
            cache_key = f"{module}:{key}:{org_id}"
            entry = self._cache.get(cache_key)
            if entry is None:
                return None
            # Check TTL
            if entry.get('expires_at') and timezone.now() > entry['expires_at']:
                del self._cache[cache_key]
                return None
            return entry.get('value')

        def _cache_response(self, module, key, org_id, value, ttl_seconds=300):
            """Store a cached value with optional TTL."""
            cache_key = f"{module}:{key}:{org_id}"
            self._cache[cache_key] = {
                'value': value,
                'expires_at': timezone.now() + timedelta(seconds=ttl_seconds) if ttl_seconds else None,
            }

    
        """
        Module Contract Registry + Runtime Broker
        
        The Connector is:
        - 🧠 Memory of the whole system (knows what each module provides/needs)
        - 🚦 Traffic controller (routes all inter-module communication)
        - 🛡 Stability shield (ensures no crashes from missing modules)
        
        Usage:
            engine = ConnectorEngine()
            
            # Read from another module
            response = engine.route_read(
                source_module='finance',
                target_module='inventory',
                endpoint='products/cost/',
                tenant_id=org.id,
                user=request.user
            )
            
            # Write to another module
            response = engine.route_write(
                source_module='pos',
                target_module='inventory',
                endpoint='stock/update/',
                data={'product_id': 123, 'quantity': -1},
                tenant_id=org.id,
                user=request.user
            )
        """
        
        # Default fallback responses by type
        DEFAULT_EMPTY_RESPONSES = {
            'list': [],
            'object': None,
            'count': 0,
            'boolean': False,
            'string': '',
        }

        def buffer_request(self, target_module, endpoint, data, organization_id,
                           source_module=None, method='POST', ttl_seconds=3600):
            """Buffer a request for later replay when a module becomes available."""
            self._load_models()
            expires_at = timezone.now() + timedelta(seconds=ttl_seconds) if ttl_seconds else None
            buffered = self._BufferedRequest.objects.create(
                target_module=target_module,
                target_endpoint=endpoint,
                tenant_id=organization_id,
                source_module=source_module or '',
                method=method,
                payload=data,
                status='pending',
                expires_at=expires_at,
            )
            return buffered

        def cleanup_expired_buffers(self):
            """Mark expired buffers as expired. Returns count of cleaned buffers."""
            self._load_models()
            expired = self._BufferedRequest.objects.filter(
                status='pending',
                expires_at__lt=timezone.now()
            )
            count = expired.update(status='expired')
            return count

# Global singleton instance
connector_engine = ConnectorEngine()
