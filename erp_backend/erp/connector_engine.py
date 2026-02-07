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
    # STATE EVALUATION & CIRCUIT BREAKER
    # =========================================================================
    
    def _is_circuit_broken(self, module_code: str, organization_id: int) -> bool:
        """
        Hardening: Check if module is in a circuit-broken state due to repeated failures.
        """
        cache_key = f"circuit_breaker:{organization_id}:{module_code}"
        failures = self._get_cached_response('kernel', cache_key, organization_id) or 0
        if failures >= 5:
            logger.error(f"🔌 CIRCUIT BREAKER: Module {module_code} is TRIPED for org {organization_id}")
            return True
        return False

    def _increment_failure(self, module_code: str, organization_id: int):
        """Increment failure count for circuit breaker."""
        cache_key = f"circuit_breaker:{organization_id}:{module_code}"
        current = self._get_cached_response('kernel', cache_key, organization_id) or 0
        self._cache_response('kernel', cache_key, organization_id, current + 1, ttl_seconds=600) # 10 min cooldown

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
        2. Is the circuit broken? Yes -> MISSING (Safe failure)
        3. Is module enabled for this tenant? No → DISABLED
        4. Does user have permission? No → UNAUTHORIZED
        5. All checks pass → AVAILABLE
        """
        self._load_models()
        
        # Check 1: Is module installed on system?
        try:
            system_module = self._SystemModule.objects.get(name=module_code)
            if system_module.status in ('FAILED', 'DISABLED'):
                return ModuleState.MISSING
        except self._SystemModule.DoesNotExist:
            return ModuleState.MISSING
        
        # [HARDENING] Check 2: Circuit Breaker
        if self._is_circuit_broken(module_code, organization_id):
            return ModuleState.MISSING # Fail safe as if missing

        # Check 3: Is module enabled for this tenant?
        try:
            org_module = self._OrganizationModule.objects.get(
                organization_id=organization_id,
                module_name=module_code
            )
            if not org_module.is_enabled:
                return ModuleState.DISABLED
        except self._OrganizationModule.DoesNotExist:
            return ModuleState.DISABLED
        
        # Check 4: Permission check
        if user_id:
            try:
                from .services import PermissionService
                user = self._User.objects.get(id=user_id)
                if not PermissionService.has_module_access(user, module_code):
                    return ModuleState.UNAUTHORIZED
            except Exception as e:
                logger.warning(f"Permission check failed for module {module_code}: {e}")
        
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
        response_type: str = 'object',
        version: str = 'v1' # [HARDENING] Contract versioning
    ) -> ConnectorResponse:
        """
        Route a READ request to a target module.
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
                    target_module, endpoint, organization_id, params, version
                )
                
                if response is None: raise Exception("Module returned empty/error")

                # Cache the response for future fallback
                self._cache_response(
                    target_module, endpoint, organization_id, response
                )
                
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward read failed for {target_module}/{endpoint}: {e}")
                self._increment_failure(target_module, organization_id) # [HARDENING]
                state = ModuleState.MISSING
        
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
        method: str = 'POST',
        version: str = 'v1' # [HARDENING] Contract versioning
    ) -> ConnectorResponse:
        """
        Route a WRITE request to a target module.
        """
        self._load_models()
        start_time = time.time()
        
        # Get module state
        state = self.get_module_state(target_module, organization_id, user_id)
        
        # If available, forward the request
        if state == ModuleState.AVAILABLE:
            try:
                response = self._forward_write_request(
                    target_module, endpoint, data, organization_id, method, version
                )
                
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward write failed for {target_module}/{endpoint}: {e}")
                self._increment_failure(target_module, organization_id) # [HARDENING]
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
        params: Optional[Dict] = None,
        version: str = 'v1'
    ) -> Any:
        """
        Forward a read request to the actual module endpoint with version support.
        """
        from django.test import RequestFactory
        from django.urls import resolve, Resolver404
        
        clean_endpoint = endpoint.strip('/')
        # Attempt versioned path first, then module root, then legacy root
        paths = [
            f"/api/{target_module}/{version}/{clean_endpoint}/",
            f"/api/{target_module}/{clean_endpoint}/",
            f"/api/{clean_endpoint}/"
        ] if clean_endpoint else [f"/api/{target_module}/{version}/", f"/api/{target_module}/"]

        factory = RequestFactory()
        
        for p in paths:
            try:
                match = resolve(p)
                request = factory.get(p, data=params or {})
                
                # Internal Bypass Auth
                from .models import User
                system_user = User.objects.filter(is_superuser=True).first()
                request.user = system_user
                request.org_id = organization_id
                
                response = match.func(request, *match.args, **match.kwargs)
                if hasattr(response, 'render') and callable(response.render):
                    response.render()
                
                data = response.data if hasattr(response, 'data') else response
                if data is not None:
                    return data
            except Resolver404:
                continue
            except Exception as e:
                logger.error(f"Internal Read Error for {p}: {e}")
                # We raise here because the caller (route_read) traps it for the circuit breaker
                raise e
                
        return None
    
    def _forward_write_request(
        self,
        target_module: str,
        endpoint: str,
        data: Dict,
        organization_id: int,
        method: str = 'POST',
        version: str = 'v1'
    ) -> Any:
        """Forward a write request with version support."""
        from django.test import RequestFactory
        from django.urls import resolve, Resolver404
        
        clean_endpoint = endpoint.strip('/')
        paths = [
            f"/api/{target_module}/{version}/{clean_endpoint}/",
            f"/api/{target_module}/{clean_endpoint}/",
            f"/api/{clean_endpoint}/"
        ] if clean_endpoint else [f"/api/{target_module}/{version}/", f"/api/{target_module}/"]

        factory = RequestFactory()
        dispatch = getattr(factory, method.lower())
        
        for p in paths:
            try:
                match = resolve(p)
                request = dispatch(p, data=data, content_type='application/json')
                
                from .models import User
                system_user = User.objects.filter(is_superuser=True).first()
                request.user = system_user
                request.org_id = organization_id
                
                response = match.func(request, *match.args, **match.kwargs)
                if hasattr(response, 'render') and callable(response.render):
                    response.render()
                
                return response.data if hasattr(response, 'data') else response
            except Resolver404:
                continue
            except Exception as e:
                logger.error(f"Internal Write Error for {p}: {e}")
                raise e

        return None
    
    def _deliver_event(
        self,
        target_module: str,
        event_name: str,
        payload: Dict,
        organization_id: int
    ):
        """
        Deliver an event to a module's event handler.
        
        Discovery order:
        1. Module event handler: apps.{module}.events.handle_event(event_name, payload, org_id)
        2. Django signal: connector_event signal with module/event/payload
        
        Each module can create an `events.py` file with a `handle_event` function
        to receive inter-module events routed by the ConnectorEngine.
        """
        import importlib
        
        logger.info(f"📡 EVENT BUS: {event_name} -> {target_module} (org={organization_id})")
        
        # Strategy 1: Direct module handler discovery
        handler_module_path = f"apps.{target_module}.events"
        try:
            event_module = importlib.import_module(handler_module_path)
            handler = getattr(event_module, 'handle_event', None)
            
            if handler and callable(handler):
                handler(event_name, payload, organization_id)
                logger.info(f"✅ Event delivered via handler: {handler_module_path}")
                return
            else:
                logger.debug(f"No handle_event() in {handler_module_path}")
        except ImportError:
            logger.debug(f"No events module at {handler_module_path}")
        except Exception as e:
            logger.error(f"Event handler error in {handler_module_path}: {e}")
            raise
        
        # Strategy 2: Django signal dispatch (allows loose coupling)
        try:
            from .signals import connector_event
            connector_event.send(
                sender=self.__class__,
                target_module=target_module,
                event_name=event_name,
                payload=payload,
                organization_id=organization_id
            )
            logger.info(f"✅ Event dispatched via signal: {event_name} -> {target_module}")
        except ImportError:
            logger.debug(f"No signals module configured, event {event_name} dropped for {target_module}")
        except Exception as e:
            logger.error(f"Signal dispatch error for {event_name}: {e}")
            raise
    
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
