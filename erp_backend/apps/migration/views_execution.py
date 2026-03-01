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



class MigrationExecutionMixin:

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        """Start the migration in a background thread."""
        job = self.get_object()

        if job.status not in ('PENDING', 'FAILED', 'STALLED'):
            return Response(
                {'error': f'Cannot start migration in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # LOCK: Only one migration can run per organization at a time
        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)
        active_job = MigrationJob.objects.filter(
            organization_id=org_id,
            status__in=['RUNNING', 'PARSING']
        ).exclude(id=job.id).first()
        if active_job:
            return Response(
                {'error': f'Another migration (#{active_job.id} "{active_job.name}") is already {active_job.status}. '
                          f'Wait for it to finish, or cancel/rollback it first.'},
                status=status.HTTP_409_CONFLICT
            )

        # Accept business selection and sync mode
        source_business_id = request.data.get('source_business_id')
        source_business_name = request.data.get('source_business_name')
        migration_mode = request.data.get('migration_mode', 'FULL')

        # Enforce business selection if multiple exist
        businesses = job.discovered_data.get('businesses', []) if job.discovered_data else []
        if not source_business_id and len(businesses) > 1:
            return Response(
                {'error': 'Multiple businesses detected. Please select a specific business to import.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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


    @action(detail=True, methods=['post'], url_path='resume')
    def resume(self, request, pk=None):
        """Resume a failed/stalled migration from the last incomplete step."""
        job = self.get_object()

        if job.status not in ('FAILED', 'STALLED'):
            return Response(
                {'error': f'Cannot resume migration in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.migration.services import MigrationService
        completed = list(job.completed_steps or [])
        all_steps = [s[0] for s in MigrationService.MIGRATION_STEPS]

        # Find the first uncompleted step
        resume_from = None
        for step_name in all_steps:
            if step_name not in completed:
                resume_from = step_name
                break

        if not resume_from:
            # All steps completed, just mark as completed
            job.status = 'COMPLETED'
            job.progress = 100
            job.save()
            return Response({'status': 'already_complete', 'job_id': job.id})

        job.status = 'RUNNING'
        job.completed_at = None
        job.save()

        org_id = request.headers.get('X-Tenant-Id') or \
                 getattr(request.user, 'organization_id', None)

        from apps.migration.tasks import run_migration_task
        run_migration_task.delay(job.id, org_id, resume_from=resume_from)

        return Response({
            'status': 'resuming',
            'job_id': job.id,
            'resume_from': resume_from,
            'completed_steps': completed,
            'remaining_steps': [s for s in all_steps if s not in completed],
        })


    @action(detail=True, methods=['get'], url_path='pipeline')
    def pipeline(self, request, pk=None):
        """Return the step-by-step pipeline status for this job."""
        job = self.get_object()
        from apps.migration.services import MigrationService

        completed = set(job.completed_steps or [])
        all_steps = MigrationService.MIGRATION_STEPS
        current_step_name = None

        # Parse current_step label back to step name
        for step_name, step_label, _ in all_steps:
            if job.current_step and step_label == job.current_step:
                current_step_name = step_name
                break

        pipeline = []
        for step_name, step_label, progress in all_steps:
            if step_name in completed:
                step_status = 'completed'
            elif step_name == current_step_name and job.status == 'RUNNING':
                step_status = 'running'
            elif any(s[0] in completed for s in all_steps if s[2] > progress):
                step_status = 'completed'  # Passed
            else:
                step_status = 'pending'

            pipeline.append({
                'name': step_name,
                'label': step_label,
                'progress': progress,
                'status': step_status,
            })

        return Response({
            'job_id': job.id,
            'job_status': job.status,
            'progress': job.progress,
            'current_step': job.current_step,
            'current_step_detail': getattr(job, 'current_step_detail', None),
            'completed_count': len(completed),
            'total_steps': len(all_steps),
            'can_resume': job.status in ('FAILED', 'STALLED') and len(completed) > 0,
            'pipeline': pipeline,
        })


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

        if job.status not in ('COMPLETED', 'FAILED', 'STALLED', 'PARSING', 'RUNNING'):
            return Response(
                {'error': f'Cannot rollback migration in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        deleted = MigrationRollbackService.rollback(job)
        return Response({
            'status': 'rolled_back',
            'deleted_count': deleted,
        })


    @action(detail=True, methods=['delete'], url_path='delete-job')
    def delete_job(self, request, pk=None):
        """Delete or hide a failed/rolled-back migration job.
        
        Only allows deletion of jobs in terminal states (FAILED, STALLED, ROLLED_BACK, PENDING).
        - force=true: Hard delete (removes job + all mappings permanently)
        - force=false (default): Soft delete (marks status as hidden)
        """
        job = self.get_object()
        
        if job.status in ('RUNNING', 'PARSING'):
            return Response(
                {'error': f'Cannot delete a migration that is currently {job.status}. Cancel or wait for it to finish first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        force = request.query_params.get('force', 'false').lower() == 'true'
        job_name = job.name
        job_id = job.id
        mapping_count = MigrationMapping.objects.filter(job=job).count()
        
        if force:
            # Hard delete — remove everything
            MigrationMapping.objects.filter(job=job).delete()
            job.delete()
            return Response({
                'status': 'deleted',
                'job_id': job_id,
                'job_name': job_name,
                'mappings_deleted': mapping_count,
            })
        else:
            # Soft delete — mark as hidden so it disappears from the UI
            job.status = 'HIDDEN'
            job.save(update_fields=['status'])
            return Response({
                'status': 'hidden',
                'job_id': job_id,
                'job_name': job_name,
                'message': f'Job hidden from UI. Use force=true to permanently delete.',
            })
