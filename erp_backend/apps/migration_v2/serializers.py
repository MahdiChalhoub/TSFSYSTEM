"""
Migration v2 Serializers
=======================
"""
from rest_framework import serializers
from .models import MigrationJob, MigrationMapping, MigrationValidationResult


class MigrationJobSerializer(serializers.ModelSerializer):
    """Serializer for MigrationJob model."""

    target_organization_name = serializers.CharField(source='target_organization.name', read_only=True, default='')
    source_file_name = serializers.SerializerMethodField()

    class Meta:
        model = MigrationJob
        fields = [
            'id', 'name', 'target_organization', 'target_organization_name',
            'status', 'current_step', 'current_step_detail', 'progress_percent',
            'coa_template_used', 'posting_rules_snapshot', 'account_type_mappings',
            'source_file', 'source_file_name',
            # Source totals
            'total_units', 'total_categories', 'total_brands',
            'total_products', 'total_contacts', 'total_sales',
            'total_purchases', 'total_payments', 'total_stock_records',
            # Imported counts
            'imported_units', 'imported_categories', 'imported_brands',
            'imported_products', 'imported_customers', 'imported_suppliers',
            'imported_sales', 'imported_purchases', 'imported_payments',
            'imported_stock_records',
            # Verification
            'total_verified', 'total_flagged',
            'errors', 'warnings',
            'started_at', 'completed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'started_at', 'completed_at']

    def get_source_file_name(self, obj):
        if obj.source_file:
            return getattr(obj.source_file, 'original_filename', None) or str(obj.source_file)
        return None


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
