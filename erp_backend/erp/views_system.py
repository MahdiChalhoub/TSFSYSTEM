from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from .models import SystemUpdate
from .kernel_manager import KernelManager
from .permissions import IsOrgAdmin

class SystemUpdateViewSet(viewsets.ViewSet):
    """
    Privileged API for System Updates (Kernel).
    """
    permission_classes = [IsOrgAdmin] # Platform Admins only
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """
        Returns the current system integrity and kernel version.
        """
        return Response({
            "current_version": KernelManager.get_current_version(),
            "last_check": timezone.now().isoformat(),
            "integrity": "verified",
            "environment": "Windows/Dajingo-Core"
        })

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Stages a kernel update package.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update = KernelManager.stage_update(file_obj)
            return Response({
                "message": f"Kernel update v{update.version} staged successfully.",
                "id": update.id,
                "version": update.version,
                "changelog": update.changelog
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def apply(self, request):
        """
        Applies a staged update.
        """
        update_id = request.data.get('id')
        if not update_id:
            return Response({"error": "Update ID required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update = KernelManager.apply_update(update_id)
            return Response({
                "message": f"System updated successfully to v{update.version}.",
                "version": update.version,
                "applied_at": update.applied_at.isoformat()
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        Returns list of all applied/staged updates.
        """
        updates = SystemUpdate.objects.all()
        return Response([{
            "id": u.id,
            "version": u.version,
            "changelog": u.changelog,
            "is_applied": u.is_applied,
            "applied_at": u.applied_at.isoformat() if u.applied_at else None,
            "created_at": u.created_at.isoformat()
        } for u in updates])
