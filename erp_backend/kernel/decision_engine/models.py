"""
Decision Engine Models
=====================

Models for storing decision rules, logs, and ML model metadata.

Architecture Compliance:
- All models inherit from TenantOwnedModel (tenant isolation)
- All models include AuditLogMixin (audit trail)
- No hardcoded values (use get_config)
"""

from django.db import models
from django.utils import timezone
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin


class DecisionRule(AuditLogMixin, TenantOwnedModel):
    """
    Configurable decision rules for business logic

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """

    RULE_TYPES = [
        ('THRESHOLD', 'Threshold Rule'),
        ('FORMULA', 'Formula-based Rule'),
        ('ML', 'Machine Learning Rule'),
        ('COMPOSITE', 'Composite Rule'),
    ]

    CONTEXTS = [
        ('inventory.transfer', 'Inventory Transfer'),
        ('inventory.allocation', 'Order Allocation'),
        ('inventory.reorder', 'Reorder Point'),
        ('inventory.approval', 'Approval Workflow'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    context = models.CharField(max_length=100, choices=CONTEXTS)
    rule_type = models.CharField(max_length=50, choices=RULE_TYPES)

    class Meta:
        app_label = 'erp'
        db_table = 'decision_rule'
        verbose_name = 'Decision Rule'
        verbose_name_plural = 'Decision Rules'
        ordering = ['priority', 'name']
        indexes = [
            models.Index(fields=['organization', 'context', 'is_active'], name='dec_rule_org_ctx_idx'),
        ]

    # Rule configuration (JSON)
    config = models.JSONField(
        default=dict,
        help_text="Rule parameters (threshold values, formula, ML model name, etc.)"
    )

    # Execution
    is_active = models.BooleanField(default=True)
    priority = models.IntegerField(
        default=100,
        help_text="Lower number = higher priority"
    )

    # Performance tracking
    execution_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    avg_execution_time_ms = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.context})"


class DecisionLog(AuditLogMixin, TenantOwnedModel):
    """
    Audit log of all decisions made by the engine

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """

    DECISION_TYPES = [
        ('APPROVE', 'Approval'),
        ('REJECT', 'Rejection'),
        ('RECOMMEND', 'Recommendation'),
        ('CALCULATE', 'Calculation'),
        ('OPTIMIZE', 'Optimization'),
    ]

    context = models.CharField(max_length=100)
    decision_type = models.CharField(max_length=50, choices=DECISION_TYPES)

    # What was being decided
    subject = models.CharField(max_length=200)
    subject_id = models.CharField(max_length=100, blank=True)

    # Decision details
    input_data = models.JSONField(
        help_text="Input parameters for the decision"
    )
    output_data = models.JSONField(
        help_text="Decision result, recommendations, calculations"
    )

    # Which rules were applied
    rules_applied = models.JSONField(
        default=list,
        help_text="List of rule IDs that contributed to this decision"
    )

    # Performance
    execution_time_ms = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    # Outcome tracking (for ML feedback)
    was_accepted = models.BooleanField(null=True, blank=True)
    actual_outcome = models.JSONField(
        null=True,
        blank=True,
        help_text="Actual results after decision was implemented"
    )

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'erp'
        db_table = 'decision_log'
        verbose_name = 'Decision Log'
        verbose_name_plural = 'Decision Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'context', '-created_at'], name='dec_log_org_ctx_idx'),
            models.Index(fields=['decision_type'], name='dec_log_type_idx'),
            models.Index(fields=['subject_id'], name='dec_log_subj_idx'),
        ]

    def __str__(self):
        return f"{self.decision_type}: {self.subject} @ {self.created_at}"


class MLModel(AuditLogMixin, TenantOwnedModel):
    """
    Machine Learning model registry

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """

    MODEL_TYPES = [
        ('FORECAST', 'Demand Forecasting'),
        ('CLASSIFICATION', 'Classification'),
        ('REGRESSION', 'Regression'),
        ('OPTIMIZATION', 'Optimization'),
        ('CLUSTERING', 'Clustering'),
    ]

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)

    # Model metadata
    algorithm = models.CharField(
        max_length=100,
        help_text="e.g., ARIMA, RandomForest, XGBoost"
    )
    version = models.CharField(max_length=50)

    # Model storage
    model_path = models.CharField(
        max_length=500,
        help_text="Path to serialized model file"
    )
    config = models.JSONField(
        default=dict,
        help_text="Hyperparameters and training configuration"
    )

    # Performance metrics
    accuracy = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Model accuracy (percentage)"
    )
    last_trained_at = models.DateTimeField(null=True, blank=True)
    training_samples = models.IntegerField(default=0)

    # Usage
    is_active = models.BooleanField(default=True)
    prediction_count = models.IntegerField(default=0)
    avg_prediction_time_ms = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )

    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'erp'
        db_table = 'ml_model'
        verbose_name = 'ML Model'
        verbose_name_plural = 'ML Models'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'model_type', 'is_active'], name='ml_model_org_type_idx'),
        ]

    def __str__(self):
        return f"{self.name} v{self.version} ({self.algorithm})"
