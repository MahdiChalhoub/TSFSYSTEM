from rest_framework import serializers
from apps.storage.models import StorageProvider, StoredFile, FILE_CATEGORIES

class StorageProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageProvider
        fields = [
            'id', 'organization', 'provider_type', 'endpoint_url',
            'bucket_name', 'access_key', 'secret_key', 'region',
            'path_prefix', 'is_active', 'max_file_size_mb',
            'allowed_extensions', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {'secret_key': {'write_only': True}}

class StorageProviderReadSerializer(serializers.ModelSerializer):
    access_key_masked = serializers.SerializerMethodField()
    class Meta:
        model = StorageProvider
        fields = [
            'id', 'organization', 'provider_type', 'endpoint_url',
            'bucket_name', 'access_key_masked', 'region',
            'path_prefix', 'is_active', 'max_file_size_mb',
            'allowed_extensions', 'created_at', 'updated_at',
        ]
    def get_access_key_masked(self, obj):
        if obj.access_key:
            return obj.access_key[:4] + '****' + obj.access_key[-4:] if len(obj.access_key) > 8 else '****'
        return ''

class StoredFileSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()
    uploaded_by_name = serializers.SerializerMethodField()
    class Meta:
        model = StoredFile
        fields = [
            'uuid', 'original_filename', 'storage_key', 'bucket',
            'content_type', 'file_size', 'file_size_display',
            'category', 'linked_model', 'linked_id',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
            'is_deleted', 'checksum',
        ]
        read_only_fields = [
            'uuid', 'storage_key', 'bucket', 'file_size',
            'file_size_display', 'uploaded_by', 'uploaded_by_name',
            'uploaded_at', 'checksum',
        ]
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None

class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    category = serializers.ChoiceField(choices=FILE_CATEGORIES, default='ATTACHMENT')
    linked_model = serializers.CharField(required=False, allow_blank=True, default='')
    linked_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    def validate_file(self, value):
        provider = self.context.get('provider')
        if provider:
            max_bytes = provider.max_file_size_mb * 1024 * 1024
            if value.size > max_bytes:
                raise serializers.ValidationError(f"File too large. Maximum size is {provider.max_file_size_mb} MB.")
            allowed = provider.allowed_extensions or []
            if allowed:
                ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
                if ext and ext not in allowed:
                    raise serializers.ValidationError(f"File type '.{ext}' is not allowed. Allowed: {', '.join(allowed)}")
        return value
