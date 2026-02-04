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


class ConnectorEngine:
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
            organization_id=org.id,
            user=request.user
        )
        
        # Write to another module
        response = engine.route_write(
            source_module='pos',
            target_module='inventory',
            endpoint='stock/update/',
            data={'product_id': 123, 'quantity': -1},
            organization_id=org.id,
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
    
    def __init__(self):
        # Lazy imports to avoid circular dependencies
        self._models_loaded = False
    
    def _load_models(self):
        """Lazy load models to avoid import issues at startup."""
        if not self._models_loaded:
            from .models import SystemModule, OrganizationModule, Organization, User
            from .connector_models import (
                ModuleContract, ConnectorPolicy, BufferedRequest,
                ConnectorCache, ConnectorLog
            )
            self._SystemModule = SystemModule
            self._OrganizationModule = OrganizationModule
            self._Organization = Organization
            self._User = User
            self._ModuleContract = ModuleContract
            self._ConnectorPolicy = ConnectorPolicy
            self._BufferedRequest = BufferedRequest
            self._ConnectorCache = ConnectorCache
            self._ConnectorLog = ConnectorLog
            self._models_loaded = True
    
    # =========================================================================
    # STATE EVALUATION
    # =========================================================================
    
    def get_module_state(
        self,
        module_code: str,
        organization_id: int,
        user_id: Optional[int] = None
    ) -> ModuleState:
        """
        Evaluate the state of a target module relative to a request.
        
        Decision tree:
        1. Is module installed on system? No → MISSING
        2. Is module enabled for this tenant? No → DISABLED
        3. Does user have permission? No → UNAUTHORIZED
        4. All checks pass → AVAILABLE
        """
        self._load_models()
        
        # Check 1: Is module installed on system?
        try:
            system_module = self._SystemModule.objects.get(name=module_code)
            if system_module.status in ('FAILED', 'DISABLED'):
                return ModuleState.MISSING
        except self._SystemModule.DoesNotExist:
            return ModuleState.MISSING
        
        # Check 2: Is module enabled for this tenant?
        try:
            org_module = self._OrganizationModule.objects.get(
                organization_id=organization_id,
                module_name=module_code
            )
            if not org_module.is_enabled:
                return ModuleState.DISABLED
        except self._OrganizationModule.DoesNotExist:
            # Module installed but not granted to this org
            return ModuleState.DISABLED
        
        # Check 3: Permission check (if user provided)
        if user_id:
            # Import Permission Engine for authorization check
            try:
                from .services import PermissionService
                user = self._User.objects.get(id=user_id)
                # Check if user has access to this module
                if not PermissionService.has_module_access(user, module_code):
                    return ModuleState.UNAUTHORIZED
            except Exception as e:
                logger.warning(f"Permission check failed for module {module_code}: {e}")
                # On permission check failure, allow access (fail open for reads)
        
        return ModuleState.AVAILABLE
    
    def get_all_module_states(self, organization_id: int) -> Dict[str, ModuleState]:
        """Get states of all registered modules for a tenant."""
        self._load_models()
        
        states = {}
        modules = self._SystemModule.objects.all()
        
        for module in modules:
            states[module.name] = self.get_module_state(module.name, organization_id)
        
        return states
    
    # =========================================================================
    # POLICY RETRIEVAL
    # =========================================================================
    
    def get_policy(
        self,
        target_module: str,
        endpoint: str = '*'
    ) -> Optional['ConnectorPolicy']:
        """
        Retrieve the most specific policy for a target module/endpoint.
        
        Priority order:
        1. Exact match (module + endpoint)
        2. Module wildcard (module + *)
        3. Global wildcard (* + *)
        """
        self._load_models()
        
        # Try exact match first
        policy = self._ConnectorPolicy.objects.filter(
            target_module=target_module,
            target_endpoint=endpoint,
            is_active=True
        ).order_by('-priority').first()
        
        if policy:
            return policy
        
        # Try module-level wildcard
        policy = self._ConnectorPolicy.objects.filter(
            target_module=target_module,
            target_endpoint='*',
            is_active=True
        ).order_by('-priority').first()
        
        if policy:
            return policy
        
        # Try global wildcard
        policy = self._ConnectorPolicy.objects.filter(
            target_module='*',
            target_endpoint='*',
            is_active=True
        ).order_by('-priority').first()
        
        return policy
    
    def get_fallback_action(
        self,
        state: ModuleState,
        operation: OperationType,
        policy: Optional['ConnectorPolicy'] = None
    ) -> str:
        """
        Determine what fallback action to take based on state and operation.
        """
        if not policy:
            # Default fallbacks when no policy configured
            defaults = {
                (ModuleState.MISSING, OperationType.READ): 'empty',
                (ModuleState.MISSING, OperationType.WRITE): 'buffer',
                (ModuleState.DISABLED, OperationType.READ): 'empty',
                (ModuleState.DISABLED, OperationType.WRITE): 'drop',
                (ModuleState.UNAUTHORIZED, OperationType.READ): 'empty',
                (ModuleState.UNAUTHORIZED, OperationType.WRITE): 'drop',
            }
            return defaults.get((state, operation), 'empty')
        
        # Get from policy based on state and operation
        field_map = {
            (ModuleState.MISSING, OperationType.READ): 'when_missing_read',
            (ModuleState.MISSING, OperationType.WRITE): 'when_missing_write',
            (ModuleState.DISABLED, OperationType.READ): 'when_disabled_read',
            (ModuleState.DISABLED, OperationType.WRITE): 'when_disabled_write',
            (ModuleState.UNAUTHORIZED, OperationType.READ): 'when_unauthorized_read',
            (ModuleState.UNAUTHORIZED, OperationType.WRITE): 'when_unauthorized_write',
        }
        
        field = field_map.get((state, operation))
        if field:
            return getattr(policy, field, 'empty')
        
        return 'empty'
    
    # =========================================================================
    # ROUTING OPERATIONS
    # =========================================================================
    
    def route_read(
        self,
        target_module: str,
        endpoint: str,
        organization_id: int,
        user_id: Optional[int] = None,
        source_module: Optional[str] = None,
        params: Optional[Dict] = None,
        response_type: str = 'object'
    ) -> ConnectorResponse:
        """
        Route a READ request to a target module.
        
        If module is AVAILABLE → Forward request
        If module is MISSING/DISABLED/UNAUTHORIZED → Apply fallback policy
        """
        self._load_models()
        start_time = time.time()
        
        # Get module state
        state = self.get_module_state(target_module, organization_id, user_id)
        
        # If available, forward the request
        if state == ModuleState.AVAILABLE:
            try:
                # Forward to actual module endpoint
                response = self._forward_read_request(
                    target_module, endpoint, organization_id, params
                )
                
                # Cache the response for future fallback
                self._cache_response(
                    target_module, endpoint, organization_id, response
                )
                
                # Log success
                self._log_routing(
                    source_module, target_module, endpoint,
                    OperationType.READ, state, 'forward',
                    organization_id, user_id, True,
                    int((time.time() - start_time) * 1000)
                )
                
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward read failed for {target_module}/{endpoint}: {e}")
                # Fall through to fallback handling
                state = ModuleState.MISSING  # Treat as missing for fallback
        
        # Apply fallback policy
        policy = self.get_policy(target_module, endpoint)
        action = self.get_fallback_action(state, OperationType.READ, policy)
        
        response = self._apply_read_fallback(
            action, target_module, endpoint, organization_id, response_type, policy
        )
        
        # Log fallback
        self._log_routing(
            source_module, target_module, endpoint,
            OperationType.READ, state, 'fallback',
            organization_id, user_id, True,
            int((time.time() - start_time) * 1000),
            policy
        )
        
        return response
    
    def route_write(
        self,
        target_module: str,
        endpoint: str,
        data: Dict,
        organization_id: int,
        user_id: Optional[int] = None,
        source_module: Optional[str] = None,
        method: str = 'POST'
    ) -> ConnectorResponse:
        """
        Route a WRITE request to a target module.
        
        If module is AVAILABLE → Forward request
        If module is MISSING → Buffer for later replay
        If module is DISABLED/UNAUTHORIZED → Apply policy (drop/buffer/error)
        """
        self._load_models()
        start_time = time.time()
        
        # Get module state
        state = self.get_module_state(target_module, organization_id, user_id)
        
        # If available, forward the request
        if state == ModuleState.AVAILABLE:
            try:
                response = self._forward_write_request(
                    target_module, endpoint, data, organization_id, method
                )
                
                self._log_routing(
                    source_module, target_module, endpoint,
                    OperationType.WRITE, state, 'forward',
                    organization_id, user_id, True,
                    int((time.time() - start_time) * 1000)
                )
                
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward write failed for {target_module}/{endpoint}: {e}")
                state = ModuleState.MISSING
        
        # Apply fallback policy
        policy = self.get_policy(target_module, endpoint)
        action = self.get_fallback_action(state, OperationType.WRITE, policy)
        
        response = self._apply_write_fallback(
            action, target_module, endpoint, data, organization_id,
            source_module, method, policy
        )
        
        # Log action
        decision = 'buffer' if response.buffered else 'fallback'
        self._log_routing(
            source_module, target_module, endpoint,
            OperationType.WRITE, state, decision,
            organization_id, user_id, response.success,
            int((time.time() - start_time) * 1000),
            policy
        )
        
        return response
    
    def dispatch_event(
        self,
        source_module: str,
        event_name: str,
        payload: Dict,
        organization_id: int
    ) -> Dict[str, bool]:
        """
        Dispatch an event to all listening modules.
        Events are fire-and-forget with best-effort delivery.
        
        Returns dict of {module: success} for each listener.
        """
        self._load_models()
        results = {}
        
        # Find modules that subscribe to this event
        contracts = self._ModuleContract.objects.filter(
            needs__events_from__contains=[{'event': event_name}]
        )
        
        for contract in contracts:
            module_code = contract.module.name
            state = self.get_module_state(module_code, organization_id)
            
            if state == ModuleState.AVAILABLE:
                try:
                    # Deliver event to module
                    self._deliver_event(module_code, event_name, payload, organization_id)
                    results[module_code] = True
                except Exception as e:
                    logger.error(f"Event delivery failed to {module_code}: {e}")
                    results[module_code] = False
            else:
                # Module not available - log but don't fail
                logger.info(f"Skipping event to {module_code} (state: {state})")
                results[module_code] = False
        
        return results
    
    # =========================================================================
    # BUFFERING AND REPLAY
    # =========================================================================
    
    def buffer_request(
        self,
        target_module: str,
        endpoint: str,
        data: Dict,
        organization_id: int,
        source_module: Optional[str] = None,
        method: str = 'POST',
        ttl_seconds: int = 3600
    ) -> 'BufferedRequest':
        """
        Buffer a write request for later replay.
        """
        self._load_models()
        
        expires_at = timezone.now() + timedelta(seconds=ttl_seconds)
        
        buffered = self._BufferedRequest.objects.create(
            target_module=target_module,
            target_endpoint=endpoint,
            source_module=source_module,
            organization_id=organization_id,
            method=method,
            payload=data,
            expires_at=expires_at
        )
        
        logger.info(
            f"Buffered request to {target_module}/{endpoint} "
            f"(org={organization_id}, id={buffered.id})"
        )
        
        return buffered
    
    def replay_buffered(
        self,
        target_module: str,
        organization_id: int
    ) -> Tuple[int, int]:
        """
        Replay all buffered requests for a module that just became available.
        Called automatically when ModuleManager.grant_access is invoked.
        
        Returns: (replayed_count, failed_count)
        """
        self._load_models()
        
        # Get pending requests that haven't expired
        pending = self._BufferedRequest.objects.filter(
            target_module=target_module,
            organization_id=organization_id,
            status='pending',
            expires_at__gt=timezone.now()
        ).order_by('created_at')
        
        replayed = 0
        failed = 0
        
        for request in pending:
            try:
                # Attempt to forward the buffered request
                self._forward_write_request(
                    request.target_module,
                    request.target_endpoint,
                    request.payload,
                    organization_id,
                    request.method
                )
                
                # Mark as replayed
                request.status = 'replayed'
                request.replayed_at = timezone.now()
                request.save()
                replayed += 1
                
            except Exception as e:
                request.retry_count += 1
                request.last_error = str(e)
                request.last_attempt_at = timezone.now()
                
                if not request.can_retry:
                    request.status = 'failed'
                
                request.save()
                failed += 1
        
        logger.info(
            f"Replay complete for {target_module} (org={organization_id}): "
            f"{replayed} replayed, {failed} failed"
        )
        
        return replayed, failed
    
    def cleanup_expired_buffers(self) -> int:
        """
        Mark expired buffered requests as expired.
        Run periodically via management command.
        """
        self._load_models()
        
        count = self._BufferedRequest.objects.filter(
            status='pending',
            expires_at__lt=timezone.now()
        ).update(status='expired')
        
        logger.info(f"Cleaned up {count} expired buffered requests")
        return count
    
    # =========================================================================
    # CACHING
    # =========================================================================
    
    def _cache_response(
        self,
        target_module: str,
        endpoint: str,
        organization_id: int,
        response_data: Any,
        ttl_seconds: int = 300
    ):
        """Cache a response for fallback use."""
        self._load_models()
        
        cache_key = f"{organization_id}:{target_module}:{endpoint}"
        expires_at = timezone.now() + timedelta(seconds=ttl_seconds)
        
        self._ConnectorCache.objects.update_or_create(
            cache_key=cache_key,
            defaults={
                'target_module': target_module,
                'target_endpoint': endpoint,
                'organization_id': organization_id,
                'response_data': response_data,
                'expires_at': expires_at,
            }
        )
    
    def _get_cached_response(
        self,
        target_module: str,
        endpoint: str,
        organization_id: int
    ) -> Optional[Any]:
        """Retrieve a cached response if available and valid."""
        self._load_models()
        
        cache_key = f"{organization_id}:{target_module}:{endpoint}"
        
        try:
            cache = self._ConnectorCache.objects.get(
                cache_key=cache_key,
                expires_at__gt=timezone.now()
            )
            return cache.response_data
        except self._ConnectorCache.DoesNotExist:
            return None
    
    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================
    
    def _forward_read_request(
        self,
        target_module: str,
        endpoint: str,
        organization_id: int,
        params: Optional[Dict] = None
    ) -> Any:
        """
        Forward a read request to the actual module endpoint.
        In a real implementation, this would call the internal API.
        """
        # For now, we'll use Django's URL resolver
        # This is a stub that should be replaced with actual routing
        from django.test import RequestFactory
        from django.urls import reverse, resolve
        
        # Build the internal URL
        # This assumes modules register their APIs under /api/v1/{module}/
        url = f"/api/v1/{target_module}/{endpoint}"
        
        # For development, we'll return a placeholder
        # In production, this would make an internal HTTP call or direct function call
        logger.debug(f"Forward READ: {url} (org={organization_id})")
        
        # TODO: Implement actual internal routing
        # For now, return None to trigger fallback in calling code
        raise NotImplementedError("Direct routing not yet implemented - use erpFetch on frontend")
    
    def _forward_write_request(
        self,
        target_module: str,
        endpoint: str,
        data: Dict,
        organization_id: int,
        method: str = 'POST'
    ) -> Any:
        """Forward a write request to the actual module endpoint."""
        url = f"/api/v1/{target_module}/{endpoint}"
        logger.debug(f"Forward WRITE ({method}): {url} (org={organization_id})")
        
        # TODO: Implement actual internal routing
        raise NotImplementedError("Direct routing not yet implemented - use erpFetch on frontend")
    
    def _deliver_event(
        self,
        target_module: str,
        event_name: str,
        payload: Dict,
        organization_id: int
    ):
        """Deliver an event to a module's event handler."""
        logger.debug(f"Deliver EVENT: {event_name} -> {target_module} (org={organization_id})")
        
        # TODO: Implement event bus integration
        pass
    
    def _apply_read_fallback(
        self,
        action: str,
        target_module: str,
        endpoint: str,
        organization_id: int,
        response_type: str,
        policy: Optional['ConnectorPolicy']
    ) -> ConnectorResponse:
        """Apply a fallback action for a READ operation."""
        
        if action == 'empty':
            data = self.DEFAULT_EMPTY_RESPONSES.get(response_type)
            return ConnectorResponse(
                data=data,
                fallback_applied=True
            )
        
        elif action == 'cached':
            cached = self._get_cached_response(target_module, endpoint, organization_id)
            if cached is not None:
                return ConnectorResponse(
                    data=cached,
                    from_cache=True,
                    fallback_applied=True
                )
            # Cache miss - return empty
            data = self.DEFAULT_EMPTY_RESPONSES.get(response_type)
            return ConnectorResponse(data=data, fallback_applied=True)
        
        elif action == 'mock':
            # Return mock data for development
            return ConnectorResponse(
                data={'_mock': True, 'module': target_module, 'endpoint': endpoint},
                fallback_applied=True
            )
        
        elif action == 'error':
            return ConnectorResponse(
                data=None,
                error=f"Module {target_module} is not available",
                fallback_applied=True
            )
        
        elif action == 'wait':
            # Blocking wait is not recommended in web context
            # Return empty with a flag
            return ConnectorResponse(
                data=None,
                error="Module not ready (blocking wait not supported)",
                fallback_applied=True
            )
        
        # Default: empty response
        return ConnectorResponse(
            data=self.DEFAULT_EMPTY_RESPONSES.get(response_type),
            fallback_applied=True
        )
    
    def _apply_write_fallback(
        self,
        action: str,
        target_module: str,
        endpoint: str,
        data: Dict,
        organization_id: int,
        source_module: Optional[str],
        method: str,
        policy: Optional['ConnectorPolicy']
    ) -> ConnectorResponse:
        """Apply a fallback action for a WRITE operation."""
        
        if action == 'buffer':
            ttl = policy.buffer_ttl_seconds if policy else 3600
            buffered = self.buffer_request(
                target_module, endpoint, data, organization_id,
                source_module, method, ttl
            )
            return ConnectorResponse(
                data={'buffered_id': buffered.id},
                buffered=True,
                fallback_applied=True
            )
        
        elif action == 'drop':
            return ConnectorResponse(
                data=None,
                fallback_applied=True
            )
        
        elif action == 'error':
            return ConnectorResponse(
                data=None,
                error=f"Cannot write to {target_module} (unavailable)",
                fallback_applied=True
            )
        
        elif action == 'queue_event':
            # Emit as event instead of direct write
            self.dispatch_event(
                source_module or 'unknown',
                f"{target_module}.write_queued",
                {'endpoint': endpoint, 'data': data},
                organization_id
            )
            return ConnectorResponse(
                data={'queued_as_event': True},
                fallback_applied=True
            )
        
        # Default: drop silently
        return ConnectorResponse(data=None, fallback_applied=True)
    
    def _log_routing(
        self,
        source_module: Optional[str],
        target_module: str,
        endpoint: str,
        operation: OperationType,
        state: ModuleState,
        decision: str,
        organization_id: int,
        user_id: Optional[int],
        success: bool,
        response_time_ms: int,
        policy: Optional['ConnectorPolicy'] = None,
        error: Optional[str] = None
    ):
        """Log a routing decision for audit."""
        self._load_models()
        
        try:
            self._ConnectorLog.objects.create(
                source_module=source_module,
                target_module=target_module,
                target_endpoint=endpoint,
                operation=operation.value,
                module_state=state.value,
                decision=decision,
                policy_applied=policy,
                organization_id=organization_id,
                user_id=user_id,
                success=success,
                response_time_ms=response_time_ms,
                error_message=error
            )
        except Exception as e:
            logger.error(f"Failed to log connector routing: {e}")


# Singleton instance for easy access
connector_engine = ConnectorEngine()
