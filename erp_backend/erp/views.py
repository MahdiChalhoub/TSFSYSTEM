from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import (
    Organization, Site, User, Role, Permission, SystemModule, SystemUpdate,
    Contact, Product, Transaction, OrganizationModule
)
from .serializers import (
    OrganizationSerializer, SiteSerializer, UserSerializer, 
    RoleSerializer, PermissionSerializer, SystemModuleSerializer, SystemUpdateSerializer,
    TransactionSerializer
)
from .middleware import get_current_tenant_id

class TenantResolutionView(viewsets.ViewSet):
    """
    Public endpoint to resolve tenant slug to ID.
    """
    permission_classes = [] 
    authentication_classes = []

    @action(detail=False, methods=['get'])
    def resolve(self, request):
        slug = request.query_params.get('slug')
        if not slug:
            return Response({"error": "Slug required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = Organization.objects.get(slug=slug)
            return Response({
                "id": str(org.id),
                "slug": org.slug,
                "name": org.name
            })
        except Organization.DoesNotExist:
            return Response({"error": "Tenant not found"}, status=status.HTTP_404_NOT_FOUND)

class DashboardViewSet(viewsets.ViewSet):
    """
    Dashboard Aggregation ViewSet
    """
    
    @action(detail=False, methods=['get'])
    def saas_stats(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Staff access required"}, status=403)
            
        from django.utils import timezone
        total_tenants = Organization.objects.count()
        active_tenants = Organization.objects.filter(is_active=True).count()
        
        total_modules = SystemModule.objects.count()
        total_deployments = OrganizationModule.objects.filter(is_enabled=True).count()
        
        return Response({
            "totalTenants": total_tenants,
            "activeTenants": active_tenants,
            "modules": total_modules,
            "deployments": total_deployments,
            "systemLoad": "Optimal",
            "lastSync": timezone.now().strftime("%H:%M")
        })

class TenantModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that automatically filters by organization (tenant).
    Also handles basic audit logging or tenant-aware logic.
    """
    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return self.queryset.none()
        return self.queryset.filter(organization_id=org_id)

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        serializer.save(organization_id=org_id)

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    
    def get_queryset(self):
        # Only superusers or specific platform admins see all
        if self.request.user.is_superuser:
            return Organization.objects.all()
        return Organization.objects.filter(id=self.request.user.organization_id)

    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        org = self.get_object()
        modules = org.modules.all()
        return Response(SystemModuleSerializer(modules, many=True).data)

class SiteViewSet(TenantModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer

class UserViewSet(TenantModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

@action(detail=False, methods=['get'])
def health_check(request):
    return Response({"status": "healthy", "engine": "Blanc v1.0.0"})
