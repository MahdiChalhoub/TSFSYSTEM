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


class MCPAgentViewSet(viewsets.ModelViewSet):
    """CRUD for autonomous agents."""
    serializer_class = MCPAgentSerializer
    permission_classes = [IsAuthenticated, CanManageAgents]
    
    def get_queryset(self):
        return MCPAgent.objects.filter(
            organization=self.request.user.organization
        ).select_related('provider')
    
    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=True, methods=['post'])
    def run_now(self, request, pk=None):
        """Manually trigger the agent."""
        agent = self.get_object()
        
        # Check if provider exists, if not, create a mock log to show UI working
        provider = MCPProvider.objects.filter(organization=agent.organization, is_active=True).first()
        
        if not provider:
             # Simulation mode
             agent.status = 'running'
             agent.save()
             
             MCPAgentLog.objects.create(
                 agent=agent,
                 organization=agent.organization,
                 level='info',
                 message=f"Agent starting in SIMULATION MODE (No AI Provider configured)."
             )
             
             MCPAgentLog.objects.create(
                 agent=agent,
                 organization=agent.organization,
                 level='thought',
                 message=f"I am analyzing the current stock levels... everything looks stable for now. I recommend checking back once an AI Provider is linked."
             )
             
             agent.status = 'idle'
             agent.last_run_at = timezone.now()
             agent.save()
             
             return Response({
                 'success': True, 
                 'message': f'Agent {agent.name} completed a simulation run. Add an AI Provider to enable real intelligence.'
             })

        # Real execution
        run_agent_sync(agent.id)
        
        return Response({'success': True, 'message': f'Agent {agent.name} task executed.'})


class MCPAgentLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to agent execution logs."""
    serializer_class = MCPAgentLogSerializer
    permission_classes = [IsAuthenticated, CanViewMCP]
    
    def get_queryset(self):
        queryset = MCPAgentLog.objects.filter(
            organization=self.request.user.organization
        ).select_related('agent')
        
        agent_id = self.request.query_params.get('agent_id')
        if agent_id:
            queryset = queryset.filter(agent_id=agent_id)
            
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(level=level)
            
        return queryset[:500]


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
        connection = MCPConnection.objects.filter(tenant_id=org_id).first()
        
        # Get provider count
        providers = MCPProvider.objects.filter(
            tenant_id=org_id, is_active=True
        ).count()
        
        # Get tool count
        tools = MCPTool.objects.filter(
            tenant_id=org_id, is_active=True
        ).count()
        
        # Usage stats (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        usage = MCPUsageLog.objects.filter(
            tenant_id=org_id,
            created_at__gte=thirty_days_ago
        ).aggregate(
            total_requests=Count('id'),
            total_tokens=Sum('total_tokens'),
            total_cost=Sum('total_cost')
        )
        
        # Recent conversations
        recent_conversations = MCPConversation.objects.filter(
            tenant_id=org_id
        ).order_by('-updated_at')[:5]
        
        # Get agents count
        agents_count = MCPAgent.objects.filter(
            tenant_id=org_id, is_active=True
        ).count()
        
        return Response({
            'connection': MCPConnectionSerializer(connection).data if connection else None,
            'providers_count': providers,
            'tools_count': tools,
            'agents_count': agents_count,
            'usage_30d': {
                'requests': usage['total_requests'] or 0,
                'tokens': usage['total_tokens'] or 0,
                'cost': float(usage['total_cost'] or 0)
            },
            'recent_conversations': MCPConversationSerializer(
                recent_conversations, many=True
            ).data
        })
