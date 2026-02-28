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
    UserViewSet, RecordHistoryViewSet, EntityGraphViewSet, CurrencyViewSet,
    NotificationViewSet, PermissionViewSet, import_sales_csv_view, BusinessTypeViewSet
)
from .views_auth import (
    login_view, logout_view, me_view, PublicConfigView, register_business_view,
    password_reset_request_view, password_reset_confirm_view,
    setup_2fa_view, verify_2fa_setup_view, disable_2fa_view
)
from .views_saas_modules import SaaSModuleViewSet, OrgModuleViewSet, SaaSUpdateViewSet, SaaSPlansViewSet, PublicPricingView, SaaSClientViewSet
from .views_modules import ModuleListView, ModuleEnableView, ModuleDisableView
from .views_kernel import KernelViewSet
from .views_packages import PackageViewSet
from .views_encryption import EncryptionViewSet
from .views_udle import UDLESavedViewViewSet
from .views_domains import CustomDomainViewSet, resolve_custom_domain
from .list_preferences_views import (
    user_list_preference as list_pref_user_view,
    org_list_default as list_pref_org_view,
)

# ── Kernel Router (infrastructure only) ──────────────────────────────────────
router = DefaultRouter()
router.register(r'tenant', TenantResolutionView, basename='tenant')
router.register(r'organizations', OrganizationViewSet)
router.register(r'sites', SiteViewSet, basename='sites')
router.register(r'settings', SettingsViewSet, basename='settings')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'countries', CountryViewSet)
router.register(r'roles', RoleViewSet)
router.register(r'users', UserViewSet)
router.register(r'record-history', RecordHistoryViewSet, basename='record-history')
router.register(r'entity-graph', EntityGraphViewSet, basename='entity-graph')
router.register(r'encryption', EncryptionViewSet, basename='encryption')
router.register(r'currencies', CurrencyViewSet, basename='currencies')
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'udle-views', UDLESavedViewViewSet, basename='udle-views')
router.register(r'business-types', BusinessTypeViewSet, basename='business-types')

# SaaS Management
router.register(r'saas/modules', SaaSModuleViewSet, basename='saas-modules')
router.register(r'saas/org-modules', OrgModuleViewSet, basename='saas-org-modules')
router.register(r'saas/updates', SaaSUpdateViewSet, basename='saas-updates')
router.register(r'saas/plans', SaaSPlansViewSet, basename='saas-plans')
router.register(r'saas/clients', SaaSClientViewSet, basename='saas-clients')
router.register(r'kernel', KernelViewSet, basename='kernel')
router.register(r'packages', PackageViewSet, basename='packages')
router.register(r'domains', CustomDomainViewSet, basename='domains')

urlpatterns = [
    path('health/', health_check),
    path('auth/login/', login_view, name='auth_login'),
    path('auth/logout/', logout_view, name='auth_logout'),
    path('auth/me/', me_view, name='auth_me'),
    
    # Onboarding
    path('auth/config/', PublicConfigView.as_view(), name='auth_config'),
    path('auth/register/business/', register_business_view, name='register_business'),
    path('auth/password-reset/', password_reset_request_view, name='password_reset_request'),
    path('auth/password-reset/confirm/', password_reset_confirm_view, name='password_reset_confirm'),
    path('auth/2fa/setup/', setup_2fa_view, name='setup-2fa'),
    path('auth/2fa/verify/', verify_2fa_setup_view, name='verify-2fa'),
    path('auth/2fa/disable/', disable_2fa_view, name='disable-2fa'),
    path('sales/import-csv/', import_sales_csv_view, name='import-sales-csv'),
    path('saas/pricing/', PublicPricingView.as_view(), name='public_pricing'),
    path('domains/resolve/', resolve_custom_domain, name='domain_resolve'),
    
    # Module Management (Tenant Side)
    path('modules/', ModuleListView.as_view(), name='module_list'),
    path('modules/<str:code>/enable/', ModuleEnableView.as_view(), name='module_enable'),
    path('modules/<str:code>/disable/', ModuleDisableView.as_view(), name='module_disable'),

    # List Preferences
    path('list-preferences/<str:list_key>/', list_pref_user_view, name='list_pref_user'),
    path('list-defaults/<str:list_key>/', list_pref_org_view, name='list_pref_org'),

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

# Pre-register DRF's format_suffix converter to prevent conflicts
# when multiple routers are included in the same URL configuration.
try:
    from django.urls.converters import register_converter
    from rest_framework.urlpatterns import _FormatSuffixConverter
    register_converter(_FormatSuffixConverter, 'drf_format_suffix')
except Exception:
    pass  # Already registered or DRF not available

# --- Automatic Module Discovery & Registration ---
_namespaced_module_patterns = []
_flat_module_patterns = []

if _APPS_DIR.exists():
    # Sort for deterministic registration order
    for _app_dir in sorted(_APPS_DIR.iterdir()):
        if not _app_dir.is_dir() or not (_app_dir / 'urls.py').exists():
            continue
            
        _module_code = _app_dir.name
        if _module_code in _KERNEL_MANAGED:
            continue
            
        _module_path = f'apps.{_module_code}.urls'
        try:
            importlib.import_module(_module_path)
            
            # 1. Namespaced mount (specific) — e.g., /api/inventory/inventory-movements/
            # Put namespaced routes in a separate list to ensure they have priority
            _namespaced_module_patterns.append(path(f'{_module_code}/', include(_module_path)))
            
            # 2. Flat mount (backward compatible) — e.g., /api/inventory-movements/
            # Put flat routes in another list, checked later
            _flat_module_patterns.append(path('', include(_module_path)))
            
            _logger.info(f"[URLs] Registered module: {_module_code} (flat + namespaced)")
        except Exception as _e:
            _logger.warning(f"[URLs] Skipping module {_module_code}: {_e}")

# FINAL URL HIERARCHY (Priority Order):
# 1. Namespaced Module URLs (Specific paths like /api/inventory/...)
# 2. Kernel URLs (Infrastructure like /api/auth/, /api/health/)
# 3. Flat Module URLs (Legacy paths for backward compatibility)
urlpatterns = _namespaced_module_patterns + urlpatterns + _flat_module_patterns


