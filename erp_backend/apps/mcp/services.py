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
        provider = self.get_provider(provider_id)
        if not provider:
            return {
                'success': False,
                'error': 'No active AI provider configured'
            }
        
        # Get available tools if not provided
        if tools is None:
            tools = self.get_tools(user)
        
        # Build request based on provider type
        adapter = AIProviderAdapter.get_adapter(provider)
        
        try:
            start_time = timezone.now()
            response = await adapter.chat(messages, tools)
            response_time = (timezone.now() - start_time).total_seconds() * 1000
            
            # Log usage
            self._log_usage(
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


class AIProviderAdapter:
    """
    Adapter pattern for different AI providers.
    Each provider has its own API format.
    """
    
    @staticmethod
    def get_adapter(provider):
        """Get the appropriate adapter for a provider."""
        adapters = {
            'openai': OpenAIAdapter,
            'anthropic': AnthropicAdapter,
            'google': GoogleAdapter,
            'azure': AzureOpenAIAdapter,
            'ollama': OllamaAdapter,
            'custom': CustomAdapter,
        }
        adapter_class = adapters.get(provider.provider_type, CustomAdapter)
        return adapter_class(provider)
    
    def __init__(self, provider):
        self.provider = provider
        self.api_key = self._decrypt_api_key(provider.api_key)
    
    def _decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt the API key."""
        if not encrypted_key:
            return ''
        try:
            # Use Django SECRET_KEY for encryption
            key = base64.urlsafe_b64encode(
                hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            )
            f = Fernet(key)
            return f.decrypt(encrypted_key.encode()).decode()
        except Exception:
            # If decryption fails, assume it's plaintext (for testing)
            return encrypted_key
    
    @staticmethod
    def encrypt_api_key(api_key: str) -> str:
        """Encrypt an API key for storage."""
        if not api_key:
            return ''
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        )
        f = Fernet(key)
        return f.encrypt(api_key.encode()).decode()
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        raise NotImplementedError


class OpenAIAdapter(AIProviderAdapter):
    """OpenAI API adapter."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        url = self.provider.api_base_url or 'https://api.openai.com/v1/chat/completions'
        
        payload = {
            'model': self.provider.model_name,
            'messages': messages,
            'max_tokens': self.provider.max_tokens,
            'temperature': self.provider.temperature,
        }
        
        if tools:
            payload['tools'] = [
                {
                    'type': 'function',
                    'function': tool
                }
                for tool in tools
            ]
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                },
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            'content': data['choices'][0]['message'].get('content', ''),
            'tool_calls': data['choices'][0]['message'].get('tool_calls', []),
            'usage': data.get('usage', {}),
            'finish_reason': data['choices'][0].get('finish_reason')
        }


class AnthropicAdapter(AIProviderAdapter):
    """Anthropic (Claude) API adapter."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        url = self.provider.api_base_url or 'https://api.anthropic.com/v1/messages'
        
        # Convert messages to Anthropic format
        anthropic_messages = []
        system_message = None
        
        for msg in messages:
            if msg['role'] == 'system':
                system_message = msg['content']
            else:
                anthropic_messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })
        
        payload = {
            'model': self.provider.model_name,
            'messages': anthropic_messages,
            'max_tokens': self.provider.max_tokens,
        }
        
        if system_message:
            payload['system'] = system_message
        
        if tools:
            payload['tools'] = tools
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    'x-api-key': self.api_key,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        # Extract content and tool calls
        content = ''
        tool_calls = []
        
        for block in data.get('content', []):
            if block['type'] == 'text':
                content += block['text']
            elif block['type'] == 'tool_use':
                tool_calls.append({
                    'id': block['id'],
                    'function': {
                        'name': block['name'],
                        'arguments': json.dumps(block['input'])
                    }
                })
        
        return {
            'content': content,
            'tool_calls': tool_calls,
            'usage': {
                'input_tokens': data.get('usage', {}).get('input_tokens', 0),
                'output_tokens': data.get('usage', {}).get('output_tokens', 0),
            },
            'finish_reason': data.get('stop_reason')
        }


class GoogleAdapter(AIProviderAdapter):
    """Google Gemini API adapter."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        url = f'https://generativelanguage.googleapis.com/v1/models/{self.provider.model_name}:generateContent?key={self.api_key}'
        
        # Convert to Gemini format
        contents = []
        for msg in messages:
            if msg['role'] != 'system':
                contents.append({
                    'role': 'user' if msg['role'] == 'user' else 'model',
                    'parts': [{'text': msg['content']}]
                })
        
        payload = {
            'contents': contents,
            'generationConfig': {
                'maxOutputTokens': self.provider.max_tokens,
                'temperature': self.provider.temperature,
            }
        }
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        
        content = data['candidates'][0]['content']['parts'][0]['text']
        
        return {
            'content': content,
            'tool_calls': [],
            'usage': data.get('usageMetadata', {}),
            'finish_reason': data['candidates'][0].get('finishReason')
        }


