from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from erp.middleware import get_current_tenant_id
from erp.models import Organization, User
from erp.views import TenantModelViewSet, UDLEViewSetMixin

# Gated cross-module imports
try:
    from apps.inventory.models import Warehouse, Product
except ImportError:
    Warehouse = None
    Product = None

try:
    from apps.pos.services import PDFService
except ImportError:
    PDFService = None
