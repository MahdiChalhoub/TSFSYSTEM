from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from django.db import models as models
from .models import SystemModule, Organization, OrganizationModule, SystemUpdate
from .module_manager import ModuleManager
from .kernel_manager import KernelManager
import logging

logger = logging.getLogger(__name__)


class SaaSUpdateViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for System Kernel Updates.
    Identical to Windows Update - handles core OS/Kernel patching.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Returns the current running kernel version and environment info"""
        return Response({
            'current_version': KernelManager.get_current_version(),
            'integrity': 'Verified',
            'environment': 'Production' if not settings.DEBUG else 'Development'
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Returns the history of staged and applied updates"""
        updates = SystemUpdate.objects.all().order_by('-created_at')
        data = []
        for u in updates:
            data.append({
                'id': u.id,
                'version': u.version,
                'changelog': u.changelog,
                'is_applied': u.is_applied,
                'applied_at': u.applied_at,
                'created_at': u.created_at
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Handles .kernel.zip upload and staging"""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.kernel.zip'):
            return Response({'error': 'Invalid file type. Must be .kernel.zip'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update_record = KernelManager.stage_update(file_obj)
            return Response({
                'message': f'Kernel v{update_record.version} staged successfully.',
                'id': update_record.id
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def apply(self, request):
        """Applies a staged update"""
        update_id = request.data.get('id')
        if not update_id:
            return Response({'error': 'Update ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            update = KernelManager.apply_update(update_id)
            return Response({'message': f'System successfully updated to v{update.version}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def backups(self, request):
        """Lists available core kernel backups"""
        try:
            return Response(KernelManager.list_backups())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def rollback(self, request):
        """Restores kernel from a specific backup folder"""
        backup_folder = request.data.get('backup_folder')
        if not backup_folder:
            return Response({'error': 'backup_folder is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            version = KernelManager.rollback(backup_folder)
            # Trigger hot-reload after rollback
            ModuleManager.trigger_reload()
            return Response({'message': f'System successfully rolled back to v{version}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
