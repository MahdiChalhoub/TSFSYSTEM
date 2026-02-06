"""
Package Storage Serializers
"""
from rest_framework import serializers
from ..models import PackageUpload


class PackageUploadSerializer(serializers.ModelSerializer):
    """Serializer for PackageUpload model."""
    
    uploaded_by_name = serializers.SerializerMethodField()
    applied_by_name = serializers.SerializerMethodField()
    package_type_display = serializers.CharField(source='get_package_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PackageUpload
        fields = [
            'id', 'package_type', 'package_type_display', 'name', 'version',
            'file', 'file_size', 'upload_progress', 'checksum',
            'status', 'status_display', 'changelog', 'error_message',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
            'scheduled_for', 'applied_at', 'applied_by', 'applied_by_name',
            'manifest', 'backup_path'
        ]
        read_only_fields = [
            'id', 'upload_progress', 'checksum', 'status', 
            'uploaded_by', 'uploaded_at', 'applied_at', 'applied_by',
            'backup_path', 'error_message'
        ]
    
    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None
    
    def get_applied_by_name(self, obj):
        if obj.applied_by:
            return obj.applied_by.get_full_name() or obj.applied_by.username
        return None
