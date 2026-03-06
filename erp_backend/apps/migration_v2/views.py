"""
Migration v2 Views
=================
API endpoints for migration workflow.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import MigrationJob, MigrationMapping, MigrationValidationResult
from .serializers import MigrationJobSerializer, MigrationMappingSerializer
from .services import MigrationValidatorService


class MigrationJobViewSet(viewsets.ModelViewSet):
    """
    ViewSet for migration jobs.

    Endpoints:
    - list: Get all migration jobs
    - create: Create new migration job
    - retrieve: Get single job details
    - validate: Run pre-flight validation
    - start: Start migration execution
    """
    serializer_class = MigrationJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter jobs by current user's accessible organizations."""
        return MigrationJob.objects.all().order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='create-job')
    def create_job(self, request):
        """
        Create a new migration job.

        Body:
        {
          "name": "UltimatePOS Migration - March 2026",
          "target_organization_id": 1,
          "coa_template": "SYSCOHADA"
        }
        """
        name = request.data.get('name')
        target_org_id = request.data.get('target_organization_id')
        coa_template = request.data.get('coa_template')

        if not all([name, target_org_id]):
            return Response(
                {'error': 'name and target_organization_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from erp.models import Organization
        try:
            organization = Organization.objects.get(id=target_org_id)
        except Organization.DoesNotExist:
            return Response(
                {'error': f'Organization {target_org_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create job
        job = MigrationJob.objects.create(
            name=name,
            target_organization=organization,
            coa_template_used=coa_template,
            status='DRAFT',
            created_by=request.user
        )

        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_prerequisites(self, request, pk=None):
        """
        Run pre-flight validation for a migration job.

        Returns validation results with errors/warnings.
        """
        job = self.get_object()

        # Run validation
        result = MigrationValidatorService.validate_prerequisites(job.target_organization)

        # Store validation result
        MigrationValidationResult.objects.update_or_create(
            job=job,
            defaults={
                'is_valid': result['is_valid'],
                'has_coa': result['coa_summary'].get('total_accounts', 0) >= 10,
                'coa_account_count': result['coa_summary'].get('total_accounts', 0),
                'has_posting_rules': result['is_valid'],
                'errors': result['errors'],
                'warnings': result['warnings']
            }
        )

        # Update job status
        if result['is_valid']:
            job.status = 'READY'
            job.posting_rules_snapshot = result['posting_rules_summary']
        else:
            job.status = 'VALIDATING'

        job.save()

        return Response(result)

    @action(detail=True, methods=['get'], url_path='mappings')
    def get_mappings(self, request, pk=None):
        """
        Get all mappings for this job.

        Query params:
        - entity_type: Filter by entity type
        - verify_status: Filter by verification status
        """
        job = self.get_object()

        mappings = MigrationMapping.objects.filter(job=job)

        # Apply filters
        entity_type = request.query_params.get('entity_type')
        if entity_type:
            mappings = mappings.filter(entity_type=entity_type)

        verify_status = request.query_params.get('verify_status')
        if verify_status:
            mappings = mappings.filter(verify_status=verify_status)

        serializer = MigrationMappingSerializer(mappings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='start')
    def start_migration(self, request, pk=None):
        """
        Start the migration execution.
        (Placeholder - will trigger Celery task)
        """
        job = self.get_object()

        if job.status != 'READY':
            return Response(
                {'error': f'Job must be in READY status (current: {job.status})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # TODO: Trigger Celery task
        job.status = 'RUNNING'
        job.started_at = timezone.now()
        job.save()

        return Response({
            'message': 'Migration started',
            'job_id': job.id,
            'status': job.status
        })
