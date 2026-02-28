from rest_framework import serializers
from .models import *


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


class MCPAgentSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = MCPAgent
        fields = [
            'id', 'name', 'role', 'role_display', 'persona', 'provider',
            'provider_name', 'is_active', 'status', 'auto_execute',
            'frequency_minutes', 'last_run_at', 'next_run_at',
            'created_at', 'updated_at'
        ]


class MCPAgentLogSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.name', read_only=True)

    class Meta:
        model = MCPAgentLog
        fields = [
            'id', 'agent', 'agent_name', 'level', 'message',
            'data', 'created_at'
        ]
