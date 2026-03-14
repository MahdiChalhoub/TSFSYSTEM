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

# Connector Governance Layer
from erp.connector_registry import connector
Warehouse = connector.require('inventory.warehouses.get_model', org_id=0, source='pos')
Product = connector.require('inventory.products.get_model', org_id=0, source='pos')

try:
    from apps.pos.services import PDFService
except ImportError:
    PDFService = None
