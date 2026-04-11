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



class OrgSaasSitesMixin:

    # ─── Site Management Endpoints ────────────────────────────────────

    @action(detail=True, methods=['get'])
    def sites(self, request, pk=None):
        """List all sites (BRANCH warehouses) for an organization"""
        from apps.inventory.models import Warehouse
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        sites = Warehouse.objects.filter(organization=org, location_type='BRANCH').order_by('-created_at')
        data = [{
            'id': str(s.id),
            'name': s.name,
            'code': s.code or '',
            'address': s.address or '',
            'city': s.city or '',
            'phone': s.phone or '',
            'vat_number': s.vat_number or '',
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat() if s.created_at else None,
        } for s in sites]

        return Response(data)


    @action(detail=True, methods=['post'])
    def create_site(self, request, pk=None):
        """Create a new site (BRANCH warehouse) in an organization"""
        from apps.inventory.models import Warehouse
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name', '').strip()
        code = request.data.get('code', '').strip()
        address = request.data.get('address', '').strip()
        city = request.data.get('city', '').strip()
        phone = request.data.get('phone', '').strip()
        vat_number = request.data.get('vat_number', '').strip()

        if not name:
            return Response({'error': 'Site name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check unique code per org
        if code and Warehouse.objects.filter(code=code, organization=org).exists():
            return Response({'error': f'Location code "{code}" already exists in this organization'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            site = Warehouse.objects.create(
                name=name,
                code=code or None,
                address=address or None,
                city=city or None,
                phone=phone or None,
                vat_number=vat_number or None,
                organization=org,
                is_active=True,
                location_type='BRANCH',
            )
            return Response({
                'message': f'Site "{name}" created successfully',
                'site': {
                    'id': str(site.id),
                    'name': site.name,
                    'code': site.code,
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'])
    def toggle_site(self, request, pk=None):
        """Toggle site active/inactive"""
        from apps.inventory.models import Warehouse
        site_id = request.data.get('site_id')

        if not site_id:
            return Response({'error': 'site_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            site = Warehouse.objects.get(id=site_id, organization_id=pk, location_type='BRANCH')
            site.is_active = not site.is_active
            site.save(update_fields=['is_active'])
            status_text = 'activated' if site.is_active else 'deactivated'
            return Response({'message': f'Site "{site.name}" {status_text}'})
        except Warehouse.DoesNotExist:
            return Response({'error': 'Site not found in this organization'}, status=status.HTTP_404_NOT_FOUND)

