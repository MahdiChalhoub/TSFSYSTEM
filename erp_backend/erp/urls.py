"""
Kernel URL Configuration
Contains ONLY infrastructure/kernel endpoints.
Business module URLs are included from their respective apps.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganizationViewSet, SiteViewSet, SettingsViewSet, health_check,
    TenantResolutionView, DashboardViewSet, CountryViewSet, RoleViewSet,
    UserViewSet
)
from .views_auth import login_view, logout_view, me_view, PublicConfigView
from .views_saas_modules import SaaSModuleViewSet, OrgModuleViewSet, SaaSUpdateViewSet
from .views_modules import ModuleListView, ModuleEnableView, ModuleDisableView
from .views_kernel import KernelViewSet
from .views_packages import PackageViewSet

# ── Kernel Router (infrastructure only) ──────────────────────────────────────
router = DefaultRouter()
router.register(r'tenant', TenantResolutionView, basename='tenant')
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet)
router.register(r'settings', SettingsViewSet, basename='settings')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'countries', CountryViewSet)
router.register(r'roles', RoleViewSet)
router.register(r'users', UserViewSet)

# SaaS Management
router.register(r'saas/modules', SaaSModuleViewSet, basename='saas-modules')
router.register(r'saas/org-modules', OrgModuleViewSet, basename='saas-org-modules')
router.register(r'saas/updates', SaaSUpdateViewSet, basename='saas-updates')
router.register(r'kernel', KernelViewSet, basename='kernel')
router.register(r'packages', PackageViewSet, basename='packages')

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/logout/', logout_view, name='auth_logout'),
    path('auth/me/', me_view, name='auth_me'),
    
    # Onboarding
    path('auth/config/', PublicConfigView.as_view(), name='auth_config'),
    
    # Module Management (Tenant Side)
    path('modules/', ModuleListView.as_view(), name='module_list'),
    path('modules/<str:code>/enable/', ModuleEnableView.as_view(), name='module_enable'),
    path('modules/<str:code>/disable/', ModuleDisableView.as_view(), name='module_disable'),

    # ── Business Module URLs (included from module directories) ──────────
    path('', include('apps.finance.urls')),
    path('', include('apps.inventory.urls')),
    path('', include('apps.pos.urls')),
    path('', include('apps.crm.urls')),
    path('', include('apps.hr.urls')),

    # Kernel Router
    path('', include(router.urls)),
]
