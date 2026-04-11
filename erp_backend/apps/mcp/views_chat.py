from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
import asyncio
from .models import (
    MCPProvider, MCPTool, MCPConnection, MCPConversation,
    MCPMessage, MCPUsageLog, MCPRateLimit, MCPAgent, MCPAgentLog
)
from .services import MCPService, AIProviderAdapter, register_default_tools
from .agents import run_agent_sync
from erp.permissions import BaseModulePermission
from .serializers import *
from .permissions import *



# =============================================================================
# CHAT API
# =============================================================================

class MCPChatView(APIView):
    """
    Main chat endpoint for AI interactions.
    POST /api/v1/mcp/chat/
    """
    permission_classes = [IsAuthenticated, CanUseMCPChat]
    
    def post(self, request):
        """
        Send a message to AI.
        
        Request body:
        {
            "message": "What are today's sales?",
            "conversation_id": 123,  // optional
            "provider_id": 1,  // optional
            "include_tools": true  // optional, default true
        }
        """
        user = request.user
        org_id = user.organization_id
        
        message = request.data.get('message')
        if not message:
            return Response(
                {'error': 'message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        conversation_id = request.data.get('conversation_id')
        provider_id = request.data.get('provider_id')
        include_tools = request.data.get('include_tools', True)
        
        # Get or create conversation
        if conversation_id:
            try:
                conversation = MCPConversation.objects.get(
                    id=conversation_id,
                    organization_id=org_id,
                    user=user
                )
            except MCPConversation.DoesNotExist:
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Create new conversation
            service = MCPService(org_id)
            provider = service.get_provider(provider_id)
            
            conversation = MCPConversation.objects.create(
                organization_id=org_id,
                user=user,
                provider=provider,
                title=message[:50]
            )
        
        # Build messages list from conversation history
        messages = []
        
        # Add system message
        messages.append({
            'role': 'system',
            'content': self._get_system_prompt(user)
        })
        
        # Add history
        for msg in conversation.messages.all():
            messages.append({
                'role': msg.role,
                'content': msg.content
            })
        
        # Add new user message
        messages.append({
            'role': 'user',
            'content': message
        })
        
        # Save user message
        MCPMessage.objects.create(
            conversation=conversation,
            role='user',
            content=message
        )
        
        # Send to AI
        service = MCPService(org_id)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        tools = service.get_tools(user) if include_tools else []
        result = loop.run_until_complete(
            service.chat(
                messages=messages,
                provider_id=provider_id,
                tools=tools,
                user=user
            )
        )
        loop.close()
        
        if not result.get('success'):
            return Response(
                {'error': result.get('error')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        response = result['response']
        
        # Handle tool calls if any
        if response.get('tool_calls'):
            tool_results = []
            for tool_call in response['tool_calls']:
                func = tool_call.get('function', {})
                tool_result = service.execute_tool(
                    tool_name=func.get('name'),
                    arguments=func.get('arguments', {}),
                    user=user
                )
                tool_results.append(tool_result)
            
            # Save tool call message
            MCPMessage.objects.create(
                conversation=conversation,
                role='assistant',
                content=response.get('content', ''),
                tool_calls=response['tool_calls']
            )
            
            # TODO: Continue conversation with tool results
            # For now, return both response and tool results
            return Response({
                'conversation_id': conversation.id,
                'content': response.get('content', ''),
                'tool_calls': response['tool_calls'],
                'tool_results': tool_results
            })
        
        # Save assistant response
        MCPMessage.objects.create(
            conversation=conversation,
            role='assistant',
            content=response.get('content', ''),
            input_tokens=response.get('usage', {}).get('input_tokens', 0),
            output_tokens=response.get('usage', {}).get('output_tokens', 0)
        )
        
        # Update conversation stats
        conversation.message_count += 2
        conversation.total_tokens += response.get('usage', {}).get('total_tokens', 0)
        conversation.save()
        
        return Response({
            'conversation_id': conversation.id,
            'content': response.get('content', ''),
            'usage': response.get('usage', {})
        })
    
    def _get_system_prompt(self, user):
        """Generate system prompt for AI."""
        return f"""You are an AI assistant for the Dajingo ERP platform.
You help users with inventory, sales, finance, and business operations.

User: {user.email}
Organization: {user.organization.name if hasattr(user, 'organization') else 'Unknown'}

You have access to tools that can query and modify business data.
Always confirm before making changes to data.
Be concise and helpful."""


class MCPToolExecuteView(APIView):
    """
    Execute a specific tool.
    POST /api/v1/mcp/tools/execute/
    """
    permission_classes = [IsAuthenticated, CanExecuteMCPTools]
    
    def post(self, request):
        """
        Execute a tool directly.
        
        Request body:
        {
            "tool_name": "get_products",
            "arguments": {"category": "electronics"}
        }
        """
        tool_name = request.data.get('tool_name')
        arguments = request.data.get('arguments', {})
        
        if not tool_name:
            return Response(
                {'error': 'tool_name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = MCPService(request.user.organization_id)
        result = service.execute_tool(
            tool_name=tool_name,
            arguments=arguments,
            user=request.user
        )
        
        if result.get('success'):
            return Response(result)
        elif result.get('requires_confirmation'):
            return Response(result, status=status.HTTP_202_ACCEPTED)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
