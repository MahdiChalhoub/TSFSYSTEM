"""
Connector Engine - Routing Mixin
==================================
Request routing and forwarding for the Connector Engine.
"""

import logging
import time
from typing import Any, Dict, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from .connector_engine import ModuleState, OperationType, ConnectorResponse

logger = logging.getLogger(__name__)


def _track_route(target_module, endpoint, operation, success, latency_ms, fallback=False):
    """Track connector routing metrics via kernel observability (non-blocking)."""
    try:
        from kernel.observability.metrics import increment_counter, record_timing
        tags = {'target': target_module, 'endpoint': endpoint, 'op': operation}
        status = 'success' if success else 'fallback' if fallback else 'error'
        increment_counter(f'connector.route.{status}', tags=tags)
        record_timing('connector.route.latency', latency_ms, tags=tags)
    except Exception:
        pass  # Observability must never crash routing



class ConnectorRoutingMixin:
    
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
                
                _track_route(target_module, endpoint, 'read', True, (time.time() - start_time) * 1000)
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward read failed for {target_module}/{endpoint}: {e}")
                self._increment_failure(target_module, organization_id) # [HARDENING]
                _track_route(target_module, endpoint, 'read', False, (time.time() - start_time) * 1000)
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
                
                _track_route(target_module, endpoint, 'write', True, (time.time() - start_time) * 1000)
                return ConnectorResponse(data=response, state=state)
                
            except Exception as e:
                logger.error(f"Forward write failed for {target_module}/{endpoint}: {e}")
                self._increment_failure(target_module, organization_id) # [HARDENING]
                _track_route(target_module, endpoint, 'write', False, (time.time() - start_time) * 1000)
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

    # =========================================================================
    # INTERNAL FORWARDING (IMPLEMENTATION)
    # =========================================================================

    def _forward_read_request(self, target_module, endpoint, organization_id, params, version):
        """
        Internal implementation of read forwarding.
        In this architecture, it maps to the module's Service methods.
        """
        try:
            service = self._resolve_service(target_module)

            if service:
                # 2. Map endpoint to method
                # Simple mapping for now: "products/" -> "get_products"
                method_name = endpoint.strip('/').replace('/', '_')
                if not method_name.startswith('get_'):
                    method_name = f"get_{method_name}"
                
                if hasattr(service, method_name):
                    method = getattr(service, method_name)
                    # Get organization instance
                    org = self._Organization.objects.get(id=organization_id)
                    return method(org, **(params or {}))
                
            # 3. Fallback to direct model access if service method not found
            # This is for basic list/detail endpoints
            return self._direct_model_read(target_module, endpoint, organization_id, params)
            
        except Exception as e:
            logger.error(f"Internal read forward error: {e}")
            raise e

    def _resolve_service(self, target_module):
        """
        Resolve the service class for a module.
        Tries {Module}ConnectorService first (dedicated connector handler),
        then falls back to {Module}Service (general service).
        """
        import importlib
        module_name = target_module.capitalize()
        import_path = f"apps.{target_module}.services"
        service_module = importlib.import_module(import_path)

        # Priority 1: Dedicated ConnectorService (e.g. FinanceConnectorService)
        connector_class_name = f"{module_name}ConnectorService"
        # Try importing from connector_handlers sub-module
        try:
            handler_module = importlib.import_module(f"{import_path}.connector_handlers")
            if hasattr(handler_module, connector_class_name):
                return getattr(handler_module, connector_class_name)
        except ImportError:
            pass

        # Also check if it's exported from __init__.py
        if hasattr(service_module, connector_class_name):
            return getattr(service_module, connector_class_name)

        # Priority 2: General service (e.g. FinanceService)
        service_class_name = f"{module_name}Service"
        if hasattr(service_module, service_class_name):
            return getattr(service_module, service_class_name)

        return None

    def _forward_write_request(self, target_module, endpoint, data, organization_id, method, version):
        """
        Internal implementation of write forwarding.
        """
        try:
            service = self._resolve_service(target_module)

            if service:
                # Map endpoint to method: "products/create/" -> "create_product"
                method_name = endpoint.strip('/').replace('/', '_')
                if method_name.endswith('_create'): # Handle products/create/
                    method_name = "create_" + method_name.replace('_create', '')
                
                if hasattr(service, method_name):
                    method = getattr(service, method_name)
                    org = self._Organization.objects.get(id=organization_id)
                    return method(org, data)
            
            raise Exception(f"No handler found for write {target_module}/{endpoint}")
            
        except Exception as e:
            logger.error(f"Internal write forward error: {e}")
            raise e

    def _direct_model_read(self, target_module, endpoint, organization_id, params):
        """Safe direct model access fallback."""
        try:
            # Map endpoint to model (e.g., "products/" -> Product)
            # This is a bit risky but good for generic API endpoints
            model_name = endpoint.strip('/').split('/')[0].rstrip('s').capitalize()
            import_path = f"apps.{target_module}.models"
            import importlib
            try:
                models_module = importlib.import_module(import_path)
            except ImportError:
                # Try models directory
                import_path = f"apps.{target_module}.models.{endpoint.strip('/').split('/')[0].rstrip('s')}_models"
                try:
                    models_module = importlib.import_module(import_path)
                except ImportError:
                    return None
            
            if hasattr(models_module, model_name):
                model = getattr(models_module, model_name)
                qs = model.objects.filter(organization_id=organization_id)
                # handle detail
                parts = endpoint.strip('/').split('/')
                if len(parts) > 1 and parts[1].isdigit():
                    return model.objects.filter(organization_id=organization_id, id=parts[1]).values().first()
                return list(qs.values()[:100]) # Safety limit
            return None
        except Exception:
            return None

    # =========================================================================
    # FALLBACK ENGINE
    # =========================================================================

    def _apply_read_fallback(self, action, module, endpoint, org_id, resp_type, policy):
        """Executes the chosen read fallback action."""
        if action == 'empty':
            return ConnectorResponse(data=self.DEFAULT_EMPTY_RESPONSES.get(resp_type), fallback_applied=True)
        
        if action == 'cached':
            cached = self._get_cached_response(module, endpoint, org_id)
            if cached is not None:
                return ConnectorResponse(data=cached, from_cache=True, fallback_applied=True)
            return ConnectorResponse(data=self.DEFAULT_EMPTY_RESPONSES.get(resp_type), fallback_applied=True)
        
        if action == 'error':
            return ConnectorResponse(error=f"Module {module} is unavailable", fallback_applied=True)
            
        return ConnectorResponse(data=None, fallback_applied=True)

    def _apply_write_fallback(self, action, module, endpoint, data, org_id, source, method, policy):
        """Executes the chosen write fallback action."""
        if action == 'buffer':
            ttl = policy.buffer_ttl_seconds if policy else 3600
            buffered = self.buffer_request(module, endpoint, data, org_id, source, method, ttl)
            return ConnectorResponse(data=None, buffered=True, fallback_applied=True)
        
        if action == 'drop':
            logger.warning(f"🗑️ DROP: Write to {module}/{endpoint} dropped by policy")
            return ConnectorResponse(data=None, fallback_applied=True)
            
        if action == 'error':
            return ConnectorResponse(error=f"Module {module} is unavailable", fallback_applied=True)
            
        return ConnectorResponse(data=None, fallback_applied=True)

    # =========================================================================
    # AUDIT & LOGGING
    # =========================================================================

    def _log_routing(self, source, target, endpoint, op, state, decision, org_id, user_id, success, latency, policy):
        """Internal logging to ConnectorLog."""
        try:
            self._load_models()
            self._ConnectorLog.objects.create(
                source_module=source or 'unknown',
                target_module=target,
                target_endpoint=endpoint,
                operation=op.value,
                module_state=state.value,
                decision=decision,
                policy_applied=policy,
                organization_id=org_id,
                user_id=user_id,
                success=success,
                response_time_ms=latency
            )
        except Exception as e:
            # Logging should never crash the main request
            logger.error(f"Failed to log routing: {e}")

