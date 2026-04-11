from django.conf import settings
"""
Config Models

TenantConfig: Tenant-specific configuration
FeatureFlag: Feature flag management
"""

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from kernel.tenancy.models import TenantOwnedModel
import json


class TenantConfig(TenantOwnedModel):
    """
    Tenant-specific configuration key-value store.

    Supports:
    - String, number, boolean, JSON values
    - Configuration versioning
    - Audit trail of changes
    """

    # Config key (e.g., 'default_tax_rate', 'invoice_prefix')
    key = models.CharField(max_length=100, db_index=True)

    # Config value (stored as JSON for flexibility)
    value = models.JSONField()

    # Value type (for validation and type-safe access)
    VALUE_TYPE_CHOICES = [
        ('string', 'String'),
        ('number', 'Number'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
    ]
    value_type = models.CharField(max_length=20, choices=VALUE_TYPE_CHOICES, default='string')

    # Metadata
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)  # System configs cannot be deleted
    is_sensitive = models.BooleanField(default=False)  # Sensitive values (passwords, API keys)

    # Versioning
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_configs'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_configs'
    )

    class Meta:
        app_label = 'erp'
        unique_together = [['organization', 'key']]
        ordering = ['key']
        indexes = [
            models.Index(fields=['organization', 'key']),
        ]
        verbose_name = 'Tenant Config'
        verbose_name_plural = 'Tenant Configs'

    def __str__(self):
        return f"{self.key} = {self.value}"

    def clean(self):
        """Validate value matches value_type."""
        if self.value_type == 'string' and not isinstance(self.value, str):
            raise ValidationError(f"Value must be a string for key '{self.key}'")
        elif self.value_type == 'number' and not isinstance(self.value, (int, float)):
            raise ValidationError(f"Value must be a number for key '{self.key}'")
        elif self.value_type == 'boolean' and not isinstance(self.value, bool):
            raise ValidationError(f"Value must be a boolean for key '{self.key}'")

    def save(self, *args, **kwargs):
        self.full_clean()
        # Increment version on update
        if self.pk:
            self.version += 1
        super().save(*args, **kwargs)


class FeatureFlag(TenantOwnedModel):
    """
    Feature flag for gradual rollout and A/B testing.

    Supports:
    - Enable/disable features per organization
    - Percentage-based rollout
    - User segment targeting
    - Schedule-based activation
    """

    # Feature key (e.g., 'new_invoice_ui', 'advanced_reporting')
    key = models.CharField(max_length=100, db_index=True)

    # Feature state
    is_enabled = models.BooleanField(default=False)

    # Rollout percentage (0-100)
    # If 50, only 50% of users see the feature
    rollout_percentage = models.IntegerField(default=100, help_text="0-100")

    # Scheduled activation
    start_date = models.DateTimeField(null=True, blank=True, help_text="Auto-enable on this date")
    end_date = models.DateTimeField(null=True, blank=True, help_text="Auto-disable on this date")

    # User segment targeting
    target_user_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="List of user IDs who should see this feature"
    )
    target_user_roles = models.JSONField(
        default=list,
        blank=True,
        help_text="List of role names who should see this feature"
    )

    # Metadata
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Audit
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_flags'
    )

    class Meta:
        app_label = 'erp'
        unique_together = [['organization', 'key']]
        ordering = ['key']
        indexes = [
            models.Index(fields=['organization', 'key']),
            models.Index(fields=['is_enabled']),
        ]
        verbose_name = 'Feature Flag'
        verbose_name_plural = 'Feature Flags'

    def __str__(self):
        status = "✓" if self.is_enabled else "✗"
        return f"{status} {self.key} ({self.rollout_percentage}%)"

    def clean(self):
        """Validate rollout percentage."""
        if not 0 <= self.rollout_percentage <= 100:
            raise ValidationError("Rollout percentage must be between 0 and 100")

    def is_active(self) -> bool:
        """Check if feature flag is currently active (considering schedule)."""
        if not self.is_enabled:
            return False

        now = timezone.now()

        # Check start date
        if self.start_date and now < self.start_date:
            return False

        # Check end date
        if self.end_date and now > self.end_date:
            return False

        return True

    def is_enabled_for_user(self, user) -> bool:
        """
        Check if feature is enabled for specific user.

        Takes into account:
        - Feature enabled state
        - Schedule (start/end date)
        - Rollout percentage
        - User targeting (IDs and roles)
        """
        if not self.is_active():
            return False

        # Check user ID targeting
        if self.target_user_ids and user.id in self.target_user_ids:
            return True

        # Check role targeting
        if self.target_user_roles:
            from kernel.rbac.models import UserRole
            user_roles = UserRole.objects.filter(
                user=user,
                organization=self.organization
            ).values_list('role__name', flat=True)

            if any(role in self.target_user_roles for role in user_roles):
                return True

        # Check rollout percentage
        if self.rollout_percentage == 100:
            return True
        elif self.rollout_percentage == 0:
            return False
        else:
            # Hash-based deterministic rollout
            # Same user always gets same result for stability
            user_hash = hash(f"{self.key}:{user.id}") % 100
            return user_hash < self.rollout_percentage


class ConfigHistory(TenantOwnedModel):
    """
    Historical record of configuration changes.

    Tracks:
    - What changed
    - Who changed it
    - When it changed
    - Old and new values
    """

    config = models.ForeignKey(
        TenantConfig,
        on_delete=models.CASCADE,
        related_name='history'
    )

    # Change details
    old_value = models.JSONField()
    new_value = models.JSONField()

    # Audit
    changed_at = models.DateTimeField(default=timezone.now)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        app_label = 'erp'
        ordering = ['-changed_at']
        verbose_name = 'Config History'
        verbose_name_plural = 'Config Histories'

    def __str__(self):
        return f"{self.config.key}: {self.old_value} → {self.new_value}"
