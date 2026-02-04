# Audit & Workflow Serializers

from rest_framework import serializers
from .models_audit import (
    AuditLog, WorkflowDefinition, ApprovalRequest, 
    TaskTemplate, TaskQueue
)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'timestamp', 'actor', 'actor_username', 'actor_role',
            'action', 'table_name', 'record_id',
            'old_value', 'new_value', 'ip_address',
            'description', 'metadata'
        ]
        read_only_fields = fields


class WorkflowDefinitionSerializer(serializers.ModelSerializer):
    approver_role_name = serializers.CharField(source='approver_role.name', read_only=True)
    task_template_name = serializers.CharField(source='task_template.name', read_only=True)
    
    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'event_type', 'name', 'description',
            'requires_approval', 'approval_mode',
            'approver_role', 'approver_role_name',
            'priority_threshold', 'generates_task',
            'task_template', 'task_template_name',
            'is_active', 'created_at', 'updated_at'
        ]


class ApprovalRequestSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    workflow_event_type = serializers.CharField(source='workflow.event_type', read_only=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True)
    
    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'workflow', 'workflow_name', 'workflow_event_type',
            'status', 'requested_by', 'requested_by_username',
            'reviewed_by', 'reviewed_by_username',
            'requested_at', 'reviewed_at',
            'payload', 'target_table', 'target_id', 'review_notes'
        ]
        read_only_fields = [
            'id', 'workflow_name', 'workflow_event_type',
            'requested_by_username', 'reviewed_by_username',
            'requested_at', 'reviewed_at'
        ]


class ApprovalActionSerializer(serializers.Serializer):
    """Serializer for approve/reject actions."""
    notes = serializers.CharField(required=False, allow_blank=True)


class TaskTemplateSerializer(serializers.ModelSerializer):
    default_assignee_role_name = serializers.CharField(source='default_assignee_role.name', read_only=True)
    
    class Meta:
        model = TaskTemplate
        fields = [
            'id', 'name', 'description',
            'default_assignee_role', 'default_assignee_role_name',
            'priority', 'due_hours', 'title_template',
            'is_active', 'created_at', 'updated_at'
        ]


class TaskQueueSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    assigned_to_role_name = serializers.CharField(source='assigned_to_role.name', read_only=True)
    assigned_to_user_username = serializers.CharField(source='assigned_to_user.username', read_only=True)
    
    class Meta:
        model = TaskQueue
        fields = [
            'id', 'template', 'template_name',
            'title', 'description',
            'assigned_to_role', 'assigned_to_role_name',
            'assigned_to_user', 'assigned_to_user_username',
            'status', 'priority',
            'due_at', 'created_at', 'started_at', 'completed_at',
            'context'
        ]
        read_only_fields = ['id', 'created_at', 'started_at', 'completed_at']


class TaskActionSerializer(serializers.Serializer):
    """Serializer for task actions (start, complete, cancel)."""
    action = serializers.ChoiceField(choices=['start', 'complete', 'cancel'])
