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



class OrgSaasModulesMixin:

    @action(detail=False, methods=['get'])
    def business_types(self, request):
        """List all available business types"""
        from erp.models import BusinessType
        data = [{'id': str(bt.id), 'name': bt.name, 'slug': bt.slug, 'description': bt.description or ''} for bt in BusinessType.objects.all().order_by('name')]
        return Response(data)


    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        org = Organization.objects.get(id=pk)
        all_modules = SystemModule.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        # Helper lookup for enabled modules
        enabled_map = {om.module_name: om for om in org_modules if om.is_enabled}

        data = []
        for m in all_modules:
            is_core = m.manifest.get('is_core', False) or m.manifest.get('required', False) or m.name in ['core', 'coreplatform']
            om_record = enabled_map.get(m.name)
            
            # [FEATURE FLAGS] Extract features from manifest, fallback to defaults
            available_features = m.manifest.get('features', [])
            if not available_features:
                available_features = self.DEFAULT_FEATURES.get(m.name, [])
            
            # [FIX] Use human-readable name and description from manifest
            display_name = m.manifest.get('name', m.name.replace('_', ' ').title())
            description = m.manifest.get('description', '')
            icon = m.manifest.get('icon', '')
            
            data.append({
                'code': m.name,
                'name': display_name,
                'description': description,
                'icon': icon,
                'status': 'INSTALLED' if (is_core or m.name in enabled_map) else 'UNINSTALLED',
                'is_core': is_core,
                'active_features': om_record.active_features if om_record else [],
                'available_features': available_features
            })
        return Response(data)


    @action(detail=True, methods=['post'])
    def toggle_module(self, request, pk=None):
        org_id = pk
        module_code = request.data.get('module_code')
        action_type = request.data.get('action') # 'enable' or 'disable'

        try:
            if action_type == 'enable':
                ModuleManager.grant_access(module_code, org_id)
            else:
                OrganizationModule.objects.filter(
                    tenant_id=org_id,
                    module_name=module_code
                ).update(is_enabled=False)
            return Response({'message': 'Success'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'])
    def update_features(self, request, pk=None):
        org_id = pk
        module_code = request.data.get('module_code')
        features = request.data.get('features', []) # List of strings

        try:
            OrganizationModule.objects.filter(
                tenant_id=org_id,
                module_name=module_code
            ).update(active_features=features)
            return Response({'message': 'Features updated successfully', 'features': features})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

