import json
import httpx
import hashlib
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
import base64

from .models import MCPProvider


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
        'internal_endpoint': 'inventory/products/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'category': {'type': 'string', 'description': 'Filter by category'},
                'search': {'type': 'string', 'description': 'Search term'},
                'limit': {'type': 'integer', 'description': 'Max results'}
            }
        },
        'required_permissions': ['inventory.view']
    },
    {
        'name': 'get_product_stock',
        'description': 'Get stock levels for a product',
        'category': 'inventory',
        'internal_endpoint': 'inventory/stock-levels/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'product_id': {'type': 'integer', 'description': 'Product ID'}
            },
            'required': ['product_id']
        },
        'required_permissions': ['inventory.view']
    },
    {
        'name': 'get_financial_summary',
        'description': 'Get financial summary for a period',
        'category': 'finance',
        'internal_endpoint': 'finance/reports/summary/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'start_date': {'type': 'string', 'description': 'Start date (YYYY-MM-DD)'},
                'end_date': {'type': 'string', 'description': 'End date (YYYY-MM-DD)'}
            }
        },
        'required_permissions': ['finance.view']
    },
    {
        'name': 'get_sales_today',
        'description': 'Get today\'s sales summary',
        'category': 'pos',
        'internal_endpoint': 'pos/sales/today/',
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
        'internal_endpoint': 'crm/customers/',
        'http_method': 'GET',
        'parameters_schema': {
            'type': 'object',
            'properties': {
                'search': {'type': 'string', 'description': 'Search by name or email'},
                'limit': {'type': 'integer', 'description': 'Max results'}
            }
        },
        'required_permissions': ['crm.view']
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

