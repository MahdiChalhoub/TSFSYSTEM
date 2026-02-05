"""
MCP AI Connector - API Views
============================
REST API endpoints for MCP module management.
"""

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
    MCPMessage, MCPUsageLog, MCPRateLimit
)
from .services import MCPService, AIProviderAdapter, register_default_tools
from erp.permissions import BaseModulePermission


# =============================================================================
# PERMISSIONS
# =============================================================================

class CanViewMCP(BaseModulePermission):
    permission_code = 'mcp.view'

class CanManageMCP(BaseModulePermission):
    permission_code = 'mcp.manage'

class CanUseMCPChat(BaseModulePermission):
    permission_code = 'mcp.chat'

class CanExecuteMCPTools(BaseModulePermission):
    permission_code = 'mcp.tools'

class IsMCPAdmin(BaseModulePermission):
    permission_code = 'mcp.admin'


# =============================================================================
# SERIALIZERS
# =============================================================================

class MCPProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPProvider
        fields = [
            'id', 'name', 'provider_type', 'api_base_url', 'model_name',
            'max_tokens', 'temperature', 'timeout_seconds',
            'is_active', 'is_default', 'last_tested_at', 'last_test_success',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['last_tested_at', 'last_test_success']
    
    def create(self, validated_data):
        # Handle API key separately (encrypt it)
        api_key = self.context['request'].data.get('api_key', '')
        if api_key:
            validated_data['api_key'] = AIProviderAdapter.encrypt_api_key(api_key)
        
        validated_data['organization'] = self.context['request'].user.organization
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Handle API key update
        api_key = self.context['request'].data.get('api_key', '')
        if api_key:
            validated_data['api_key'] = AIProviderAdapter.encrypt_api_key(api_key)
        return super().update(instance, validated_data)


class MCPProviderCreateSerializer(MCPProviderSerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta(MCPProviderSerializer.Meta):
        fields = MCPProviderSerializer.Meta.fields + ['api_key']


class MCPToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPTool
        fields = [
            'id', 'name', 'description', 'category',
            'internal_endpoint', 'http_method', 'parameters_schema',
            'required_permissions', 'is_active', 'requires_confirmation',
            'created_at', 'updated_at'
        ]


class MCPConnectionSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = MCPConnection
        fields = [
            'id', 'provider', 'provider_name', 'status', 'server_url', 'server_port',
            'total_requests', 'total_tokens_used', 'last_request_at',
            'last_error', 'error_count', 'created_at', 'updated_at'
        ]


class MCPConversationSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = MCPConversation
        fields = [
            'id', 'user', 'user_email', 'provider', 'provider_name',
            'title', 'message_count', 'total_tokens', 'total_cost',
            'is_active', 'created_at', 'updated_at'
        ]


class MCPMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPMessage
        fields = [
            'id', 'role', 'content', 'tool_calls', 'tool_call_id',
            'input_tokens', 'output_tokens', 'created_at'
        ]


class MCPUsageLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = MCPUsageLog
        fields = [
            'id', 'user', 'user_email', 'provider', 'provider_name',
            'model_name', 'endpoint', 'input_tokens', 'output_tokens',
            'total_tokens', 'total_cost', 'response_time_ms', 'success',
            'error_message', 'created_at'
        ]


# =============================================================================
# VIEW SETS
# =============================================================================

class MCPProviderViewSet(viewsets.ModelViewSet):
    """CRUD for AI providers."""
    serializer_class = MCPProviderSerializer
    permission_classes = [IsAuthenticated, CanManageMCP]
    
    def get_queryset(self):
        return MCPProvider.objects.filter(
            organization=self.request.user.organization
        )
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MCPProviderCreateSerializer
        return MCPProviderSerializer
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test connection to provider."""
        provider = self.get_object()
        
        try:
            # Simple test message
            service = MCPService(provider.organization_id)
            
            # Use asyncio to run the async chat
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                service.chat(
                    messages=[{'role': 'user', 'content': 'Hello, this is a test.'}],
                    provider_id=provider.id
                )
            )
            loop.close()
            
            provider.last_tested_at = timezone.now()
            provider.last_test_success = result.get('success', False)
            provider.save()
            
            return Response({
                'success': result.get('success', False),
                'message': 'Connection successful' if result.get('success') else result.get('error')
            })
            
        except Exception as e:
            provider.last_tested_at = timezone.now()
            provider.last_test_success = False
            provider.save()
            
            return Response({
                'success': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this provider as default."""
        provider = self.get_object()
        
        # Unset all defaults
        MCPProvider.objects.filter(
            organization=provider.organization
        ).update(is_default=False)
        
        # Set this one as default
        provider.is_default = True
        provider.save()
        
        return Response({'success': True})


class MCPToolViewSet(viewsets.ModelViewSet):
    """CRUD for MCP tools."""
    serializer_class = MCPToolSerializer
    permission_classes = [IsAuthenticated, CanManageMCP]
    
    def get_queryset(self):
        return MCPTool.objects.filter(
            organization=self.request.user.organization
        )
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
    
    @action(detail=False, methods=['post'])
    def register_defaults(self, request):
        """Register default tools for this organization."""
        register_default_tools(request.user.organization.id)
        return Response({'success': True, 'message': 'Default tools registered'})


class MCPConversationViewSet(viewsets.ModelViewSet):
    """CRUD for conversations."""
    serializer_class = MCPConversationSerializer
    permission_classes = [IsAuthenticated, CanViewMCP]
    
    def get_queryset(self):
        queryset = MCPConversation.objects.filter(
            organization=self.request.user.organization
        ).select_related('user', 'provider')
        
        # Filter by user if not admin
        if not self.request.user.is_superuser:
            queryset = queryset.filter(user=self.request.user)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a conversation."""
        conversation = self.get_object()
        messages = MCPMessage.objects.filter(conversation=conversation)
        serializer = MCPMessageSerializer(messages, many=True)
        return Response(serializer.data)


class MCPUsageLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to usage logs."""
    serializer_class = MCPUsageLogSerializer
    permission_classes = [IsAuthenticated, CanViewMCP]
    
    def get_queryset(self):
        queryset = MCPUsageLog.objects.filter(
            organization=self.request.user.organization
        ).select_related('user', 'provider')
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset[:1000]


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


# =============================================================================
# DASHBOARD
# =============================================================================

class MCPDashboardView(APIView):
    """
    Dashboard statistics for MCP.
    """
    permission_classes = [IsAuthenticated, CanViewMCP]
    
    def get(self, request):
        org_id = request.user.organization_id
        
        # Get connection status
        connection = MCPConnection.objects.filter(organization_id=org_id).first()
        
        # Get provider count
        providers = MCPProvider.objects.filter(
            organization_id=org_id, is_active=True
        ).count()
        
        # Get tool count
        tools = MCPTool.objects.filter(
            organization_id=org_id, is_active=True
        ).count()
        
        # Usage stats (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        usage = MCPUsageLog.objects.filter(
            organization_id=org_id,
            created_at__gte=thirty_days_ago
        ).aggregate(
            total_requests=Count('id'),
            total_tokens=Sum('total_tokens'),
            total_cost=Sum('total_cost')
        )
        
        # Recent conversations
        recent_conversations = MCPConversation.objects.filter(
            organization_id=org_id
        ).order_by('-updated_at')[:5]
        
        return Response({
            'connection': MCPConnectionSerializer(connection).data if connection else None,
            'providers_count': providers,
            'tools_count': tools,
            'usage_30d': {
                'requests': usage['total_requests'] or 0,
                'tokens': usage['total_tokens'] or 0,
                'cost': float(usage['total_cost'] or 0)
            },
            'recent_conversations': MCPConversationSerializer(
                recent_conversations, many=True
            ).data
        })
