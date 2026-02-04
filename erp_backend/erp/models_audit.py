# Audit & Workflow Engine Models
# Kernel-level models for the Platform Integrity system

from django.db import models
import uuid


class AuditAction(models.TextChoices):
    CREATE = 'CREATE', 'Create'
    UPDATE = 'UPDATE', 'Update'
    DELETE = 'DELETE', 'Delete'
    VIEW = 'VIEW', 'View'


class ApprovalMode(models.TextChoices):
    PRE = 'PRE', 'Pre-Approval (Hold until approved)'
    POST = 'POST', 'Post-Approval (Apply, then review)'


class ApprovalStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class TaskStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class AuditLog(models.Model):
    """
    Universal audit log for tracking all database mutations and sensitive data access.
    This is a Kernel-level model that applies to all Engine modules.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Actor information
    actor = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    actor_role = models.CharField(max_length=100, blank=True, help_text="Role of the actor at time of event")
    
    # Action details
    action = models.CharField(max_length=10, choices=AuditAction.choices)
    table_name = models.CharField(max_length=100, db_index=True)
    record_id = models.CharField(max_length=100)
    
    # Data snapshots
    old_value = models.JSONField(null=True, blank=True, help_text="Previous state (for UPDATE/DELETE)")
    new_value = models.JSONField(null=True, blank=True, help_text="New state (for CREATE/UPDATE)")
    
    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    # Tenant scope
    organization = models.ForeignKey('erp.Organization', on_delete=models.CASCADE, related_name='audit_logs')
    
    # Optional context
    description = models.TextField(blank=True, help_text="Human-readable description of the action")
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional context")

    class Meta:
        db_table = 'AuditLog'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['organization', 'timestamp']),
            models.Index(fields=['table_name', 'record_id']),
            models.Index(fields=['actor', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.action} on {self.table_name}:{self.record_id} by {self.actor}"


class WorkflowDefinition(models.Model):
    """
    Defines approval rules for specific event types.
    Example events: product.price_change, invoice.delete, stock.adjust
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Event identification
    event_type = models.CharField(max_length=100, unique=True, db_index=True,
                                   help_text="e.g., 'product.price_change', 'invoice.delete'")
    name = models.CharField(max_length=255, help_text="Human-readable name")
    description = models.TextField(blank=True)
    
    # Approval configuration
    requires_approval = models.BooleanField(default=False)
    approval_mode = models.CharField(max_length=4, choices=ApprovalMode.choices, default=ApprovalMode.POST)
    approver_role = models.ForeignKey('erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='workflow_definitions',
                                       help_text="Role required to approve this workflow")
    
    # Priority-based overrides
    priority_threshold = models.IntegerField(default=0,
                                              help_text="Events with priority >= this value require this workflow")
    bypass_roles = models.ManyToManyField('erp.Role', blank=True, related_name='bypassed_workflows',
                                           help_text="Roles that can bypass this approval requirement")
    
    # Task generation
    generates_task = models.BooleanField(default=False)
    task_template = models.ForeignKey('TaskTemplate', on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='workflow_definitions')
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'WorkflowDefinition'
        ordering = ['event_type']

    def __str__(self):
        return f"{self.name} ({self.event_type})"


class ApprovalRequest(models.Model):
    """
    Tracks pending, approved, and rejected approval requests.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Workflow reference
    workflow = models.ForeignKey(WorkflowDefinition, on_delete=models.CASCADE, related_name='approval_requests')
    
    # Status tracking
    status = models.CharField(max_length=10, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    
    # Actor information
    requested_by = models.ForeignKey('erp.User', on_delete=models.CASCADE, related_name='submitted_approvals')
    reviewed_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='reviewed_approvals')
    
    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # The data change
    payload = models.JSONField(help_text="The data change to be applied")
    target_table = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100, blank=True)
    
    # Review notes
    review_notes = models.TextField(blank=True)
    
    # Audit trail link
    audit_log = models.ForeignKey(AuditLog, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='approval_requests')
    
    # Tenant scope
    organization = models.ForeignKey('erp.Organization', on_delete=models.CASCADE, related_name='approval_requests')

    class Meta:
        db_table = 'ApprovalRequest'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['requested_by', 'status']),
        ]

    def __str__(self):
        return f"{self.workflow.event_type} by {self.requested_by} ({self.status})"


class TaskTemplate(models.Model):
    """
    Defines reusable task templates for workflow-generated tasks.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=200, help_text="e.g., 'Print Etiquette'")
    description = models.TextField(blank=True)
    
    # Default assignment
    default_assignee_role = models.ForeignKey('erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
                                               related_name='default_task_templates')
    
    # Task configuration
    priority = models.IntegerField(default=5, help_text="1=Low, 5=Normal, 10=Urgent")
    due_hours = models.IntegerField(default=24, help_text="Default hours until due")
    
    # Template for title generation
    title_template = models.CharField(max_length=300, default="{action} for {record}",
                                       help_text="Placeholders: {action}, {record}, {user}")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'TaskTemplate'

    def __str__(self):
        return self.name


class TaskQueue(models.Model):
    """
    Individual tasks generated from workflows or manually created.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Task definition
    template = models.ForeignKey(TaskTemplate, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='tasks')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    
    # Assignment
    assigned_to_role = models.ForeignKey('erp.Role', on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='assigned_tasks')
    assigned_to_user = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='assigned_tasks')
    
    # Status
    status = models.CharField(max_length=15, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    priority = models.IntegerField(default=5)
    
    # Timestamps
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Traceability
    source_audit_log = models.ForeignKey(AuditLog, on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='generated_tasks')
    source_approval = models.ForeignKey(ApprovalRequest, on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='generated_tasks')
    
    # Context
    context = models.JSONField(default=dict, blank=True, help_text="Additional task context/data")
    
    # Tenant scope
    organization = models.ForeignKey('erp.Organization', on_delete=models.CASCADE, related_name='task_queue')

    class Meta:
        db_table = 'TaskQueue'
        ordering = ['-priority', 'due_at', 'created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['assigned_to_user', 'status']),
            models.Index(fields=['assigned_to_role', 'status']),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"
