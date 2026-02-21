"""
MCP AI Connector - URL Routes
=============================
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MCPProviderViewSet, MCPToolViewSet, MCPConversationViewSet,
    MCPUsageLogViewSet, MCPChatView, MCPToolExecuteView, MCPDashboardView
)

router = DefaultRouter()
router.register(r'providers', MCPProviderViewSet, basename='mcp-providers')
router.register(r'tools', MCPToolViewSet, basename='mcp-tools')
router.register(r'conversations', MCPConversationViewSet, basename='mcp-conversations')
router.register(r'usage', MCPUsageLogViewSet, basename='mcp-usage')

urlpatterns = [
    path('chat/', MCPChatView.as_view(), name='mcp-chat'),
    path('tools/execute/', MCPToolExecuteView.as_view(), name='mcp-tool-execute'),
    path('dashboard/', MCPDashboardView.as_view(), name='mcp-dashboard'),
    path('', include(router.urls)),
]
