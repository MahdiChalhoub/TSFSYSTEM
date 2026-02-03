from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Module, OrganizationModule
from .module_manager import ModuleManager
from .permissions import IsOrgAdmin

class ModuleListView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No tenant context'}, status=400)

        all_modules = Module.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        org_status_map = {om.module_id: om.status for om in org_modules}

        data = []
        for m in all_modules:
            data.append({
                'code': m.code,
                'name': m.name,
                'version': m.version,
                'description': m.description,
                'dependencies': m.dependencies,
                'is_core': m.is_core,
                'status': org_status_map.get(m.id, 'UNINSTALLED' if not m.is_core else 'INSTALLED')
            })
        return Response(data)

class ModuleEnableView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        org = request.user.organization
        try:
            ModuleManager.install(code, org.id)
            return Response({'message': f'Module {code} enabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

class ModuleDisableView(APIView):
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        org = request.user.organization
        try:
            ModuleManager.disable(code, org.id)
            return Response({'message': f'Module {code} disabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
