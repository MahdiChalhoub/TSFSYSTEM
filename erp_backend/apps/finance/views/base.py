from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from erp.views import TenantModelViewSet
from erp.lifecycle_mixin import LifecycleViewSetMixin
from erp.mixins import UDLEViewSetMixin
from erp.middleware import get_current_tenant_id
from erp.models import Organization, User

def _get_org_or_400(request):
    org_id = get_current_tenant_id()
    if not org_id:
        return None, Response({"error": "No organization context found"}, status=status.HTTP_400_BAD_REQUEST)
    return org_id, None
