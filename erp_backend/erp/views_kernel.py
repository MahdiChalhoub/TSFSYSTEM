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
    Requires Staff/Superuser permissions.
    """
    permission_classes = [permissions.IsAdminUser]
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
