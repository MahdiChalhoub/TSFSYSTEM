"""
MCP AI Connector - Django Models
================================
Model Context Protocol integration for AI assistants.

Architecture:
    External AI → MCP Server → Django API → Business Logic
"""

from django.db import models
from django.utils import timezone
from datetime import timedelta
import json


class MCPProvider(models.Model):
    """
    AI Provider configuration (OpenAI, Anthropic, Google, Azure, etc.)
    Each organization can configure multiple providers.
    """
    
    PROVIDER_TYPES = [
        ('openai', 'OpenAI'),
        ('anthropic', 'Anthropic (Claude)'),
        ('google', 'Google (Gemini)'),
        ('azure', 'Azure OpenAI'),
        ('ollama', 'Ollama (Local)'),
        ('custom', 'Custom API'),
    ]
    
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_providers'
    )
    
    name = models.CharField(max_length=100)
    provider_type = models.CharField(max_length=20, choices=PROVIDER_TYPES)
    
    # Connection settings
    api_key = models.TextField(blank=True, help_text="Encrypted API key")
    api_base_url = models.URLField(blank=True, help_text="Custom API endpoint")
    model_name = models.CharField(max_length=100, default='gpt-4')
    
    # Configuration
    max_tokens = models.IntegerField(default=4096)
    temperature = models.FloatField(default=0.7)
    timeout_seconds = models.IntegerField(default=30)
    
    # State
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_success = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mcpprovider'
        unique_together = ['organization', 'name']
        ordering = ['-is_default', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.provider_type})"


class MCPTool(models.Model):
    """
    Tools exposed to AI via MCP protocol.
    Maps AI tool calls to internal API endpoints.
    """
    
    TOOL_CATEGORIES = [
        ('inventory', 'Inventory'),
        ('finance', 'Finance'),
        ('pos', 'Point of Sale'),
        ('crm', 'CRM'),
        ('hr', 'Human Resources'),
        ('system', 'System'),
        ('custom', 'Custom'),
    ]
    
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_tools',
        null=True,  # null = global tool
        blank=True
    )
    
    name = models.CharField(max_length=100)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=TOOL_CATEGORIES)
    
    # API mapping
    internal_endpoint = models.CharField(max_length=255)
    http_method = models.CharField(max_length=10, default='GET')
    
    # Parameters schema (JSON Schema format)
    parameters_schema = models.JSONField(default=dict)
    
    # Permissions required
    required_permissions = models.JSONField(
        default=list,
        help_text="List of permission codes required to use this tool"
    )
    
    # State
    is_active = models.BooleanField(default=True)
    requires_confirmation = models.BooleanField(
        default=False,
        help_text="Require user confirmation before execution"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mcptool'
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.category})"
    
    def to_mcp_schema(self):
        """Convert to MCP tool schema format."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters_schema
        }


class MCPConnection(models.Model):
    """
    Active MCP server connection per organization.
    Manages the MCP server instance state.
    """
    
    STATUS_CHOICES = [
        ('inactive', 'Inactive'),
        ('starting', 'Starting'),
        ('running', 'Running'),
        ('error', 'Error'),
        ('stopped', 'Stopped'),
    ]
    
    organization = models.OneToOneField(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_connection'
    )
    
    provider = models.ForeignKey(
        MCPProvider,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='inactive')
    server_url = models.URLField(blank=True)
    server_port = models.IntegerField(null=True, blank=True)
    
    # Statistics
    total_requests = models.IntegerField(default=0)
    total_tokens_used = models.IntegerField(default=0)
    last_request_at = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    last_error = models.TextField(blank=True)
    error_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mcpconnection'
    
    def __str__(self):
        return f"MCP Connection: {self.organization.name} [{self.status}]"


class MCPConversation(models.Model):
    """
    AI conversation session.
    Groups messages into logical conversations.
    """
    
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_conversations'
    )
    user = models.ForeignKey(
        'erp.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='mcp_conversations'
    )
    provider = models.ForeignKey(
        MCPProvider,
        on_delete=models.SET_NULL,
        null=True
    )
    
    title = models.CharField(max_length=255, blank=True)
    context = models.JSONField(
        default=dict,
        help_text="Conversation context/memory"
    )
    
    # Statistics
    message_count = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    total_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    
    # State
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mcpconversation'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"Conversation: {self.title or self.id}"


class MCPMessage(models.Model):
    """
    Individual message in a conversation.
    """
    
    ROLE_CHOICES = [
        ('system', 'System'),
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('tool', 'Tool'),
    ]
    
    conversation = models.ForeignKey(
        MCPConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    
    # Tool call data
    tool_calls = models.JSONField(
        default=list,
        help_text="Tool calls made by AI"
    )
    tool_call_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="ID if this is a tool response"
    )
    
    # Token usage
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'mcpmessage'
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class MCPUsageLog(models.Model):
    """
    Detailed usage tracking for billing and monitoring.
    """
    
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_usage_logs'
    )
    user = models.ForeignKey(
        'erp.User',
        on_delete=models.SET_NULL,
        null=True
    )
    provider = models.ForeignKey(
        MCPProvider,
        on_delete=models.SET_NULL,
        null=True
    )
    conversation = models.ForeignKey(
        MCPConversation,
        on_delete=models.SET_NULL,
        null=True
    )
    
    # Request details
    model_name = models.CharField(max_length=100)
    endpoint = models.CharField(max_length=255)
    
    # Token usage
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    
    # Cost calculation
    cost_per_input_token = models.DecimalField(max_digits=10, decimal_places=8, default=0)
    cost_per_output_token = models.DecimalField(max_digits=10, decimal_places=8, default=0)
    total_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    
    # Performance
    response_time_ms = models.IntegerField(null=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'mcpusagelog'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'created_at']),
            models.Index(fields=['provider', 'created_at']),
        ]
    
    def __str__(self):
        return f"Usage: {self.model_name} - {self.total_tokens} tokens"


class MCPRateLimit(models.Model):
    """
    Rate limiting configuration per organization/user.
    """
    
    LIMIT_TYPES = [
        ('requests_per_minute', 'Requests per Minute'),
        ('requests_per_hour', 'Requests per Hour'),
        ('requests_per_day', 'Requests per Day'),
        ('tokens_per_day', 'Tokens per Day'),
        ('cost_per_day', 'Cost per Day'),
    ]
    
    organization = models.ForeignKey(
        'erp.Organization',
        on_delete=models.CASCADE,
        related_name='mcp_rate_limits'
    )
    user = models.ForeignKey(
        'erp.User',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="If null, applies to entire organization"
    )
    
    limit_type = models.CharField(max_length=30, choices=LIMIT_TYPES)
    limit_value = models.IntegerField()
    current_usage = models.IntegerField(default=0)
    reset_at = models.DateTimeField()
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mcpratelimit'
        unique_together = ['organization', 'user', 'limit_type']
    
    def __str__(self):
        target = self.user.email if self.user else self.organization.name
        return f"Limit: {target} - {self.limit_type}"
    
    def check_limit(self):
        """Check if limit is exceeded."""
        if timezone.now() >= self.reset_at:
            self.current_usage = 0
            self._set_next_reset()
            self.save()
        return self.current_usage < self.limit_value
    
    def _set_next_reset(self):
        """Set next reset time based on limit type."""
        now = timezone.now()
        if 'minute' in self.limit_type:
            self.reset_at = now + timedelta(minutes=1)
        elif 'hour' in self.limit_type:
            self.reset_at = now + timedelta(hours=1)
        else:
            self.reset_at = now + timedelta(days=1)
