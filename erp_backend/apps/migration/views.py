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
)
from apps.migration.services import MigrationService, MigrationRollbackService
from apps.migration.parsers import SQLDumpParser

logger = logging.getLogger(__name__)

# Directory where uploaded SQL files are stored
MIGRATION_UPLOAD_DIR = os.path.join(
    getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media')),
    'migration_uploads'
)


class MigrationViewSet(viewsets.ModelViewSet):
    """
    API for managing data migrations from UltimatePOS.

    list:    GET  /api/migration/jobs/
    detail:  GET  /api/migration/jobs/{id}/
    upload:  POST /api/migration/upload/
    connect: POST /api/migration/connect/
    preview: GET  /api/migration/jobs/{id}/preview/
    start:   POST /api/migration/jobs/{id}/start/
    logs:    GET  /api/migration/jobs/{id}/logs/
    rollback: POST /api/migration/jobs/{id}/rollback/
    """
    serializer_class = MigrationJobSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        org_id = self.request.headers.get('X-Tenant-Id') or \
                 getattr(self.request.user, 'organization_id', None)
        return MigrationJob.objects.filter(organization_id=org_id)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MigrationJobDetailSerializer
        return MigrationJobSerializer

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        """Upload a SQL dump file and create a pending migration job via Cloud Storage."""
        serializer = MigrationUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data['file']
        name = serializer.validated_data.get('name', 'UltimatePOS Migration')

        # Get tenant context
        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)
        
        from erp.models import Organization
        org = Organization.objects.filter(id=org_id).first()
        org_slug = org.slug if org else 'default'

        # Upload to Cloud Storage
        from apps.storage.backends import upload_to_cloud
        from apps.storage.models import StoredFile, StorageProvider
        
        provider = StorageProvider.objects.filter(organization_id=org_id).first()
        
        # Use the universal storage logic
        storage_key, bucket, checksum, file_size = upload_to_cloud(
            uploaded_file,
            category='MIGRATION',
            provider=provider,
            org_slug=org_slug,
            linked_model='data_migration.MigrationJob',
            # linked_id will be set after job creation
        )

        # Create StoredFile record
        stored_file = StoredFile.objects.create(
            organization_id=org_id,
            original_filename=uploaded_file.name,
            storage_key=storage_key,
            bucket=bucket,
            checksum=checksum,
            file_size=file_size,
            category='MIGRATION',
            uploaded_by=request.user if request.user.is_authenticated else None,
            linked_model='data_migration.MigrationJob',
        )

        # Create migration job linked to stored_file
        job = MigrationJob.objects.create(
            organization_id=org_id,
            name=name,
            source_type='SQL_DUMP',
            stored_file=stored_file,
            created_by=request.user if request.user.is_authenticated else None,
        )

        # Update stored_file with job ID
        stored_file.linked_id = job.id
        stored_file.save()

        return Response(
            MigrationJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'], url_path='connect')
    def connect(self, request):
        """Create a migration job using direct DB connection."""
        serializer = MigrationDirectDBSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)

        job = MigrationJob.objects.create(
            organization_id=org_id,
            name=serializer.validated_data.get('name', 'UltimatePOS Migration'),
            source_type='DIRECT_DB',
            db_host=serializer.validated_data['db_host'],
            db_port=serializer.validated_data.get('db_port', 3306),
            db_name=serializer.validated_data['db_name'],
            db_user=serializer.validated_data['db_user'],
            db_password=serializer.validated_data['db_password'],
            created_by=request.user if request.user.is_authenticated else None,
        )

        return Response(
            MigrationJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'], url_path='businesses')
    def businesses(self, request, pk=None):
        """Discover available businesses in the uploaded SQL dump."""
        job = self.get_object()

        if job.source_type == 'SQL_DUMP':
            file_path = self._get_job_file_path(job)
            parser = SQLDumpParser(file_path=file_path)
            parser.parse()
            businesses = parser.get_businesses()

            # Also count records per business for context
            for biz in businesses:
                biz_id = biz['id']
                # Use streaming counts
                counts = parser.get_table_counts(business_id=biz_id)
                biz['products'] = counts.get('products', 0)
                biz['contacts'] = counts.get('contacts', 0)
                biz['transactions'] = counts.get('transactions', 0)
                biz['locations'] = counts.get('business_locations', 0)
        else:
            # For direct DB, query the business table
            from apps.migration.parsers import DirectDBReader
            reader = DirectDBReader(
                host=job.db_host, port=job.db_port or 3306,
                database=job.db_name, user=job.db_user, password=job.db_password,
            )
            reader.connect()
            businesses_raw = reader.read_table('business')
            reader.close()
            businesses = [
                {'id': b.get('id'), 'name': b.get('name', f"Business #{b.get('id')}")}
                for b in businesses_raw
            ]

        return Response({'businesses': businesses})

    @action(detail=True, methods=['get'], url_path='preview')
    def preview(self, request, pk=None):
        """Preview what data will be migrated (table counts), optionally filtered by business_id."""
        job = self.get_object()
        business_id = request.query_params.get('business_id') or job.source_business_id

        if job.source_type == 'SQL_DUMP':
            file_path = self._get_job_file_path(job)
            parser = SQLDumpParser(file_path=file_path)
            parser.parse()
            counts = parser.get_table_counts(business_id=business_id)
        else:
            from apps.migration.parsers import DirectDBReader
            reader = DirectDBReader(
                host=job.db_host, port=job.db_port or 3306,
                database=job.db_name, user=job.db_user, password=job.db_password,
            )
            reader.connect()
            counts = reader.get_table_counts()
            reader.close()

        return Response({'tables': counts})

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        """Start the migration in a background thread."""
        job = self.get_object()

        if job.status not in ('PENDING', 'FAILED'):
            return Response(
                {'error': f'Cannot start migration in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Accept business selection and sync mode
        source_business_id = request.data.get('source_business_id')
        source_business_name = request.data.get('source_business_name')
        migration_mode = request.data.get('migration_mode', 'FULL')

        if source_business_id:
            job.source_business_id = int(source_business_id)
        if source_business_name:
            job.source_business_name = source_business_name
        if migration_mode in ('FULL', 'SYNC'):
            job.migration_mode = migration_mode
        job.save()

        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)

        from apps.migration.tasks import run_migration_task
        run_migration_task.delay(job.id, org_id)

        return Response(MigrationJobSerializer(job).data)

    @action(detail=True, methods=['get'], url_path='logs')
    def logs(self, request, pk=None):
        """Get migration mappings/logs for a job."""
        job = self.get_object()
        entity_type = request.query_params.get('entity_type')

        mappings = MigrationMapping.objects.filter(job=job)
        if entity_type:
            mappings = mappings.filter(entity_type=entity_type.upper())

        mappings = mappings.order_by('-created_at')[:200]

        return Response({
            'error_log': job.error_log,
            'mappings': MigrationMappingSerializer(mappings, many=True).data
        })

    @action(detail=True, methods=['post'], url_path='rollback')
    def rollback(self, request, pk=None):
        """Rollback a migration — delete all imported data."""
        job = self.get_object()

        if job.status not in ('COMPLETED', 'FAILED'):
            return Response(
                {'error': f'Cannot rollback migration in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deleted = MigrationRollbackService.rollback(job)
        return Response({
            'status': 'rolled_back',
            'deleted_count': deleted,
        })

    def _get_job_file_path(self, job):
        """Helper to get a local path for the migration file."""
        if job.stored_file:
            from apps.storage.backends import get_local_path
            return get_local_path(
                job.stored_file.storage_provider,
                job.stored_file.storage_key,
                job.stored_file.bucket
            )
        return job.file_path
