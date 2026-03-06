"""
Migration v2 Admin Interface
============================
"""
from django.contrib import admin
from .models import MigrationJob, MigrationMapping, MigrationValidationResult


@admin.register(MigrationJob)
class MigrationJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'target_organization', 'status', 'progress_percent']
    list_filter = ['status']
    search_fields = ['name', 'target_organization__name']
    readonly_fields = ['started_at', 'completed_at']


@admin.register(MigrationMapping)
class MigrationMappingAdmin(admin.ModelAdmin):
    list_display = ['id', 'job', 'entity_type', 'source_id', 'target_id', 'verify_status']
    list_filter = ['entity_type', 'verify_status']
    search_fields = ['source_id', 'target_id']
    readonly_fields = ['verified_at']


@admin.register(MigrationValidationResult)
class MigrationValidationResultAdmin(admin.ModelAdmin):
    list_display = ['id', 'job', 'is_valid', 'has_coa', 'has_posting_rules', 'validated_at']
    list_filter = ['is_valid', 'has_coa', 'has_posting_rules']
    readonly_fields = ['validated_at']
