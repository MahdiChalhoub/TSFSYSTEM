from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import (
    Organization, Site, User, Role, Permission, SystemModule, SystemUpdate
)
from .serializers import (
    OrganizationSerializer, SiteSerializer, UserSerializer, 
    RoleSerializer, PermissionSerializer, SystemModuleSerializer, SystemUpdateSerializer
)
from .middleware import get_current_tenant_id

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

from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        # 1. Standard Authentication
        user = authenticate(username=username, password=password)
        
        if user:
            user.is_declared = False
            user.save()
        else:
            # 2. Dual Mode / Declared Authentication
            try:
                # We need to find the user manually since authenticate() only checks standard password
                from .models import User as ErpUser
                # If tenant-aware, we might need organization context here.
                # However, for login, we usually use a global username or slug-based username.
                # In our model, username is unique per org. 
                # The frontend might not know the org yet if it's a "Root Login".
                
                # Check if we have organization slug in request to narrow down
                org_slug = request.data.get('organization_slug')
                if org_slug:
                     user_query = ErpUser.objects.filter(username=username, organization__slug=org_slug)
                else:
                     user_query = ErpUser.objects.filter(username=username)
                
                if user_query.exists():
                    target_user = user_query.first()
                    if target_user.check_declared_password(password):
                        user = target_user
                        user.is_declared = True
                        user.save()
            except Exception:
                pass

        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'is_declared': user.is_declared
            })
        
        return Response({"non_field_errors": ["Invalid credentials"]}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)

class MeView(APIView):
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class TenantResolveView(APIView):
    """
    Resolves a workspace slug to its organization details.
    Used by the frontend to verify federation membership.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        slug = request.query_params.get('slug')
        if not slug:
            return Response({"error": "Missing slug parameter"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            org = Organization.objects.get(slug=slug, is_active=True)
            return Response({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "exists": True
            })
        except Organization.DoesNotExist:
            return Response({"exists": False}, status=status.HTTP_404_NOT_FOUND)

class SaaSConfigView(APIView):
    """
    Returns the SaaS root configuration, including a list of registered organizations.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # For the landing page, return a list of active organizations
        orgs = Organization.objects.filter(is_active=True).values('id', 'name', 'slug')
        return Response({
            "organizations": list(orgs),
            "platform_name": "TSF City",
            "version": "1.2.3-b007"
        })

class SaaSDashboardStatsView(APIView):
    """
    Returns aggregated statistics for the SaaS Master Dashboard.
    """
    def get(self, request):
        # Basic kernel stats - actual module stats would come from installed modules
        total_orgs = Organization.objects.count()
        active_orgs = Organization.objects.filter(is_active=True).count()
        total_users = User.objects.count()
        total_sites = Site.objects.count()
        
        return Response({
            "total_organizations": total_orgs,
            "active_organizations": active_orgs,
            "total_users": total_users,
            "total_sites": total_sites,
            "monthly_revenue": 0,  # Placeholder - requires billing module
            "pending_subscriptions": 0,
            "recent_activity": [],
            "system_health": {
                "database": "healthy",
                "cache": "healthy",
                "queue": "healthy"
            }
        })

class SaaSPlansView(APIView):
    """
    Returns available subscription plans.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Stub - SubscriptionPlan model is part of billing module (not in kernel)
        return Response([])

class SaaSModulesView(APIView):
    """
    Returns available system modules.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        modules = SystemModule.objects.all()
        return Response(SystemModuleSerializer(modules, many=True).data)

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

def health_check(request):
    return Response({"status": "healthy", "engine": "Blanc v1.0.0"})
