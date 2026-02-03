from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import Module, Organization, OrganizationModule
from .module_manager import ModuleManager

class SaaSModuleViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for Global Module Registry.
    Requires Staff/Superuser permissions and no organization context.
    """
    permission_classes = [IsAdminUser]

    def list(self, request):
        modules = Module.objects.all().order_by('name')
        data = []
        for m in modules:
            # Count how many orgs have this installed
            install_count = OrganizationModule.objects.filter(module=m, status='INSTALLED').count()
            data.append({
                'code': m.code,
                'name': m.name,
                'version': m.version,
                'description': m.description,
                'dependencies': m.dependencies,
                'is_core': m.is_core,
                'total_installs': install_count
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def sync_global(self, request):
        """Re-scans filesystem and updates Module table"""
        codes = ModuleManager.sync()
        return Response({'message': f'Synced {len(codes)} modules from filesystem', 'codes': codes})

    @action(detail=True, methods=['post'])
    def install_global(self, request, pk=None):
        """Installs a specific module for ALL organizations"""
        try:
            count = ModuleManager.install_for_all(pk)
            return Response({'message': f'Installed module {pk} for {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class OrgModuleViewSet(viewsets.ViewSet):
    """Management of modules for a specific Organization (SaaS View)"""
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        org = Organization.objects.get(id=pk)
        all_modules = Module.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        org_status_map = {om.module_id: om.status for om in org_modules}

        data = []
        for m in all_modules:
            data.append({
                'code': m.code,
                'name': m.name,
                'status': org_status_map.get(m.id, 'UNINSTALLED' if not m.is_core else 'INSTALLED'),
                'is_core': m.is_core
            })
        return Response(data)

    @action(detail=True, methods=['post'])
    def toggle_module(self, request, pk=None):
        org_id = pk
        module_code = request.data.get('module_code')
        action_type = request.data.get('action') # 'enable' or 'disable'

        try:
            if action_type == 'enable':
                ModuleManager.install(module_code, org_id)
            else:
                ModuleManager.disable(module_code, org_id)
            return Response({'message': 'Success'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
