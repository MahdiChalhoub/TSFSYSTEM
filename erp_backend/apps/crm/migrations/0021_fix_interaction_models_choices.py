# Generated manually by Claude Code - 2026-03-11
# CRITICAL FIX: Remove get_config() from model-level choices (runtime failure fix)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0020_contact_assigned_owner_and_more'),
    ]

    operations = [
        # Note: This migration documents the fix for CRITICAL-004.
        # Changed from dynamic get_config() choices (which caused import-time failures)
        # to static tuple choices in the following models:
        #
        # - RelationshipAssignment (ENTITY_TYPES, PRIORITY_LEVELS)
        # - FollowUpPolicy (ACTION_TYPES, TRIGGER_TYPES)
        # - ScheduledActivity (SOURCE_TYPES)
        # - InteractionLog (CHANNELS, OUTCOMES)
        # - SupplierProductPolicy (REORDER_MODES)
        #
        # No database schema changes needed - only Python code changes.
    ]
