# Audit & Workflow ViewSets

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models_audit import (
    AuditLog, WorkflowDefinition, ApprovalRequest, 
    TaskTemplate, TaskQueue, ApprovalStatus, TaskStatus
)
from .serializers_audit import (
    AuditLogSerializer, WorkflowDefinitionSerializer, ApprovalRequestSerializer,
    ApprovalActionSerializer, TaskTemplateSerializer, TaskQueueSerializer, TaskActionSerializer
)
from .services_audit import AuditService, WorkflowService
from .permissions import IsOrgAdmin


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing audit logs. Read-only access.
    Only organization admins can view audit logs.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    
    def get_queryset(self):
        org_id = self.request.headers.get('X-Organization-ID')
        if not org_id:
            return AuditLog.objects.none()
        return AuditLog.objects.filter(organization_id=org_id)
    
    @action(detail=False, methods=['get'])
    def record_history(self, request):
        """Get audit history for a specific record."""
        table_name = request.query_params.get('table')
        record_id = request.query_params.get('id')
        org_id = request.headers.get('X-Organization-ID')
        
        if not all([table_name, record_id, org_id]):
            return Response({'error': 'Missing table, id, or organization'}, status=400)
        
        from .models import Organization
        org = Organization.objects.get(id=org_id)
        logs = AuditService.get_history(table_name, record_id, org)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_activity(self, request):
        """Get current user's recent activity."""
        org_id = request.headers.get('X-Organization-ID')
        from .models import Organization
        org = Organization.objects.get(id=org_id)
        logs = AuditService.get_user_activity(request.user, org)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing workflow definitions.
    Only organization admins can modify workflows.
    """
    serializer_class = WorkflowDefinitionSerializer
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    
    def get_queryset(self):
        return WorkflowDefinition.objects.filter(is_active=True)


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing approval requests.
    """
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        org_id = self.request.headers.get('X-Organization-ID')
        if not org_id:
            return ApprovalRequest.objects.none()
        
        qs = ApprovalRequest.objects.filter(organization_id=org_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by "for me" - approvals I can review
        if self.request.query_params.get('for_me') == 'true':
            user_role = self.request.user.role
            if user_role:
                qs = qs.filter(workflow__approver_role=user_role, status=ApprovalStatus.PENDING)
        
        return qs.select_related('workflow', 'requested_by', 'reviewed_by')
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an approval request."""
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            approval, tasks = WorkflowService.approve(
                request_id=pk,
                reviewer=request.user,
                notes=serializer.validated_data.get('notes', '')
            )
            return Response({
                'status': 'approved',
                'approval': ApprovalRequestSerializer(approval).data,
                'tasks_created': len(tasks)
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an approval request."""
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            approval = WorkflowService.reject(
                request_id=pk,
                reviewer=request.user,
                notes=serializer.validated_data.get('notes', '')
            )
            return Response({
                'status': 'rejected',
                'approval': ApprovalRequestSerializer(approval).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


class TaskTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing task templates.
    """
    serializer_class = TaskTemplateSerializer
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    
    def get_queryset(self):
        return TaskTemplate.objects.filter(is_active=True)


class TaskQueueViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tasks.
    """
    serializer_class = TaskQueueSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        org_id = self.request.headers.get('X-Organization-ID')
        if not org_id:
            return TaskQueue.objects.none()
        
        qs = TaskQueue.objects.filter(organization_id=org_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by "my tasks"
        if self.request.query_params.get('my_tasks') == 'true':
            from django.db.models import Q
            qs = qs.filter(
                Q(assigned_to_user=self.request.user) | 
                Q(assigned_to_role=self.request.user.role)
            )
        
        return qs.select_related('template', 'assigned_to_role', 'assigned_to_user')
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update task status (start, complete, cancel)."""
        serializer = TaskActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        task = self.get_object()
        action_type = serializer.validated_data['action']
        
        if action_type == 'start':
            task.status = TaskStatus.IN_PROGRESS
            task.started_at = timezone.now()
        elif action_type == 'complete':
            task.status = TaskStatus.COMPLETED
            task.completed_at = timezone.now()
        elif action_type == 'cancel':
            task.status = TaskStatus.CANCELLED
        
        task.save()
        return Response(TaskQueueSerializer(task).data)
    
    @action(detail=False, methods=['get'])
    def my_pending(self, request):
        """Get my pending tasks."""
        org_id = request.headers.get('X-Organization-ID')
        from .models import Organization
        org = Organization.objects.get(id=org_id)
        
        tasks = WorkflowService.get_pending_tasks(org, for_user=request.user)
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)
