"""
Connector Engine - State Mixin
==================================
State evaluation and policy management for the Connector Engine.
"""

import logging
import time
from typing import Any, Dict, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from .connector_engine import ModuleState, OperationType, ConnectorResponse

logger = logging.getLogger(__name__)



class ConnectorStateMixin:
    
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
                tenant_id=organization_id,
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

