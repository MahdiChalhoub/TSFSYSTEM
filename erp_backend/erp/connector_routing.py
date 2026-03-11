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

    # =========================================================================
    # INTERNAL FORWARDING (IMPLEMENTATION)
    # =========================================================================

    def _forward_read_request(self, target_module, endpoint, organization_id, params, version):
        """
        Internal implementation of read forwarding.
        In this architecture, it maps to the module's Service methods.
        """
        try:
            # 1. Resolve service
            # Convention: apps.<module>.services.<Module>Service
            module_name = target_module.capitalize()
            import_path = f"apps.{target_module}.services"
            import importlib
            service_module = importlib.import_module(import_path)
            
            service_class_name = f"{module_name}Service"
            if hasattr(service_module, service_class_name):
                service = getattr(service_module, service_class_name)
                
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

    def _forward_write_request(self, target_module, endpoint, data, organization_id, method, version):
        """
        Internal implementation of write forwarding.
        """
        try:
            module_name = target_module.capitalize()
            import_path = f"apps.{target_module}.services"
            import importlib
            service_module = importlib.import_module(import_path)
            
            service_class_name = f"{module_name}Service"
            if hasattr(service_module, service_class_name):
                service = getattr(service_module, service_class_name)
                
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
                qs = model.objects.filter(tenant_id=organization_id)
                # handle detail
                parts = endpoint.strip('/').split('/')
                if len(parts) > 1 and parts[1].isdigit():
                    return model.objects.filter(tenant_id=organization_id, id=parts[1]).values().first()
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
                tenant_id=org_id,
                user_id=user_id,
                success=success,
                response_time_ms=latency
            )
        except Exception as e:
            # Logging should never crash the main request
            logger.error(f"Failed to log routing: {e}")

