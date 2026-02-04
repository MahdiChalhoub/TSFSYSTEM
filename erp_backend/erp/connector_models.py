"""
Connector Module - Data Models
==============================
Core infrastructure for the Module Contract Registry + Runtime Broker.

Models:
- ModuleContract: Declares what each module provides and needs
- ConnectorPolicy: Runtime fallback behavior configuration
- BufferedRequest: Queue for writes to unavailable modules
"""

from django.db import models
from django.utils import timezone
from datetime import timedelta


class ModuleContract(models.Model):
    """
    Declares what a module provides and what it needs from other modules.
    This is the 'memory' of the system - the Connector knows everything
    about inter-module dependencies through these contracts.
    """
    module = models.OneToOneField(
        'SystemModule',
        on_delete=models.CASCADE,
        related_name='contract'
    )
    
    # What this module provides to others
    provides = models.JSONField(
        default=dict,
        help_text="""
        {
            "read_endpoints": ["products/", "categories/"],
            "write_endpoints": ["products/create/"],
            "events_emitted": ["product.created", "stock.updated"],
            "functions_exposed": ["get_product_cost", "validate_sku"]
        }
        """
    )
    
    # What this module needs from other modules
    needs = models.JSONField(
        default=dict,
        help_text="""
        {
            "data_from": [
                {"module": "inventory", "endpoint": "products/cost/", "blocking": false}
            ],
            "events_from": [
                {"module": "pos", "event": "sale.completed"}
            ],
            "capabilities": ["accounting.post_journal_entry"]
        }
        """
    )
    
    # Rules for graceful degradation
    rules = models.JSONField(
        default=dict,
        help_text="""
        {
            "can_work_without": ["crm", "reporting"],
            "buffer_writes_to": ["accounting"],
            "critical_dependencies": ["core"]
        }
        """
    )
    
    version = models.CharField(max_length=50, default='1.0.0')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ModuleContract'
        verbose_name = 'Module Contract'
        verbose_name_plural = 'Module Contracts'
    
    def __str__(self):
        return f"Contract: {self.module.name} v{self.version}"


