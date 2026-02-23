"""
Storage Module — views.py
REST API for cloud file storage operations.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated

from .models import StorageProvider, StoredFile
from .serializers import (
    StorageProviderSerializer, StorageProviderReadSerializer,
    StoredFileSerializer, FileUploadSerializer,
)
from . import backends

logger = logging.getLogger(__name__)


class StoredFileViewSet(viewsets.ModelViewSet):
    """
    CRUD + upload/download for stored files.
    """
    serializer_class = StoredFileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    lookup_field = 'uuid'

    def get_queryset(self):
        qs = StoredFile.objects.filter(is_deleted=False)
        # Filters
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        linked_model = self.request.query_params.get('linked_model')
        if linked_model:
            qs = qs.filter(linked_model=linked_model)
        linked_id = self.request.query_params.get('linked_id')
        if linked_id:
            qs = qs.filter(linked_id=linked_id)
        return qs

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """Upload a file to cloud storage."""
        org = getattr(request, 'organization', None)
        provider = StorageProvider.get_for_organization(org)

        serializer = FileUploadSerializer(
            data=request.data,
            context={'provider': provider}
        )
        serializer.is_valid(raise_exception=True)

        file_obj = serializer.validated_data['file']
        category = serializer.validated_data['category']
        linked_model = serializer.validated_data.get('linked_model', '')
        linked_id = serializer.validated_data.get('linked_id')

        try:
            storage_key, bucket, checksum, file_size = backends.upload_to_cloud(
                provider=provider,
                file_obj=file_obj,
                category=category,
                original_filename=file_obj.name,
                linked_model=linked_model,
                linked_id=linked_id,
                org_slug=org.slug if org else 'platform'
            )

            stored_file = StoredFile.objects.create(
                organization=org,
                original_filename=file_obj.name,
                storage_key=storage_key,
                bucket=bucket,
                content_type=getattr(file_obj, 'content_type', 'application/octet-stream'),
                file_size=file_size,
                category=category,
                linked_model=linked_model,
                linked_id=linked_id,
                uploaded_by=request.user,
                checksum=checksum,
            )

            return Response(
                StoredFileSerializer(stored_file).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("File upload failed")
            return Response(
                {'error': f'Upload failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, uuid=None):
        """Generate a presigned download URL for a file."""
        stored_file = self.get_object()
        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request, 'organization', None) or \
                 getattr(request.user, 'organization_id', None)
        
        from erp.models import Organization
        org = Organization.objects.filter(id=org_id).first() if org_id else None
        provider = StorageProvider.get_for_organization(org)

        try:
            url = backends.generate_download_url(
                provider=provider,
                storage_key=stored_file.storage_key,
                bucket=stored_file.bucket,
            )
            return Response({'download_url': url, 'filename': stored_file.original_filename})
        except Exception as e:
            logger.exception("Download URL generation failed")
            return Response(
                {'error': f'Could not generate download URL: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def perform_destroy(self, instance):
        """Soft-delete: mark as deleted instead of removing the record."""
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])


class StorageProviderViewSet(viewsets.GenericViewSet):
    """
    Admin endpoints for managing the org's storage provider config.
    """
    permission_classes = [IsAuthenticated]

    def _get_provider(self, request):
        from erp.models import Organization
        from erp.middleware import get_current_tenant_id
        
        org_id = get_current_tenant_id()
        if not org_id:
            org_id = request.headers.get('X-Tenant-Id') or \
                     getattr(request, 'organization', None) or \
                     getattr(request.user, 'organization_id', None)
        
        if not org_id:
            return None
            
        # Resolve org object if it's an ID
        if isinstance(org_id, (int, str)):
            org = Organization.objects.filter(id=org_id).first()
        else:
            org = org_id
            
        if not org:
            return None
            
        provider, _ = StorageProvider.objects.get_or_create(
            organization=org,
            defaults={'provider_type': 'LOCAL', 'bucket_name': 'tsf-files', 'is_active': True}
        )
        return provider

    def list(self, request):
        """GET /storage/provider/ — read org's storage config."""
        provider = self._get_provider(request)
        if not provider:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(StorageProviderReadSerializer(provider).data)

    def update(self, request, *args, **kwargs):
        """PUT /storage/provider/ — update org's storage config."""
        provider = self._get_provider(request)
        if not provider:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = StorageProviderSerializer(provider, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StorageProviderReadSerializer(provider).data)

    @action(detail=False, methods=['post'], url_path='test')
    def test_connection(self, request):
        """POST /storage/provider/test/ — test R2/S3 connectivity."""
        provider = self._get_provider(request)
        if not provider:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        success, message = backends.test_connection(provider)
        return Response({
            'success': success,
            'message': message,
        }, status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST)
