from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import SystemModule, OrganizationModule
from .module_manager import ModuleManager
from .permissions import IsOrgAdmin

class ModuleListView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No tenant context'}, status=400)

        all_modules = SystemModule.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        enabled_modules = {om.module_name for om in org_modules if om.is_enabled}

        data = []
        for m in all_modules:
            is_core = m.manifest.get('required', False)
            data.append({
                'code': m.name,
                'name': m.name,
                'version': m.version,
                'description': m.manifest.get('description', ''),
                'dependencies': m.manifest.get('requires', {}),
                'is_core': is_core,
                'status': 'INSTALLED' if (is_core or m.name in enabled_modules) else 'UNINSTALLED'
            })
        return Response(data)

class ModuleEnableView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        org = request.user.organization
        try:
            ModuleManager.grant_access(code, org.id)
            return Response({'message': f'Module {code} enabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

class ModuleDisableView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        # Disabling is soft in this architecture
        org = request.user.organization
        try:
            OrganizationModule.objects.filter(
                organization=org,
                module_name=code
            ).update(is_enabled=False)
            return Response({'message': f'Module {code} disabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
