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


class SaaSModuleViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for Global Module Registry.
    Requires Staff/Superuser permissions and no organization context.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_permissions(self):
        if self.action in ['list', 'sidebar']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def list(self, request):
        modules = SystemModule.objects.all().order_by('name')
        data = []
        for m in modules:
            code = m.manifest.get('code', m.name)
            # Count how many orgs have this installed
            install_count = OrganizationModule.objects.filter(module_name=m.name, is_enabled=True).count()
            data.append({
                'code': code,
                'name': m.manifest.get('name', m.name),
                'version': m.version,
                'description': m.description or m.manifest.get('description', ''),
                'icon': m.icon or '',
                'visibility': m.visibility,
                'features': m.manifest.get('features', []),
                'dependencies': m.manifest.get('dependencies', []),
                'is_core': m.manifest.get('is_core', False) or m.manifest.get('required', False) or code in ['core', 'coreplatform'],
                'total_installs': install_count
            })
        return Response(data)

    @action(detail=True, methods=['patch'], url_path='update')
    def update_module(self, request, pk=None):
        """Update module visibility, description, icon"""
        try:
            m = SystemModule.objects.get(name=pk)
        except SystemModule.DoesNotExist:
            try:
                m = SystemModule.objects.get(manifest__code=pk)
            except SystemModule.DoesNotExist:
                return Response({'error': 'Module not found'}, status=status.HTTP_404_NOT_FOUND)

        d = request.data
        if 'visibility' in d and d['visibility'] in ['public', 'organization', 'private']:
            m.visibility = d['visibility']
        if 'description' in d:
            m.description = d['description']
        if 'icon' in d:
            m.icon = d['icon']
        m.save()
        return Response({
            'code': m.manifest.get('code', m.name),
            'visibility': m.visibility,
            'description': m.description,
            'icon': m.icon,
            'message': f'Module {m.name} updated'
        })


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
            # Extract module code from filename: module_v1.0.0.modpkg.zip OR module.modpkg.zip
            base_name = file_obj.name.replace('.modpkg.zip', '')
            if '_v' in base_name:
                module_code = base_name.split('_v')[0]
            elif '_' in base_name:
                module_code = base_name.split('_')[0]
            else:
                module_code = base_name
            
            ModuleManager.upgrade(module_code, full_path, user=request.user)
            return Response({'message': f'Module {module_code} uploaded and installed successfully'})
        except Exception as e:
            import traceback
            traceback.print_exc()  # Log full error to console
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
        is_saas = not hasattr(request, 'organization') or request.organization is None or getattr(request.organization, 'slug', '') == 'saas'
        
        active_modules = SystemModule.objects.all()
        for m in active_modules:
            # ARCHITECTURE: Skip core/platform modules — their sidebar items
            # are already hardcoded in the frontend Sidebar.tsx (MENU_ITEMS).
            # Only business modules should inject dynamic sidebar items.
            manifest = m.manifest or {}
            if manifest.get('is_core', False) or manifest.get('category') == 'core':
                continue

            # Verify module exists in filesystem before trusting manifest
            mod_path = ModuleManager.get_module_path(m.name)
            if not mod_path:
                continue
                
            # Extract sidebar items from manifest
            mod_items = manifest.get('sidebar_items', [])
            for item in mod_items:
                # Visibility check: Some items only show in SaaS, some only in Tenant
                if item.get('visibility') == 'saas' and not is_saas:
                    continue
                if item.get('visibility') == 'organization' and is_saas:
                    continue
                    
                items.append(item)
                
        return Response(items)

    # ── AES-256 Encryption Management ────────────────────────────────

    @action(detail=False, methods=['get'], url_path='encryption/status')
    def encryption_status(self, request):
        """Get encryption status for the current organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'organization', None)
        if not org:
            return Response({'error': 'No organization context'}, status=400)
        return Response(EncryptionService.get_status(org))

    @action(detail=False, methods=['post'], url_path='encryption/activate')
    def encryption_activate(self, request):
        """Activate AES-256 encryption for an organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'organization', None)
        if not org:
            # Allow superadmin to specify org_id
            org_id = request.data.get('organization_id')
            if org_id and request.user.is_superuser:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)

        force = request.user.is_superuser and request.data.get('force', False)
        result = EncryptionService.activate(org, force=force)
        return Response(result, status=200 if result['success'] else 403)

    @action(detail=False, methods=['post'], url_path='encryption/deactivate')
    def encryption_deactivate(self, request):
        """Deactivate encryption for an organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'organization', None)
        if not org:
            org_id = request.data.get('organization_id')
            if org_id and request.user.is_superuser:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)
        
        result = EncryptionService.deactivate(org)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='encryption/rotate-key')
    def encryption_rotate_key(self, request):
        """Rotate the encryption key for an organization. Superadmin only."""
        if not request.user.is_superuser:
            return Response({'error': 'Superadmin access required'}, status=403)
        
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'organization', None)
        if not org:
            org_id = request.data.get('organization_id')
            if org_id:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)
        
        result = EncryptionService.rotate_key(org)
        return Response(result, status=200 if result['success'] else 400)
