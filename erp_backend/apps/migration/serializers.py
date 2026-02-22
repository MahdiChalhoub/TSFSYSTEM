"""
Serializers for the Migration module API.
"""
from rest_framework import serializers
from apps.migration.models import MigrationJob, MigrationMapping


class MigrationJobSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.first_name', read_only=True, default='')

    class Meta:
        model = MigrationJob
        fields = [
            'id', 'name', 'source_type', 'status', 'progress', 'current_step',
            'source_business_id', 'source_business_name', 'migration_mode',
            'total_units', 'total_categories', 'total_brands', 'total_products',
            'total_contacts', 'total_transactions', 'total_accounts', 'total_errors',
            'error_log', 'created_by_name', 'started_at', 'completed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class MigrationJobDetailSerializer(MigrationJobSerializer):
    mappings_summary = serializers.SerializerMethodField()

    class Meta(MigrationJobSerializer.Meta):
        fields = MigrationJobSerializer.Meta.fields + ['mappings_summary']

    def get_mappings_summary(self, obj):
        """Get count of mappings per entity type."""
        from django.db.models import Count
        result = MigrationMapping.objects.filter(job=obj).values(
            'entity_type'
        ).annotate(count=Count('id')).order_by('entity_type')
        return {item['entity_type']: item['count'] for item in result}


class MigrationUploadSerializer(serializers.Serializer):
    file = serializers.FileField(
        help_text='MySQL .sql dump file from UltimatePOS'
    )
    name = serializers.CharField(
        max_length=255, required=False,
        default='UltimatePOS Migration'
    )

    def validate_file(self, value):
        if not value.name.endswith('.sql'):
            raise serializers.ValidationError("Only .sql files are accepted")
        # Max 500MB
        if value.size > 500 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 500MB)")
        return value


class MigrationDirectDBSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, default='UltimatePOS Migration')
    db_host = serializers.CharField(max_length=255)
    db_port = serializers.IntegerField(default=3306)
    db_name = serializers.CharField(max_length=255)
    db_user = serializers.CharField(max_length=255)
    db_password = serializers.CharField(max_length=255)


class MigrationMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MigrationMapping
        fields = [
            'id', 'entity_type', 'source_id', 'target_id',
            'source_table', 'extra_data', 'created_at'
        ]
        read_only_fields = fields


class MigrationPreviewSerializer(serializers.Serializer):
    """Response serializer for preview endpoint."""
    tables = serializers.DictField(child=serializers.IntegerField())


class MigrationLinkSerializer(serializers.Serializer):
    """Serializer for linking an existing StoredFile to a new migration job."""
    file_uuid = serializers.UUIDField()
    name = serializers.CharField(max_length=255, default='UltimatePOS Migration')
