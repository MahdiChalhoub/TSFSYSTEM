"""
Migration v2 Serializers
=======================
"""
from rest_framework import serializers
from .models import MigrationJob, MigrationMapping, MigrationValidationResult


class MigrationJobSerializer(serializers.ModelSerializer):
    """Serializer for MigrationJob model."""

    class Meta:
        model = MigrationJob
        fields = [
            'id', 'name', 'target_organization', 'status', 'current_step',
            'current_step_detail', 'progress_percent', 'coa_template_used',
            'total_products', 'total_contacts', 'total_sales', 'total_purchases',
            'imported_products', 'imported_customers', 'imported_suppliers',
            'imported_sales', 'imported_purchases', 'total_verified', 'total_flagged',
            'errors', 'warnings', 'started_at', 'completed_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'started_at', 'completed_at']


class MigrationMappingSerializer(serializers.ModelSerializer):
    """Serializer for MigrationMapping model."""

    class Meta:
        model = MigrationMapping
        fields = [
            'id', 'job', 'entity_type', 'source_id', 'target_id',
            'source_data', 'verify_status', 'verify_notes',
            'verified_by', 'verified_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'verified_at']


class MigrationValidationResultSerializer(serializers.ModelSerializer):
    """Serializer for validation results."""

    class Meta:
        model = MigrationValidationResult
        fields = '__all__'
