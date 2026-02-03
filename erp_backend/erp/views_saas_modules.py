from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from .models import SystemModule, Organization, OrganizationModule
from .module_manager import ModuleManager

class SaaSModuleViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for Global Module Registry.
    Requires Staff/Superuser permissions and no organization context.
    """
    permission_classes = [permissions.IsAdminUser]

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
                'is_core': m.manifest.get('required', False),
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

        # Save temporarily
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import os
        from django.conf import settings

        temp_path = os.path.join(settings.BASE_DIR, 'tmp', file_obj.name)
        if not os.path.exists(os.path.dirname(temp_path)):
            os.makedirs(os.path.dirname(temp_path))

        path = default_storage.save(temp_path, ContentFile(file_obj.read()))
        full_path = os.path.join(settings.BASE_DIR, path)

        try:
            # We need to extract the module name from the zip or have it as a parameter
            # For simplicity, we'll try to get it from the filename (e.g., inventory_1.0.0.modpkg.zip)
            module_code = file_obj.name.split('_')[0]
            
            ModuleManager.upgrade(module_code, full_path, user=request.user)
            return Response({'message': f'Module {module_code} uploaded and installed successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            if os.path.exists(full_path):
                os.remove(full_path)

class OrgModuleViewSet(viewsets.ViewSet):
    """Management of modules for a specific Organization (SaaS View)"""
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        org = Organization.objects.get(id=pk)
        all_modules = SystemModule.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        enabled_modules = {om.module_name for om in org_modules if om.is_enabled}

        data = []
        for m in all_modules:
            is_core = m.manifest.get('required', False)
            data.append({
                'code': m.name,
                'name': m.name,
                'status': 'INSTALLED' if (is_core or m.name in enabled_modules) else 'UNINSTALLED',
                'is_core': is_core
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
