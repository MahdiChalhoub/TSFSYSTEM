"""
Audit & Workflow Models
========================
Maps to existing DB tables created by migration 0025.
These models support:
  - AuditLog: Records all data mutations with before/after JSON
  - WorkflowDefinition: Configurable approval rules per event type
  - ApprovalRequest: Tracks pending/resolved approval requests
  - TaskTemplate: Reusable task definitions
  - TaskQueue: Individual task instances
  - ForensicAuditLog: Immutable forensic audit trail
"""

import uuid
from django.db import models
from django.conf import settings


class ApprovalMode(models.TextChoices):
    PRE = 'PRE', 'Pre-approval (blocks action)'
    POST = 'POST', 'Post-action (audit only)'


class LegacyAuditLog(models.Model):
    """Records data mutations with before/after JSON snapshots.

    NOTE: Renamed from AuditLog to avoid app-registry collision with
    kernel.audit.models.AuditLog (both forced into app_label='erp').
    Imports across erp/* alias this back to `AuditLog` for compatibility.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audit_logs'
    )
    actor_role = models.CharField(max_length=100, blank=True, default='')
    action = models.CharField(max_length=50)  # CREATE, UPDATE, DELETE
    table_name = models.CharField(max_length=100, db_column='table_name')
    record_id = models.CharField(max_length=255, blank=True, default='')
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default='')
    description = models.TextField(blank=True, default='')
    metadata = models.JSONField(null=True, blank=True)
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='audit_logs'
    )

    class Meta:
        db_table = 'auditlog'
        ordering = ['-timestamp']
        managed = False  # Table already exists

    # Map from AuditLogMixin field names to actual DB columns
    @classmethod
    def create_from_mixin(cls, organization_id=None, user=None, action='', 
                          entity_type='', entity_id='', new_data=None, 
                          old_data=None, ip_address=None, user_agent=''):
        """Create entry using the field names from AuditLogMixin."""
        return cls.objects.create(
            organization_id=organization_id,
            actor=user,
            action=action,
            table_name=entity_type,
            record_id=entity_id or '',
            new_value=new_data,
            old_value=old_data,
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )


class TaskTemplate(models.Model):
    """Reusable task definitions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    priority = models.IntegerField(default=5)
    due_hours = models.IntegerField(default=24)
    title_template = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    default_assignee_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='task_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tasktemplate'
        managed = False


class WorkflowDefinition(models.Model):
    """Configurable approval rules per event type."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    requires_approval = models.BooleanField(default=True)
    approval_mode = models.CharField(max_length=10, choices=ApprovalMode.choices, default=ApprovalMode.PRE)
    priority_threshold = models.IntegerField(default=5)
    generates_task = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    approver_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='workflow_approvals'
    )
    task_template = models.ForeignKey(
        TaskTemplate, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='workflows'
    )
    bypass_roles = models.ManyToManyField(
        'erp.Role', blank=True, related_name='bypassed_workflows'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workflowdefinition'
        managed = False


class ApprovalRequest(models.Model):
    """Tracks pending/resolved approval requests."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE,
        null=True, blank=True, related_name='requests'
    )
    audit_log = models.ForeignKey(
        LegacyAuditLog, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approval_requests'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approval_requests_made'
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approval_requests_reviewed'
    )
    payload = models.JSONField(null=True, blank=True)
    target_table = models.CharField(max_length=100, blank=True, default='')
    target_id = models.CharField(max_length=255, blank=True, default='')
    review_notes = models.TextField(blank=True, default='')
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='approval_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'approvalrequest'
        ordering = ['-created_at']
        managed = False


class TaskQueue(models.Model):
    """Individual task instances."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    priority = models.IntegerField(default=5)
    template = models.ForeignKey(
        TaskTemplate, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks'
    )
    assigned_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_tasks'
    )
    assigned_to_role = models.ForeignKey(
        'erp.Role', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_tasks'
    )
    source_approval = models.ForeignKey(
        ApprovalRequest, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks'
    )
    source_audit_log = models.ForeignKey(
        LegacyAuditLog, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks'
    )
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        null=True, blank=True, related_name='task_queue'
    )
    context = models.JSONField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'taskqueue'
        ordering = ['-created_at']
        managed = False


class ForensicAuditLog(models.Model):
    """Immutable forensic audit trail — never deleted."""
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=255)
    change_type = models.CharField(max_length=50)
    payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    organization = models.ForeignKey(
        'erp.Organization', on_delete=models.CASCADE,
        null=True, blank=True
    )

    class Meta:
        db_table = 'forensicauditlog'
        ordering = ['-timestamp']
        managed = False


# Backward-compat alias — the legacy class was renamed to LegacyAuditLog
# to avoid app-registry collision with kernel.audit.models.AuditLog.
# Existing imports `from .models_audit import AuditLog` continue to work.
AuditLog = LegacyAuditLog
