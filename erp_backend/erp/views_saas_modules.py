from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import SystemModule, Organization, OrganizationModule
from .module_manager import ModuleManager

class SaaSModuleViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for Global Module Registry.
    Requires Staff/Superuser permissions and no organization context.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def list(self, request):
        modules = SystemModule.objects.all().order_by('name')
        data = []
        for m in modules:
            # Count how many orgs have this installed
            install_count = OrganizationModule.objects.filter(module_name=m.name, is_enabled=True).count()
            data.append({
                'code': m.name,
                'name': m.manifest.get('name', m.name),
                'version': m.version,
                'description': m.manifest.get('description', ''),
                'dependencies': m.manifest.get('dependencies', []),
                'is_core': m.manifest.get('is_core', False) or m.manifest.get('required', False) or m.name in ['core', 'coreplatform'],
                'total_installs': install_count
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def sync_global(self, request):
        """Re-scans filesystem and updates SystemModule table"""
        names = ModuleManager.sync()
        return Response({'message': f'Synced {len(names)} modules from filesystem', 'codes': names})

    @action(detail=True, methods=['post'])
    def install_global(self, request, pk=None):
        """Installs a specific module for ALL organizations (feature grant)"""
        try:
            count = ModuleManager.install_for_all(pk)
            return Response({'message': f'Granted module {pk} for {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def uninstall_global(self, request, pk=None):
        """Revokes a specific module for ALL organizations"""
        try:
            count = ModuleManager.revoke_all(pk)
            return Response({'message': f'Revoked module {pk} from {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def delete_module(self, request, pk=None):
        """Wipes a module from registry and filesystem"""
        try:
            ModuleManager.delete(pk)
            return Response({'message': f'Module {pk} deleted successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def backups(self, request, pk=None):
        """Lists available backups for a module"""
        try:
            backups = ModuleManager.list_backups(pk)
            return Response(backups)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def rollback_module(self, request, pk=None):
        """Restores a previous version from backup"""
        target_version = request.data.get('target_version')
        if not target_version:
            return Response({'error': 'target_version is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ModuleManager.rollback(pk, target_version)
            return Response({'message': f'Module {pk} rolled back to {target_version}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_module(self, request):
        """Handles .modpkg.zip upload and installation"""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.modpkg.zip'):
            return Response({'error': 'Invalid file type. Must be .modpkg.zip'}, status=status.HTTP_400_BAD_REQUEST)

        # Save temporarily using direct IO to avoid storage path mixups
        import os
        from django.conf import settings

        temp_dir = os.path.join(settings.BASE_DIR, 'tmp')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        full_path = os.path.join(temp_dir, file_obj.name)
        
        # Write chunks to avoid memory issues
        with open(full_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)

        try:
            # Re-read name handling
            module_code = file_obj.name.split('_')[0]
            
            ModuleManager.upgrade(module_code, full_path, user=request.user)
            return Response({'message': f'Module {module_code} uploaded and installed successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            if os.path.exists(full_path):
                os.remove(full_path)

    @action(detail=False, methods=['get'])
    def sidebar(self, request):
        """Returns aggregated sidebar items for the current session context"""
        # 1. Start with Core items (Always visible)
        items = []
        
        # 2. Add items from ACTIVE modules
        # If no organization context, we treat as MASTER PANEL (is_saas)
        # BUGFIX: Also treat 'saas' slug organization as SaaS context for panel visibility
        is_saas = not hasattr(request, 'tenant') or request.tenant is None or getattr(request.tenant, 'slug', '') == 'saas'
        
        active_modules = SystemModule.objects.all()
        for m in active_modules:
            # Verify module exists in filesystem before trusting manifest
            mod_path = ModuleManager.get_module_path(m.name)
            if not mod_path:
                continue
                
            # Extract sidebar items from manifest
            mod_items = m.manifest.get('sidebar_items', [])
            for item in mod_items:
                # Visibility check: Some items only show in SaaS, some only in Tenant
                if item.get('visibility') == 'saas' and not is_saas:
                    continue
                if item.get('visibility') == 'tenant' and is_saas:
                    continue
                    
                items.append(item)
                
        return Response(items)

class OrgModuleViewSet(viewsets.ViewSet):
    """Management of modules for a specific Organization (SaaS View)"""
    permission_classes = [permissions.IsAdminUser]

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
            
            # [FEATURE FLAGS] Extract features from manifest
            available_features = m.manifest.get('features', [])
            
            data.append({
                'code': m.name,
                'name': m.name,
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
                    organization_id=org_id,
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
                organization_id=org_id,
                module_name=module_code
            ).update(active_features=features)
            return Response({'message': 'Features updated successfully', 'features': features})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
