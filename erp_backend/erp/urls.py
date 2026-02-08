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
from .views_saas_modules import SaaSModuleViewSet, OrgModuleViewSet, SaaSUpdateViewSet, SaaSPlansViewSet
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
router.register(r'saas/plans', SaaSPlansViewSet, basename='saas-plans')
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

    # Kernel Router
    path('', include(router.urls)),
]

# ── Dynamic Module URL Registration ─────────────────────────────────────────
# Auto-discover urls.py from any installed module in apps/ directory.
# Dual-mount: flat paths (backward compat) + namespaced paths (new standard).
#
# Example for apps/finance/urls.py:
#   /api/accounts/          → flat mount (backward compatible)
#   /api/finance/accounts/  → namespaced mount (new standard)
#
import importlib
from pathlib import Path as _Path
import logging

_logger = logging.getLogger(__name__)
_APPS_DIR = _Path(__file__).resolve().parent.parent / 'apps'

# Modules managed by kernel (not auto-included)
_KERNEL_MANAGED = {'packages'}

if _APPS_DIR.exists():
    for _app_dir in sorted(_APPS_DIR.iterdir()):
        if not _app_dir.is_dir():
            continue
        if not (_app_dir / 'urls.py').exists():
            continue
        
        _module_code = _app_dir.name
        if _module_code in _KERNEL_MANAGED:
            continue
        
        _module_path = f'apps.{_module_code}.urls'
        try:
            # Verify the module can be imported before adding
            importlib.import_module(_module_path)
            
            # 1. Flat mount (backward compatible) — /api/accounts/
            urlpatterns.insert(0, path('', include(_module_path)))
            # 2. Namespaced mount (new standard) — /api/finance/accounts/
            urlpatterns.insert(1, path(f'{_module_code}/', include(_module_path)))
            
            _logger.info(f"[URLs] Registered module: {_module_code} (flat + namespaced)")
        except Exception as _e:
            _logger.warning(f"[URLs] Skipping module {_module_code}: {_e}")

