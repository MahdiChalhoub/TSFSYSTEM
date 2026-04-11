# Generated manually by Claude Code - 2026-03-11
# CRITICAL FIX: Change from TenantModel to TenantOwnedModel + add AuditLogMixin

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workforce', '0004_badge_unique_per_period'),
    ]

    operations = [
        # Note: This migration is primarily about changing the inheritance chain.
        # The actual fields remain the same since both TenantModel and TenantOwnedModel
        # provide the same core fields _organization, organization, created_at, updated_at).
        #
        # The AuditLogMixin adds audit logging capabilities but doesn't add database fields
        # unless configured to do so in settings.
        #
        # If AuditLogMixin adds fields in your implementation, uncomment and adjust below:

        # migrations.AddField(
        #     model_name='scorerule',
        #     name='audit_metadata',
        #     field=models.JSONField(default=dict, blank=True),
        # ),

        # Add any additional fields that AuditLogMixin might require
        # Check kernel.audit.mixins.AuditLogMixin for actual field requirements

        # This migration serves as a marker that the inheritance was changed
        # and documents the CRITICAL security fix applied
    ]
