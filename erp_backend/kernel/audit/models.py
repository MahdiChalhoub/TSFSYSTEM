"""
Audit Models

AuditLog: Request-level audit trail
AuditTrail: Field-level change tracking
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import JSONField
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel

User = get_user_model()


class AuditLog(TenantOwnedModel):
    """
    Layer 1 & 4: Request-level and business event audit

    Tracks:
    - WHO: user, IP address, user agent
    - WHAT: action, resource type, resource ID
    - WHEN: timestamp
    - CONTEXT: HTTP method, path, business context
    """

    # WHO
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    username = models.CharField(max_length=150, blank=True)  # Denormalized for deleted users
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # WHAT
    action = models.CharField(max_length=100, db_index=True)
    resource_type = models.CharField(max_length=50, db_index=True, blank=True)
    resource_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    resource_repr = models.CharField(max_length=255, blank=True)  # String representation

    # WHEN
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    # CONTEXT
    http_method = models.CharField(max_length=10, blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    details = models.JSONField(default=dict, blank=True)  # Additional context

    # OUTCOME
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)

    # SEVERITY
    SEVERITY_CHOICES = [
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('CRITICAL', 'Critical'),
    ]
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='INFO')

    class Meta:
        app_label = 'erp'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['tenant', 'timestamp']),
            models.Index(fields=['tenant', 'user', 'timestamp']),
            models.Index(fields=['tenant', 'action', 'timestamp']),
            models.Index(fields=['tenant', 'resource_type', 'resource_id']),
        ]
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'

    def __str__(self):
        return f"{self.timestamp} | {self.username} | {self.action} | {self.resource_type}:{self.resource_id}"


class AuditTrail(TenantOwnedModel):
    """
    Layer 2 & 3: Model-level and field-level change tracking

    Tracks:
    - WHAT CHANGED: model, instance, field name
    - BEFORE/AFTER: old value, new value
    - WHO/WHEN: links to AuditLog
    """

    # Link to request-level audit
    audit_log = models.ForeignKey(
        AuditLog,
        on_delete=models.CASCADE,
        related_name='field_changes'
    )

    # WHAT CHANGED
    model_name = models.CharField(max_length=100)
    object_id = models.PositiveIntegerField()
    field_name = models.CharField(max_length=100)

    # BEFORE/AFTER
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)

    # METADATA
    field_type = models.CharField(max_length=50, blank=True)  # CharField, DecimalField, etc.

    class Meta:
        app_label = 'erp'
        ordering = ['field_name']
        indexes = [
            models.Index(fields=['tenant', 'model_name', 'object_id']),
            models.Index(fields=['audit_log']),
        ]
        verbose_name = 'Audit Trail'
        verbose_name_plural = 'Audit Trails'

    def __str__(self):
        return f"{self.model_name}.{self.field_name}: {self.old_value} → {self.new_value}"
