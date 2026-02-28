"""
Migration Module API Views.
Provides endpoints for uploading SQL dumps, running migrations, checking status, and rollback.
"""
import os
import threading
import logging
import re

from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.serializers import (
    MigrationJobSerializer, MigrationJobDetailSerializer,
    MigrationUploadSerializer, MigrationDirectDBSerializer,
    MigrationMappingSerializer, MigrationPreviewSerializer,
    MigrationLinkSerializer,
)
from apps.migration.services import MigrationService, MigrationRollbackService
from apps.migration.parsers import SQLDumpParser

from rest_framework import permissions
from erp.permissions import IsOrgAdmin
from django.db import transaction

logger = logging.getLogger(__name__)

# Directory where uploaded SQL files are stored
MIGRATION_UPLOAD_DIR = os.path.join(
    getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media')),
    'migration_uploads'
)



class MigrationSetupMixin:

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """Upload a SQL dump file and start a migration job."""
        serializer = MigrationUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data['file']
        name = serializer.validated_data.get('name', 'UltimatePOS Migration')

        # Get tenant context from middleware
        org = getattr(request, 'organization', None)
        if not org:
             return Response({'error': 'Organization context required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        org_id = org.id
        org_slug = org.slug

        # Get storage provider
        from apps.storage.models import StorageProvider
        provider = StorageProvider.get_for_organization(org)
        
        # Use the universal storage logic
        from apps.storage.backends import upload_to_cloud
        storage_key, bucket, checksum, file_size = upload_to_cloud(
            provider=provider,
            file_obj=uploaded_file,
            category='MIGRATION',
            original_filename=uploaded_file.name,
            org_slug=org_slug,
            linked_model='migration.MigrationJob',
        )

        from apps.storage.models import StoredFile
        # Create StoredFile record
        stored_file = StoredFile.objects.create(
            organization_id=org_id,
            original_filename=uploaded_file.name,
            storage_key=storage_key,
            bucket=bucket,
            checksum=checksum,
            file_size=file_size,
            category='MIGRATION',
            uploaded_by=request.user,
            linked_model='migration.MigrationJob',
        )

        # Create migration job linked to stored_file
        job = MigrationJob.objects.create(
            organization_id=org_id,
            name=name,
            source_type='SQL_DUMP',
            stored_file=stored_file,
            created_by=request.user,
        )

        # Update stored_file with job ID
        stored_file.linked_id = job.id
        stored_file.save()

        # Trigger background analysis
        from apps.migration.tasks import analyze_migration_task
        analyze_migration_task.delay(job.id)

        return Response(
            MigrationJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )


    @action(detail=False, methods=['post'], url_path='link')
    def link(self, request):
        """Create a migration job linked to an existing StoredFile."""
        serializer = MigrationLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_uuid = serializer.validated_data['file_uuid']
        name = serializer.validated_data.get('name', 'UltimatePOS Migration')

        from apps.storage.models import StoredFile
        stored_file = StoredFile.objects.filter(uuid=file_uuid).first()
        if not stored_file:
            return Response({'error': 'StoredFile not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Get tenant context
        org_id = getattr(request.user, 'organization_id', None)
        if request.user.is_superuser:
            org_id = request.headers.get('X-Tenant-Id') or org_id

        # Create migration job
        job = MigrationJob.objects.create(
            organization_id=org_id,
            name=name,
            source_type='SQL_DUMP',
            stored_file=stored_file,
            created_by=request.user,
        )

        return Response(
            MigrationJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )


    @action(detail=False, methods=['post'], url_path='connect')
    def connect(self, request):
        """Create a migration job using direct DB connection."""
        serializer = MigrationDirectDBSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        org_id = getattr(request.user, 'organization_id', None)
        if request.user.is_superuser:
            org_id = request.headers.get('X-Tenant-Id') or org_id

        job = MigrationJob.objects.create(
            organization_id=org_id,
            name=serializer.validated_data.get('name', 'UltimatePOS Migration'),
            source_type='DIRECT_DB',
            db_host=serializer.validated_data['db_host'],
            db_port=serializer.validated_data.get('db_port', 3306),
            db_name=serializer.validated_data['db_name'],
            db_user=serializer.validated_data['db_user'],
            created_by=request.user,
        )
        job.set_db_password(serializer.validated_data['db_password'])
        job.save()

        # Trigger background analysis
        from apps.migration.tasks import analyze_migration_task
        analyze_migration_task.delay(job.id)

        return Response(
            MigrationJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )


    @action(detail=True, methods=['get'], url_path='businesses')
    def businesses(self, request, pk=None):
        """Get discovered businesses from metadata (analyzed in background)."""
        job = self.get_object()

        if job.discovered_data and 'businesses' in job.discovered_data:
            return Response({'businesses': job.discovered_data['businesses']})
        
        if job.status == 'PARSING':
            return Response({'status': 'analyzing', 'message': 'Still analyzing source file...'}, 
                            status=status.HTTP_202_ACCEPTED)
        
        if job.status == 'FAILED' and job.error_log:
             return Response({'status': 'failed', 'error': job.error_log}, 
                             status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Fallback: Trigger analysis if missing and not already running
        from apps.migration.tasks import analyze_migration_task
        analyze_migration_task.delay(job.id)
        
        return Response({'status': 'analyzing', 'message': 'Analysis started...'}, 
                        status=status.HTTP_202_ACCEPTED)


    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        """Preview table counts from background analysis."""
        job = self.get_object()
        business_id = request.query_params.get('business_id') or job.source_business_id
        
        if not job.discovered_data:
            return Response({'status': 'analyzing', 'message': 'Analysis in progress...'}, 
                            status=status.HTTP_202_ACCEPTED)
        
        # If business_id is specified, find that business's counts
        if business_id:
            businesses = job.discovered_data.get('businesses', [])
            for biz in businesses:
                if str(biz['id']) == str(business_id):
                    counts = biz.get('counts', {})
                    logger.info(f"Preview for job {pk}, business {business_id}: Found {len(counts)} table counts")
                    return Response({'tables': counts})
        
        # Fallback to global counts
        global_counts = job.discovered_data.get('global_counts', {})
        logger.info(f"Preview for job {pk}, global fallback: Found {len(global_counts)} table counts")
        return Response({'tables': global_counts})


    def _get_job_file_path(self, job):
        """Helper to get a local path for the migration file."""
        if job.stored_file:
            from apps.storage.models import StorageProvider
            provider = StorageProvider.get_for_organization(job.organization)
            from apps.storage.backends import get_local_path
            return get_local_path(
                provider,
                job.stored_file.storage_key,
                job.stored_file.bucket
            )
        return job.file_path

