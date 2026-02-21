from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .kernel_manager import KernelManager
from .models import SystemUpdate


class KernelViewSet(viewsets.ViewSet):
    """
    ViewSet for Kernel version management and updates.
    Viewing requires authentication, modifying requires staff/admin.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def list(self, request):
        """Returns current kernel version and all update records."""
        current_version = KernelManager.get_current_version()
        updates = SystemUpdate.objects.all().order_by('-created_at')
        
        update_list = [{
            'id': u.id,
            'version': u.version,
            'changelog': u.changelog or '',
            'is_applied': u.is_applied,
            'applied_at': u.applied_at.isoformat() if u.applied_at else None,
            'created_at': u.created_at.isoformat() if u.created_at else None,
        } for u in updates]
        
        return Response({
            'current_version': current_version,
            'updates': update_list
        })

    @action(detail=False, methods=['get'])
    def version(self, request):
        """Returns just the current kernel version."""
        return Response({
            'version': KernelManager.get_current_version()
        })

    @action(detail=False, methods=['post'])
    def stage(self, request):
        """Uploads and stages a .kernel.zip package."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.kernel.zip'):
            return Response({'error': 'Invalid file type. Must be .kernel.zip'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update_record = KernelManager.stage_update(file_obj)
            return Response({
                'message': f'Kernel update v{update_record.version} staged successfully',
                'update_id': update_record.id,
                'version': update_record.version,
                'changelog': update_record.changelog
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Applies a staged kernel update."""
        try:
            update = KernelManager.apply_update(pk)
            return Response({
                'message': f'Kernel update v{update.version} applied successfully',
                'version': update.version,
                'applied_at': update.applied_at.isoformat()
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def backups(self, request):
        """Lists available kernel backups for rollback."""
        backups = KernelManager.list_backups()
        return Response({
            'backups': [{
                'dir_name': b['dir_name'],
                'version': b['version'],
                'size_mb': b['size_mb'],
                'contents': b['contents'],
            } for b in backups]
        })

    @action(detail=False, methods=['post'])
    def rollback(self, request):
        """
        Rollback kernel to a previous backup.
        Requires: {"backup": "kernel_2.6.0_20260221123456"}
        """
        if not request.user.is_staff:
            return Response({'error': 'Staff access required'}, status=status.HTTP_403_FORBIDDEN)

        backup_dir = request.data.get('backup')
        if not backup_dir:
            return Response(
                {'error': 'Missing "backup" field. Use GET /api/kernel/backups/ to list available backups.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = KernelManager.rollback(backup_dir)
            return Response({
                'message': f'Kernel rolled back from {result["from_version"]} to {result["to_version"]}',
                'from_version': result['from_version'],
                'to_version': result['to_version'],
                'restored_dirs': result['restored_dirs'],
                'safety_backup': result['safety_backup'],
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
