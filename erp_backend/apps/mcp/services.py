"""
MCP AI Connector - Service Layer
================================
Core services for MCP protocol implementation.

Architecture:
    AI Model → MCP Server → Django API → MCPService → Business Logic
"""

import json
import httpx
import hashlib
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
import base64


class MCPService:
    """
    Core MCP Protocol Service.
    Handles AI provider connections and tool execution.
    """
    
    def __init__(self, organization_id: int):
        self.organization_id = organization_id
        self._provider = None
        self._tools = None
    
    def get_provider(self, provider_id: Optional[int] = None):
        """Get the AI provider for this organization."""
        from .models import MCPProvider
        
        if provider_id:
            return MCPProvider.objects.filter(
                id=provider_id,
                organization_id=self.organization_id,
                is_active=True
            ).first()
        
        # Get default provider
        return MCPProvider.objects.filter(
            organization_id=self.organization_id,
            is_active=True,
            is_default=True
        ).first()
    
    def get_tools(self, user=None) -> List[Dict]:
        """
        Get available tools for MCP.
        Filters based on user permissions.
        """
        from .models import MCPTool
        from django.db import models as db_models
        
        tools = MCPTool.objects.filter(
            db_models.Q(organization_id=self.organization_id) | 
            db_models.Q(organization_id__isnull=True),  # Global tools
            is_active=True
        )
        
        result = []
        for tool in tools:
            # Check permissions if user provided
            if user and tool.required_permissions:
                has_all_perms = all(
                    self._check_user_permission(user, perm)
                    for perm in tool.required_permissions
                )
                if not has_all_perms:
                    continue
            
            result.append(tool.to_mcp_schema())
        
        return result
    
    def _check_user_permission(self, user, permission_code: str) -> bool:
        """Check if user has a specific permission."""
        if user.is_superuser:
            return True
        if hasattr(user, 'role') and user.role:
            return user.role.permissions.filter(code=permission_code).exists()
        return False
    
    async def chat(
        self,
        messages: List[Dict],
        provider_id: Optional[int] = None,
        tools: Optional[List[Dict]] = None,
        user=None
    ) -> Dict:
        """
        Send chat request to AI provider.
        Returns the AI response.
        """
        # Ensure imports for async safety
        from asgiref.sync import sync_to_async
        
        provider = await sync_to_async(self.get_provider)(provider_id)
        if not provider:
            return {
                'success': False,
                'error': 'No active AI provider configured'
            }
        
        # Get available tools if not provided
        if tools is None:
            tools = await sync_to_async(self.get_tools)(user)
        
        # Build request based on provider type
        adapter = AIProviderAdapter.get_adapter(provider)
        
        try:
            start_time = timezone.now()
            response = await adapter.chat(messages, tools)
            response_time = (timezone.now() - start_time).total_seconds() * 1000
            
            # Log usage
            await sync_to_async(self._log_usage)(
                provider=provider,
                user=user,
                response=response,
                response_time=response_time
            )
            
            return {
                'success': True,
                'response': response
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def execute_tool(
        self,
        tool_name: str,
        arguments: Dict,
        user=None
    ) -> Dict:
        """
        Execute a tool call from AI.
        Routes to the appropriate internal API endpoint.
        """
        from .models import MCPTool
        from django.db import models as db_models
        
        tool = MCPTool.objects.filter(
            name=tool_name,
            is_active=True
        ).filter(
            db_models.Q(organization_id=self.organization_id) |
            db_models.Q(organization_id__isnull=True)
        ).first()
        
        if not tool:
            return {
                'success': False,
                'error': f'Tool not found: {tool_name}'
            }
        
        # Check permissions
        if user and tool.required_permissions:
            for perm in tool.required_permissions:
                if not self._check_user_permission(user, perm):
                    return {
                        'success': False,
                        'error': f'Permission denied: {perm}'
                    }
        
        # Check if confirmation required
        if tool.requires_confirmation:
            return {
                'success': False,
                'requires_confirmation': True,
                'tool': tool.name,
                'arguments': arguments
            }
        
        # Execute the tool
        try:
            result = self._execute_internal_endpoint(
                endpoint=tool.internal_endpoint,
                method=tool.http_method,
                data=arguments,
                user=user
            )
            return {
                'success': True,
                'result': result
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _execute_internal_endpoint(
        self,
        endpoint: str,
        method: str,
        data: Dict,
        user=None
    ) -> Any:
        """
        Execute an internal API endpoint.
        This is where tool calls are routed to the business logic.
        """
        # Use the Connector module to route the request
        from erp.connector_engine import connector_engine
        
        # Parse endpoint to get module and path
        parts = endpoint.strip('/').split('/', 1)
        if len(parts) < 2:
            raise ValueError(f'Invalid endpoint format: {endpoint}')
        
        target_module = parts[0]
        target_endpoint = parts[1] if len(parts) > 1 else ''
        
        if method.upper() in ['GET', 'HEAD']:
            response = connector_engine.route_read(
                target_module=target_module,
                endpoint=target_endpoint,
                organization_id=self.organization_id,
                user_id=user.id if user else None,
                params=data
            )
        else:
            response = connector_engine.route_write(
                target_module=target_module,
                endpoint=target_endpoint,
                data=data,
                organization_id=self.organization_id,
                user_id=user.id if user else None,
                method=method
            )
        
        return response.data
    
    def _log_usage(self, provider, user, response, response_time):
        """Log usage for billing and monitoring."""
        from .models import MCPUsageLog
        
        usage = response.get('usage', {})
        
        MCPUsageLog.objects.create(
            organization_id=self.organization_id,
            user=user,
            provider=provider,
            model_name=provider.model_name,
            endpoint='chat',
            input_tokens=usage.get('input_tokens', 0),
            output_tokens=usage.get('output_tokens', 0),
            total_tokens=usage.get('total_tokens', 0),
            response_time_ms=int(response_time),
            success=True
        )


from .adapters import AIProviderAdapter, register_default_tools

