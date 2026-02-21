from django.contrib import admin
from .models import StorageProvider, StoredFile


@admin.register(StorageProvider)
class StorageProviderAdmin(admin.ModelAdmin):
    list_display = ('organization', 'provider_type', 'bucket_name', 'is_active')
    list_filter = ('provider_type', 'is_active')


@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ('original_filename', 'category', 'content_type', 'file_size', 'uploaded_by', 'uploaded_at')
    list_filter = ('category', 'content_type', 'is_deleted')
    search_fields = ('original_filename', 'storage_key')
    readonly_fields = ('uuid', 'checksum', 'storage_key', 'bucket')
