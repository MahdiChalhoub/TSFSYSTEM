from django.db import models
from django.conf import settings
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from .constants import LifecycleStatus, LifecycleAction

class PostableMixin(models.Model):
    """
    Abstract mixin for documents that follow the universal lifecycle.
    """
    status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.DRAFT,
        db_index=True
    )
    is_locked = models.BooleanField(default=False)
    
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='%(app_label)s_%(class)s_submitted'
    )
    
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='%(app_label)s_%(class)s_posted'
    )
    
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='%(app_label)s_%(class)s_locked'
    )
    
    reversal_of = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reversals'
    )

    class Meta:
        abstract = True


class ApprovalPolicy(AuditLogMixin, TenantOwnedModel):
    txn_type = models.CharField(max_length=100, db_index=True)
    min_level_required = models.PositiveIntegerField(default=1)
    allow_bypass = models.BooleanField(default=False)
    
    class Meta:
        app_label = 'erp'
        db_table = 'kernel_approval_policies'
        unique_together = ('tenant', 'txn_type')


class ApprovalPolicyStep(AuditLogMixin, TenantOwnedModel):
    policy = models.ForeignKey(ApprovalPolicy, on_delete=models.CASCADE, related_name='steps')
    level = models.PositiveIntegerField()
    role_id = models.CharField(max_length=100)
    required = models.BooleanField(default=True)
    
    class Meta:
        app_label = 'erp'
        db_table = 'kernel_approval_policy_steps'
        ordering = ['level']
        unique_together = ('policy', 'level')


class TxnApproval(AuditLogMixin, TenantOwnedModel):
    txn_type = models.CharField(max_length=100, db_index=True)
    txn_id = models.PositiveIntegerField(db_index=True)
    
    level = models.PositiveIntegerField()
    action = models.CharField(max_length=20, choices=LifecycleAction.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        app_label = 'erp'
        db_table = 'kernel_txn_approvals'
        indexes = [
            models.Index(fields=['txn_type', 'txn_id']),
        ]
