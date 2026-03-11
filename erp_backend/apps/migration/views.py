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



from .views_setup import MigrationSetupMixin
from .views_execution import MigrationExecutionMixin
from .views_review import MigrationReviewMixin

class MigrationViewSet(MigrationSetupMixin, MigrationExecutionMixin, MigrationReviewMixin, viewsets.ModelViewSet):

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

    permission_classes = [permissions.IsAuthenticated, IsOrgAdmin]

    def get_queryset(self):
        org_id = getattr(self.request.user, 'organization_id', None)
        if self.request.user.is_superuser:
            org_id = self.request.headers.get('X-Tenant-Id') or org_id
        return MigrationJob.objects.filter(tenant_id=org_id).exclude(status='HIDDEN')


    def get_serializer_class(self):
        if self.action == 'upload':
            return MigrationUploadSerializer
        if self.action == 'connect':
            return MigrationDirectDBSerializer
        if self.action == 'link':
            return MigrationLinkSerializer
        if self.action == 'retrieve':
            return MigrationJobDetailSerializer
        return MigrationJobSerializer

