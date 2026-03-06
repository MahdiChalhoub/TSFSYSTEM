from django.conf import settings
"""
Module Models

Stores module registry and per-tenant module state.
"""

from django.db import models
from django.utils import timezone
from kernel.tenancy.models import TenantOwnedModel


class ModuleState:
    """Module state constants."""
    REGISTERED = 'REGISTERED'  # Registered in global catalog
    INSTALLED = 'INSTALLED'     # Installed for tenant (migrations run)
    ENABLED = 'ENABLED'         # Enabled and active
    DISABLED = 'DISABLED'       # Disabled (soft delete)
    UPGRADING = 'UPGRADING'     # Currently upgrading
    FAILED = 'FAILED'           # Installation/upgrade failed

    CHOICES = [
        (REGISTERED, 'Registered'),
        (INSTALLED, 'Installed'),
        (ENABLED, 'Enabled'),
        (DISABLED, 'Disabled'),
        (UPGRADING, 'Upgrading'),
        (FAILED, 'Failed'),
    ]


class KernelModule(models.Model):
    """
    Global catalog of available modules.

    All modules that exist in the system are registered here,
    regardless of whether they're enabled for specific tenants.
    """

    # Module identification
    name = models.CharField(max_length=100, unique=True, db_index=True)
    display_name = models.CharField(max_length=200)
    version = models.CharField(max_length=20)

    # Module metadata
    description = models.TextField()
    author = models.CharField(max_length=200, blank=True)
    license = models.CharField(max_length=100, blank=True)

    # Module manifest (full module.json)
    manifest = models.JSONField()

    # Module classification
    is_system_module = models.BooleanField(default=False)  # Core modules (cannot disable)
    is_marketplace_module = models.BooleanField(default=False)  # From marketplace
    category = models.CharField(max_length=50, blank=True)  # finance, inventory, crm, etc.

    # Dependencies
    depends_on = models.JSONField(default=list)  # List of module names

    # Security (for marketplace modules)
    signature = models.TextField(blank=True)
    signature_verified = models.BooleanField(default=False)

    # Tracking
    registered_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    # File paths
    module_path = models.CharField(max_length=500)  # e.g., 'apps/inventory'

    class Meta:
        app_label = 'erp'
        ordering = ['name']
        verbose_name = 'Kernel Module'
        verbose_name_plural = 'Kernel Modules'

    def __str__(self):
        return f"{self.name} v{self.version}"

    @property
    def permissions(self):
        """Get permissions defined by this module."""
        return self.manifest.get('permissions', [])

    @property
    def events_emitted(self):
        """Get events emitted by this module."""
        return self.manifest.get('events_emitted', [])

    @property
    def events_consumed(self):
        """Get events consumed by this module."""
        return self.manifest.get('events_consumed', [])

    @property
    def config_schema(self):
        """Get configuration schema for this module."""
        return self.manifest.get('config_schema', {})


class OrgModule(TenantOwnedModel):
    """
    Module state per tenant.

    Tracks which modules are enabled/disabled for each tenant.
    """

    module = models.ForeignKey(
        KernelModule,
        on_delete=models.CASCADE,
        related_name='org_modules'
    )

    # Module state
    status = models.CharField(
        max_length=20,
        choices=ModuleState.CHOICES,
        default=ModuleState.REGISTERED
    )

    # Version tracking
    installed_version = models.CharField(max_length=20)
    target_version = models.CharField(max_length=20, blank=True)  # For upgrades

    # Module-specific configuration
    config = models.JSONField(default=dict)

    # Timestamps
    installed_at = models.DateTimeField(null=True, blank=True)
    enabled_at = models.DateTimeField(null=True, blank=True)
    disabled_at = models.DateTimeField(null=True, blank=True)
    last_upgrade_at = models.DateTimeField(null=True, blank=True)

    # User tracking
    installed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='installed_modules'
    )
    enabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='enabled_modules'
    )

    # Error tracking (for failed installations)
    error_message = models.TextField(blank=True)
    error_timestamp = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'erp'
        unique_together = [['tenant', 'module']]
        ordering = ['module__name']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['module', 'status']),
        ]
        verbose_name = 'Organization Module'
        verbose_name_plural = 'Organization Modules'

    def __str__(self):
        return f"{self.tenant.name}: {self.module.name} ({self.status})"

    def is_enabled(self) -> bool:
        """Check if module is enabled."""
        return self.status == ModuleState.ENABLED

    def enable(self, user=None):
        """Enable module."""
        if self.status == ModuleState.DISABLED:
            self.status = ModuleState.ENABLED
            self.enabled_at = timezone.now()
            self.enabled_by = user
            self.save()

    def disable(self, user=None):
        """Disable module (soft delete)."""
        if self.status == ModuleState.ENABLED:
            self.status = ModuleState.DISABLED
            self.disabled_at = timezone.now()
            self.save()

    def mark_failed(self, error_message: str):
        """Mark module as failed."""
        self.status = ModuleState.FAILED
        self.error_message = error_message
        self.error_timestamp = timezone.now()
        self.save()


class ModuleMigration(TenantOwnedModel):
    """
    Track which migrations have been applied per tenant.

    Each module has its own migrations, and we track which ones
    have run for each tenant.
    """

    org_module = models.ForeignKey(
        OrgModule,
        on_delete=models.CASCADE,
        related_name='migrations'
    )

    # Migration identification
    migration_name = models.CharField(max_length=255)
    migration_version = models.CharField(max_length=20, blank=True)

    # Execution tracking
    applied_at = models.DateTimeField(default=timezone.now)
    execution_time_ms = models.IntegerField(null=True, blank=True)

    # Error tracking
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)

    class Meta:
        app_label = 'erp'
        unique_together = [['org_module', 'migration_name']]
        ordering = ['applied_at']
        verbose_name = 'Module Migration'
        verbose_name_plural = 'Module Migrations'

    def __str__(self):
        return f"{self.org_module.module.name}: {self.migration_name}"


class ModuleDependency(models.Model):
    """
    Track module dependencies.

    Ensures correct installation order and prevents conflicts.
    """

    module = models.ForeignKey(
        KernelModule,
        on_delete=models.CASCADE,
        related_name='dependencies'
    )

    depends_on = models.ForeignKey(
        KernelModule,
        on_delete=models.CASCADE,
        related_name='required_by'
    )

    # Version constraints
    min_version = models.CharField(max_length=20, blank=True)
    max_version = models.CharField(max_length=20, blank=True)

    # Dependency type
    is_required = models.BooleanField(default=True)  # If False, it's optional

    class Meta:
        app_label = 'erp'
        unique_together = [['module', 'depends_on']]
        verbose_name = 'Module Dependency'
        verbose_name_plural = 'Module Dependencies'

    def __str__(self):
        return f"{self.module.name} depends on {self.depends_on.name}"
