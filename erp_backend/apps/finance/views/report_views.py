from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
from apps.finance.report_models import ReportDefinition

class ReportViewSet(TenantModelViewSet):
    """Report definition CRUD with run/export actions."""
    queryset = ReportDefinition.objects.all()

    def get_serializer_class(self):
        from rest_framework import serializers
        from apps.finance.report_models import ReportDefinition as RD

        class ReportDefinitionSerializer(serializers.ModelSerializer):
            class Meta:
                model = RD
                fields = '__all__'

        return ReportDefinitionSerializer

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        """Execute a report and return results (or export to file).
        Optional body: { "export_format": "EXCEL", "background": true }
        """
        from apps.finance.report_service import ReportService
        from apps.finance.report_models import ReportExecution
        from django.utils import timezone

        report_def = self.get_object()
        org_id = get_current_tenant_id()
        export_format = request.data.get('export_format')
        background = request.data.get('background', False)
        
        from erp.middleware import get_authorized_scope
        auth_scope = get_authorized_scope() or 'official'

        # Background execution via Celery
        if background:
            try:
                from erp.tasks import run_report_async
                task = run_report_async.delay(
                    str(report_def.pk), str(org_id),
                    export_format=export_format or report_def.default_export_format,
                    authorized_scope=auth_scope
                )
                return Response({
                    'status': 'QUEUED',
                    'task_id': task.id,
                    'message': f'Report "{report_def.name}" queued for background execution.'
                }, status=202)
            except Exception as e:
                return Response({'error': f'Failed to queue: {str(e)}'}, status=500)

        # Synchronous execution
        execution = ReportExecution.objects.create(
            organization_id=org_id,
            report=report_def,
            executed_by=request.user,
            export_format=export_format or report_def.default_export_format,
            status='RUNNING',
            started_at=timezone.now(),
        )

        service = ReportService(org_id, authorized_scope=auth_scope)

        try:
            if export_format:
                result = service.run_and_export(report_def, export_format=export_format)
                execution.status = 'COMPLETED' if 'error' not in result else 'FAILED'
                execution.row_count = result.get('row_count', 0)
                execution.output_file = result.get('file_path')
                execution.error_message = result.get('error')
                execution.completed_at = timezone.now()
                execution.save()
                return Response(result)
            else:
                data = service.execute(report_def)
                execution.status = 'COMPLETED' if 'error' not in data else 'FAILED'
                execution.row_count = data.get('row_count', 0)
                execution.error_message = data.get('error')
                execution.completed_at = timezone.now()
                execution.save()
                return Response(data)
        except Exception as e:
            execution.status = 'FAILED'
            execution.error_message = str(e)
            execution.completed_at = timezone.now()
            execution.save()
            return Response({'error': str(e)}, status=500)

    @action(detail=True, methods=['get'])
    def executions(self, request, pk=None):
        """Get execution history for a report."""
        from apps.finance.report_models import ReportExecution
        report = self.get_object()
        execs = ReportExecution.objects.filter(report=report).order_by('-created_at')[:20]
        return Response([{
            'id': str(e.id),
            'status': e.status,
            'export_format': e.export_format,
            'row_count': e.row_count,
            'output_file': e.output_file,
            'error_message': e.error_message,
            'started_at': e.started_at.isoformat() if e.started_at else None,
            'completed_at': e.completed_at.isoformat() if e.completed_at else None,
        } for e in execs])

    @action(detail=False, methods=['get'], url_path='data-sources')
    def data_sources(self, request):
        """List available data sources for report builder."""
        from apps.finance.report_service import MODEL_REGISTRY, _build_registry
        _build_registry()
        sources = []
        for name, model in MODEL_REGISTRY.items():
            fields = [{'field': f.name, 'type': f.get_internal_type()}
                      for f in model._meta.get_fields() if hasattr(f, 'column')]
            sources.append({'name': name, 'fields': fields})
        return Response(sources)
