# Audit & Workflow Services
# Kernel-level services for the Platform Integrity system

from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import json


class AuditService:
    """
    Central service for logging all database mutations and sensitive data access.
    Usage:
        AuditService.log_event(
            actor=request.user,
            action='UPDATE',
            instance=product,
            new_data={'price': 100.00},
            request=request
        )
    """
    
    @staticmethod
    def log_event(actor, action, instance=None, table_name=None, record_id=None,
                  old_data=None, new_data=None, request=None, organization=None,
                  description='', metadata=None):
        """
        Log an audit event.
        
        Args:
            actor: User performing the action
            action: 'CREATE', 'UPDATE', 'DELETE', 'VIEW'
            instance: Model instance (optional, will extract table_name and record_id)
            table_name: Explicit table name (if instance not provided)
            record_id: Explicit record ID (if instance not provided)
            old_data: Previous state dict (for UPDATE/DELETE)
            new_data: New state dict (for CREATE/UPDATE)
            request: HTTP request object (for IP/user-agent extraction)
            organization: Organization scope
            description: Human-readable description
            metadata: Additional context dict
        """
        from .models_audit import AuditLog
        
        # Extract table_name and record_id from instance if provided
        if instance:
            table_name = table_name or instance._meta.db_table
            record_id = str(getattr(instance, 'id', getattr(instance, 'pk', '')))
            if not organization and hasattr(instance, 'organization'):
                organization = instance.organization
        
        # Extract request metadata
        ip_address = None
        user_agent = ''
        if request:
            ip_address = AuditService._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        
        # Get actor role
        actor_role = ''
        if actor and hasattr(actor, 'role') and actor.role:
            actor_role = actor.role.name
        
        # Serialize data
        old_value = AuditService._serialize(old_data)
        new_value = AuditService._serialize(new_data)
        
        # Create audit log entry
        log = AuditLog.objects.create(
            actor=actor,
            actor_role=actor_role,
            action=action,
            table_name=table_name or 'unknown',
            record_id=str(record_id or ''),
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
            organization=organization,
            description=description,
            metadata=metadata or {}
        )
        
        return log
    
    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request, handling proxies."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
    
    @staticmethod
    def _serialize(data):
        """Serialize data for JSONB storage."""
        if data is None:
            return None
        if isinstance(data, dict):
            return data
        # Try to convert model instance to dict
        if hasattr(data, '__dict__'):
            return {k: str(v) for k, v in data.__dict__.items() if not k.startswith('_')}
        return {'value': str(data)}
    
    @staticmethod
    def get_history(table_name, record_id, organization):
        """Get audit history for a specific record."""
        from .models_audit import AuditLog
        return AuditLog.objects.filter(
            table_name=table_name,
            record_id=str(record_id),
            organization=organization
        ).order_by('-timestamp')
    
    @staticmethod
    def get_user_activity(user, organization, limit=50):
        """Get recent activity for a user."""
        from .models_audit import AuditLog
        return AuditLog.objects.filter(
            actor=user,
            organization=organization
        ).order_by('-timestamp')[:limit]


