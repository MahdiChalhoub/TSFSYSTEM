"""
Encryption Management API
===========================
Exposes endpoints for managing AES-256 encryption lifecycle per organization.
Only accessible by staff/superuser.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .encryption_service import EncryptionService
from .models import Organization
from .middleware import get_current_tenant_id


class EncryptionViewSet(viewsets.ViewSet):
    """
    AES-256 Encryption management endpoints.

    GET  /api/encryption/status/       — Current encryption status
    POST /api/encryption/activate/     — Activate encryption
    POST /api/encryption/deactivate/   — Deactivate encryption
    POST /api/encryption/rotate-key/   — Rotate encryption key
    """
    permission_classes = [permissions.IsAdminUser]

    def _get_org(self, request):
        """Get the current org from organization context."""
        organization_id = get_current_tenant_id()
        if not organization_id:
            return None
        try:
            return Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            return None

    @action(detail=False, methods=['get'])
    def status(self, request):
        org = self._get_org(request)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(EncryptionService.get_status(org))

    @action(detail=False, methods=['post'])
    def activate(self, request):
        org = self._get_org(request)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        force = request.data.get('force', False) and request.user.is_superuser
        result = EncryptionService.activate(org, force=force)
        http_status = status.HTTP_200_OK if result['success'] else status.HTTP_403_FORBIDDEN
        return Response(result, status=http_status)

    @action(detail=False, methods=['post'])
    def deactivate(self, request):
        org = self._get_org(request)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        result = EncryptionService.deactivate(org)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='rotate-key')
    def rotate_key(self, request):
        org = self._get_org(request)
        if not org:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)
        result = EncryptionService.rotate_key(org)
        http_status = status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=http_status)
