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
            orgs = Organization.objects.all()
            count = 0
            for org in orgs:
                if ModuleManager.grant_access(pk, org.id):
                    count += 1
            return Response({'message': f'Granted module {pk} for {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