class WorkflowService:
    """
    Service for managing approval workflows and task generation.
    
    Usage:
        result = WorkflowService.check_workflow(
            event_type='product.price_change',
            actor=request.user,
            payload={'product_id': 123, 'new_price': 50.00},
            organization=org
        )
        if result.requires_hold:
            # Don't apply the change yet
            return Response({'approval_required': True, 'request_id': result.request_id})
        else:
            # Apply the change
            apply_change(payload)
    """
    
    @staticmethod
    def check_workflow(event_type, actor, payload, organization, target_table='', target_id='', priority=5):
        """
        Check if an event requires approval and handle accordingly.
        
        Returns:
            WorkflowResult with:
                - requires_hold: True if change should be held
                - request_id: UUID of ApprovalRequest if created
                - workflow: WorkflowDefinition if matched
        """
        from .models_audit import WorkflowDefinition, ApprovalRequest, ApprovalMode
        
        # Find matching workflow
        workflow = WorkflowDefinition.objects.filter(
            event_type=event_type,
            is_active=True,
            priority_threshold__lte=priority
        ).first()
        
        if not workflow or not workflow.requires_approval:
            return WorkflowResult(requires_hold=False)
        
        # Check if actor can bypass
        if actor and actor.role:
            if workflow.bypass_roles.filter(id=actor.role.id).exists():
                return WorkflowResult(requires_hold=False, workflow=workflow)
        
        # Determine if we need to hold
        requires_hold = workflow.approval_mode == ApprovalMode.PRE
        
        # Create approval request
        approval = ApprovalRequest.objects.create(
            workflow=workflow,
            requested_by=actor,
            payload=payload,
            target_table=target_table,
            target_id=str(target_id),
            organization=organization
        )
        
        return WorkflowResult(
            requires_hold=requires_hold,
            request_id=approval.id,
            workflow=workflow,
            approval_request=approval
        )
    
    @staticmethod
    def approve(request_id, reviewer, notes=''):
        """
        Approve an approval request.
        
        Returns:
            Tuple of (ApprovalRequest, list of generated tasks)
        """
        from .models_audit import ApprovalRequest, ApprovalStatus
        
        approval = ApprovalRequest.objects.select_related('workflow').get(id=request_id)
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request is already {approval.status}")
        
        with transaction.atomic():
            approval.status = ApprovalStatus.APPROVED
            approval.reviewed_by = reviewer
            approval.reviewed_at = timezone.now()
            approval.review_notes = notes
            approval.save()
            
            # Generate tasks if configured
            tasks = []
            if approval.workflow.generates_task and approval.workflow.task_template:
                task = WorkflowService.create_task_from_template(
                    template=approval.workflow.task_template,
                    context=approval.payload,
                    source_approval=approval,
                    organization=approval.organization
                )
                tasks.append(task)
        
        return approval, tasks
    
    @staticmethod
    def reject(request_id, reviewer, notes=''):
        """Reject an approval request."""
        from .models_audit import ApprovalRequest, ApprovalStatus
        
        approval = ApprovalRequest.objects.get(id=request_id)
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request is already {approval.status}")
        
        approval.status = ApprovalStatus.REJECTED
        approval.reviewed_by = reviewer
        approval.reviewed_at = timezone.now()
        approval.review_notes = notes
        approval.save()
        
        return approval
    
    @staticmethod
    def create_task_from_template(template, context, source_approval=None, source_audit=None, organization=None):
        """Create a task from a template."""
        from .models_audit import TaskQueue
        
        # Generate title from template
        title = template.title_template.format(
            action=template.name,
            record=context.get('record_id', context.get('id', 'Record')),
            user=context.get('user', 'User')
        )
        
        # Calculate due date
        due_at = timezone.now() + timedelta(hours=template.due_hours)
        
        task = TaskQueue.objects.create(
            template=template,
            title=title,
            description=template.description,
            assigned_to_role=template.default_assignee_role,
            priority=template.priority,
            due_at=due_at,
            source_approval=source_approval,
            source_audit_log=source_audit,
            context=context,
            organization=organization or (source_approval.organization if source_approval else None)
        )
        
        return task
    
    @staticmethod
    def complete_task(task_id, user):
        """Mark a task as completed."""
        from .models_audit import TaskQueue, TaskStatus
        
        task = TaskQueue.objects.get(id=task_id)
        task.status = TaskStatus.COMPLETED
        task.completed_at = timezone.now()
        task.save()
        
        return task
    
    @staticmethod
    def get_pending_approvals(organization, for_role=None):
        """Get pending approval requests, optionally filtered by approver role."""
        from .models_audit import ApprovalRequest, ApprovalStatus
        
        qs = ApprovalRequest.objects.filter(
            organization=organization,
            status=ApprovalStatus.PENDING
        ).select_related('workflow', 'requested_by')
        
        if for_role:
            qs = qs.filter(workflow__approver_role=for_role)
        
        return qs.order_by('-requested_at')
    
    @staticmethod
    def get_pending_tasks(organization, for_user=None, for_role=None):
        """Get pending tasks for a user or role."""
        from .models_audit import TaskQueue, TaskStatus
        from django.db.models import Q
        
        qs = TaskQueue.objects.filter(
            organization=organization,
            status__in=[TaskStatus.PENDING, TaskStatus.IN_PROGRESS]
        )
        
        if for_user:
            qs = qs.filter(Q(assigned_to_user=for_user) | Q(assigned_to_role=for_user.role))
        elif for_role:
            qs = qs.filter(assigned_to_role=for_role)
        
        return qs.order_by('-priority', 'due_at')


class WorkflowResult:
    """Result object from workflow check."""
    def __init__(self, requires_hold=False, request_id=None, workflow=None, approval_request=None):
        self.requires_hold = requires_hold
        self.request_id = request_id
        self.workflow = workflow
        self.approval_request = approval_request
