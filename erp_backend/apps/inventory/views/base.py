from datetime import timedelta
from django.db import transaction
from django.db.models import Count, DecimalField, Q, Sum, Avg, F
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from erp.middleware import get_current_tenant_id
from erp.models import Organization, Site
from erp.views import TenantModelViewSet

def _get_org_or_400():
    """Returns (organization, None) or (None, Response)."""
    organization_id = get_current_tenant_id()
    if not organization_id:
        return None, Response({"error": "No organization context"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        org = Organization.objects.get(id=organization_id)
        return org, None
    except Organization.DoesNotExist:
        return None, Response({"error": "Organization not found"}, status=status.HTTP_404_NOT_FOUND)