class AzureOpenAIAdapter(OpenAIAdapter):
    """Azure OpenAI API adapter."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        # Azure uses a different URL format
        url = f"{self.provider.api_base_url}/openai/deployments/{self.provider.model_name}/chat/completions?api-version=2024-02-15-preview"
        
        payload = {
            'messages': messages,
            'max_tokens': self.provider.max_tokens,
            'temperature': self.provider.temperature,
        }
        
        if tools:
            payload['tools'] = [
                {
                    'type': 'function',
                    'function': tool
                }
                for tool in tools
            ]
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    'api-key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            'content': data['choices'][0]['message'].get('content', ''),
            'tool_calls': data['choices'][0]['message'].get('tool_calls', []),
            'usage': data.get('usage', {}),
            'finish_reason': data['choices'][0].get('finish_reason')
        }


class OllamaAdapter(AIProviderAdapter):
    """Ollama (local) API adapter."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        url = f"{self.provider.api_base_url or 'http://localhost:11434'}/api/chat"
        
        payload = {
            'model': self.provider.model_name,
            'messages': messages,
            'stream': False,
        }
        
        if tools:
            payload['tools'] = tools
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        
        return {
            'content': data['message'].get('content', ''),
            'tool_calls': data['message'].get('tool_calls', []),
            'usage': {
                'total_tokens': data.get('eval_count', 0)
            },
            'finish_reason': 'stop'
        }


class CustomAdapter(AIProviderAdapter):
    """Custom API adapter for any OpenAI-compatible endpoint."""
    
    async def chat(self, messages: List[Dict], tools: List[Dict]) -> Dict:
        if not self.provider.api_base_url:
            raise ValueError('Custom provider requires api_base_url')
        
        payload = {
            'model': self.provider.model_name,
            'messages': messages,
            'max_tokens': self.provider.max_tokens,
            'temperature': self.provider.temperature,
        }
        
        if tools:
            payload['tools'] = [
                {
                    'type': 'function',
                    'function': tool
                }
                for tool in tools
            ]
        
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        async with httpx.AsyncClient(timeout=self.provider.timeout_seconds) as client:
            response = await client.post(
                f"{self.provider.api_base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        return {
            'content': data['choices'][0]['message'].get('content', ''),
            'tool_calls': data['choices'][0]['message'].get('tool_calls', []),
            'usage': data.get('usage', {}),
            'finish_reason': data['choices'][0].get('finish_reason')
        }


# =============================================================================
# TOOL REGISTRY - Default Tools
# =============================================================================

DEFAULT_TOOLS = [
    {
        'name': 'get_products',
        'description': 'Get list of products from inventory',
        'category': 'inventory',
        'internal_endpoint': 'products/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'category': {'type': 'string', 'description': 'Filter by category'},
                'search': {'type': 'string', 'description': 'Search term'},
                'limit': {'type': 'integer', 'description': 'Max results'}
            }
        },
        'required_permissions': ['inventory.view_products']
    },
    {
        'name': 'get_product_stock',
        'description': 'Get stock levels for a product',
        'category': 'inventory',
        'internal_endpoint': 'inventory/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'product_id': {'type': 'integer', 'description': 'Product ID'}
            },
            'required': ['product_id']
        },
        'required_permissions': ['inventory.view_stock']
    },
    {
        'name': 'get_inventory_valuation',
        'description': 'Get total inventory valuation and financial status',
        'category': 'inventory',
        'internal_endpoint': 'inventory/valuation/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {}
        },
        'required_permissions': ['inventory.view_stock']
    },
    {
        'name': 'get_sales_today',
        'description': 'Get today\'s sales summary',
        'category': 'pos',
        'internal_endpoint': 'pos/sales_today/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {}
        },
        'required_permissions': ['pos.access']
    },
    {
        'name': 'get_customers',
        'description': 'Search customers',
        'category': 'crm',
        'internal_endpoint': 'contacts/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'search': {'type': 'string', 'description': 'Search by name or email'},
                'limit': {'type': 'integer', 'description': 'Max results'}
            }
        },
        'required_permissions': ['contacts.view']
    },
]


def register_default_tools(organization_id: int):
    """Register default tools for an organization."""
    from .models import MCPTool
    
    for tool_data in DEFAULT_TOOLS:
        MCPTool.objects.update_or_create(
            organization_id=organization_id,
            name=tool_data['name'],
            defaults={
                'description': tool_data['description'],
                'category': tool_data['category'],
                'internal_endpoint': tool_data['internal_endpoint'],
                'http_method': tool_data['http_method'],
                'parameters_schema': tool_data['parameters_schema'],
                'required_permissions': tool_data['required_permissions'],
                'is_active': True
            }
        )
