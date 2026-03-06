"""
Contract Models

Stores contract definitions and versions.
"""

from django.db import models
from django.utils import timezone


class Contract(models.Model):
    """
    Contract definition - interface between modules.

    Examples:
    - Event payload schemas (invoice.created event)
    - API request/response formats
    - Shared data types
    """

    # Contract identification
    name = models.CharField(max_length=200, unique=True, db_index=True)
    category = models.CharField(max_length=50, choices=[
        ('EVENT', 'Event Payload'),
        ('API', 'API Contract'),
        ('TYPE', 'Shared Type'),
        ('MODEL', 'Model Interface'),
    ])

    # Ownership
    owner_module = models.CharField(max_length=100)  # Which module owns this contract

    # Metadata
    description = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    # Current version
    current_version = models.CharField(max_length=20, default='1.0.0')

    # Breaking changes flag
    is_deprecated = models.BooleanField(default=False)
    deprecated_reason = models.TextField(blank=True)
    replacement_contract = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replaced_by'
    )

    class Meta:
        app_label = 'erp'
        ordering = ['name']
        verbose_name = 'Contract'
        verbose_name_plural = 'Contracts'

    def __str__(self):
        return f"{self.name} v{self.current_version}"


class ContractVersion(models.Model):
    """
    Version history of a contract.

    Tracks schema changes over time for compatibility checking.
    """

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='versions')

    # Version info
    version = models.CharField(max_length=20)  # Semantic versioning (1.0.0, 1.1.0, 2.0.0)

    # Schema definition (JSON Schema format)
    schema = models.JSONField()

    # Change tracking
    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.CharField(max_length=200, blank=True)  # Who created this version
    changelog = models.TextField(blank=True)  # What changed

    # Compatibility
    is_breaking_change = models.BooleanField(default=False)
    compatible_with = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        related_name='compatible_versions'
    )

    class Meta:
        app_label = 'erp'
        ordering = ['-created_at']
        unique_together = [['contract', 'version']]
        verbose_name = 'Contract Version'
        verbose_name_plural = 'Contract Versions'

    def __str__(self):
        return f"{self.contract.name} v{self.version}"


class ContractUsage(models.Model):
    """
    Track which modules use which contracts.

    Helps identify impact of contract changes.
    """

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='usages')

    # Which module uses this contract
    module_name = models.CharField(max_length=100)

    # How it's used
    usage_type = models.CharField(max_length=50, choices=[
        ('PRODUCER', 'Produces (emits events, sends API responses)'),
        ('CONSUMER', 'Consumes (handles events, calls APIs)'),
        ('BOTH', 'Both producer and consumer'),
    ])

    # Version compatibility
    required_version = models.CharField(max_length=20)  # Minimum required version
    notes = models.TextField(blank=True)

    # Tracking
    registered_at = models.DateTimeField(default=timezone.now)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'erp'
        ordering = ['module_name']
        unique_together = [['contract', 'module_name']]
        verbose_name = 'Contract Usage'
        verbose_name_plural = 'Contract Usages'

    def __str__(self):
        return f"{self.module_name} uses {self.contract.name}"