class ConnectorPolicy(models.Model):
    """
    Defines runtime behavior when a module is in a specific state.
    SuperAdmin configures these through the Connector UI Panel.
    
    This is where 'Modules only declare intent, Connector executes policy' happens.
    """
    
    # Read fallback options
    READ_FALLBACK_CHOICES = [
        ('wait', 'Wait (blocking)'),
        ('empty', 'Empty Safe Response'),
        ('cached', 'Cached Last Value'),
        ('mock', 'Mock Response (dev)'),
        ('error', 'Return Error Object'),
    ]
    
    # Write fallback options
    WRITE_FALLBACK_CHOICES = [
        ('buffer', 'Buffer for Replay'),
        ('redirect', 'Redirect to Core'),
        ('drop', 'Drop Silently'),
        ('queue_event', 'Queue as Event'),
        ('error', 'Return Error Object'),
    ]
    
    # Target module and endpoint
    target_module = models.CharField(
        max_length=100,
        help_text="Module code (e.g., 'inventory') or '*' for global"
    )
    target_endpoint = models.CharField(
        max_length=255,
        default='*',
        help_text="Specific endpoint or '*' for all endpoints"
    )
    
    # Source module (who is making the request)
    source_module = models.CharField(
        max_length=100,
        default='*',
        help_text="Requesting module (e.g., 'pos') or '*' for any module"
    )
    
    # Policies for MISSING state (🟡)
    when_missing_read = models.CharField(
        max_length=20,
        choices=READ_FALLBACK_CHOICES,
        default='empty',
        help_text="Action when module is NOT INSTALLED"
    )
    when_missing_write = models.CharField(
        max_length=20,
        choices=WRITE_FALLBACK_CHOICES,
        default='buffer',
        help_text="Action for writes when module is NOT INSTALLED"
    )
    
    # Policies for DISABLED state (🔵)
    when_disabled_read = models.CharField(
        max_length=20,
        choices=READ_FALLBACK_CHOICES,
        default='empty',
        help_text="Action when module is DISABLED for tenant"
    )
    when_disabled_write = models.CharField(
        max_length=20,
        choices=WRITE_FALLBACK_CHOICES,
        default='drop',
        help_text="Action for writes when module is DISABLED"
    )
    
    # Policies for UNAUTHORIZED state (🔴)
    when_unauthorized_read = models.CharField(
        max_length=20,
        choices=READ_FALLBACK_CHOICES,
        default='empty',
        help_text="Action when tenant has NO PERMISSION"
    )
    when_unauthorized_write = models.CharField(
        max_length=20,
        choices=WRITE_FALLBACK_CHOICES,
        default='drop',
        help_text="Action for writes when NO PERMISSION"
    )
    
    # Cache and buffer settings
    cache_ttl_seconds = models.IntegerField(
        default=300,
        help_text="How long to cache responses (for 'cached' fallback)"
    )
    buffer_ttl_seconds = models.IntegerField(
        default=3600,
        help_text="How long to retain buffered writes before expiring"
    )
    max_buffer_size = models.IntegerField(
        default=100,
        help_text="Maximum buffered requests per org/module"
    )
    
    # Metadata
    priority = models.IntegerField(
        default=0,
        help_text="Higher priority policies take precedence"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ConnectorPolicy'
        verbose_name = 'Connector Policy'
        verbose_name_plural = 'Connector Policies'
        ordering = ['-priority', 'target_module']
        unique_together = ['source_module', 'target_module', 'target_endpoint']
    
    def __str__(self):
        return f"Policy: {self.target_module}/{self.target_endpoint}"


class BufferedRequest(models.Model):
    """
    Queue for write requests that couldn't be delivered because
    the target module was unavailable (MISSING or temporarily DISABLED).
    
    When the module becomes available, these are replayed.
    This ensures NO DATA LOSS.
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('replayed', 'Replayed'),
        ('expired', 'Expired'),
        ('failed', 'Failed'),
    ]
    
    # Target information
    target_module = models.CharField(max_length=100)
    target_endpoint = models.CharField(max_length=255)
    
    # Source information
    source_module = models.CharField(max_length=100, null=True, blank=True)
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='buffered_requests'
    )
    
    # Request data
    method = models.CharField(max_length=10, default='POST')
    payload = models.JSONField(default=dict)
    headers = models.JSONField(default=dict, blank=True)
    
    # Tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    replayed_at = models.DateTimeField(null=True, blank=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    
    # Error tracking
    last_error = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'BufferedRequest'
        verbose_name = 'Buffered Request'
        verbose_name_plural = 'Buffered Requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['target_module', 'status']),
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Buffer: {self.target_module}/{self.target_endpoint} [{self.status}]"
    
    def save(self, *args, **kwargs):
        # Auto-set expiry if not provided
        if not self.expires_at:
            # Default 1 hour expiry, can be overridden by policy
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    @property
    def can_retry(self):
        return self.retry_count < self.max_retries and not self.is_expired


class ConnectorCache(models.Model):
    """
    Cache for READ responses from modules.
    Used when 'cached' fallback is configured.
    """
    
    cache_key = models.CharField(max_length=500, unique=True)
    target_module = models.CharField(max_length=100)
    target_endpoint = models.CharField(max_length=255)
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='connector_cache'
    )
    
    # Cached data
    response_data = models.JSONField()
    
    # Timestamps
    cached_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        db_table = 'ConnectorCache'
        verbose_name = 'Connector Cache'
        verbose_name_plural = 'Connector Cache Entries'
        indexes = [
            models.Index(fields=['cache_key']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Cache: {self.cache_key}"
    
    @property
    def is_valid(self):
        return timezone.now() < self.expires_at


class ConnectorLog(models.Model):
    """
    Audit trail for all connector routing decisions.
    Critical for debugging and compliance.
    """
    
    DECISION_CHOICES = [
        ('forward', 'Forwarded'),
        ('fallback', 'Fallback Applied'),
        ('buffer', 'Buffered'),
        ('reject', 'Rejected'),
        ('replay', 'Replayed'),
    ]
    
    # Request info
    source_module = models.CharField(max_length=100, null=True, blank=True)
    target_module = models.CharField(max_length=100)
    target_endpoint = models.CharField(max_length=255)
    operation = models.CharField(max_length=10)  # READ, WRITE, EVENT
    
    # State and decision
    module_state = models.CharField(max_length=20)  # available, missing, disabled, unauthorized
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES)
    policy_applied = models.ForeignKey(
        ConnectorPolicy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Context
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='connector_logs'
    )
    user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Result
    success = models.BooleanField(default=True)
    response_time_ms = models.IntegerField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'ConnectorLog'
        verbose_name = 'Connector Log'
        verbose_name_plural = 'Connector Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['target_module', 'created_at']),
            models.Index(fields=['organization', 'created_at']),
            models.Index(fields=['decision', 'created_at']),
        ]
    
    def __str__(self):
        return f"Log: {self.target_module} [{self.decision}] @ {self.created_at}"
