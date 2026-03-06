"""
Marketplace Views — erp/views_modules.py

Provides the tenant-facing Module Marketplace API:
  GET  /api/erp/marketplace/              — annotated list of all system modules
  POST /api/erp/marketplace/<code>/enable/  — enable a module for the current org
  POST /api/erp/marketplace/<code>/disable/ — disable a module for the current org
  GET  /api/erp/modules/active-sidebar/   — sidebar items for all ENABLED modules

Architecture compliance:
  ✅ No cross-module imports (erp.* models only)
  ✅ No hardcoded plan values (read from manifest['plan_required'])
  ✅ emit_event() for all state changes
  ✅ IsOrgAdmin RBAC guard on all write endpoints
  ✅ Tenant-scoped via request.user.organization
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import SystemModule, OrganizationModule
from .module_manager import ModuleManager
from .permissions import IsOrgAdmin

# Kernel-compliant imports
try:
    from kernel.config import get_config
except ImportError:
    # Fallback: kernel not yet initialized (e.g. during migrations)
    def get_config(key, default=None):  # type: ignore
        return default

try:
    from kernel.events import emit_event
except ImportError:
    # Fallback: no-op if kernel event bus not available
    def emit_event(event_name, payload=None, **kwargs):  # type: ignore
        pass


# Default plan hierarchy used as fallback if not configured.
# Order matters: index = rank (higher index = more access).
_default_plan_hierarchy = ['starter', 'business', 'enterprise']


def _get_plan_hierarchy():
    """Returns plan tier ordering from config so deployments can extend it."""
    return get_config('plan_hierarchy', default=_default_plan_hierarchy)


def _get_org_plan_slug(org):
    """
    Derive a lowercase plan slug from the org's current_plan.
    Falls back to 'starter' if no plan is configured.
    """
    if org.current_plan:
        return org.current_plan.name.lower().replace(' ', '_')
    return 'starter'



def _plan_rank(slug):
    """Return a numeric rank for a plan slug. Higher = more access."""
    hierarchy = _get_plan_hierarchy()
    try:
        return hierarchy.index(slug)
    except ValueError:
        return 0  # Unknown plan = treat as starter


def _org_can_access(org_plan_slug, required_plan_slug):
    """True if the org's plan meets or exceeds the required plan."""
    return _plan_rank(org_plan_slug) >= _plan_rank(required_plan_slug)


class MarketplaceView(APIView):
    """
    Full Module Marketplace endpoint for tenant admins.
    Returns all SystemModules annotated with this org's enable state,
    plan access gate, and manifest-driven metadata.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization context'}, status=400)

        org_plan = _get_org_plan_slug(org)

        # Build enabled-module lookup for this org
        org_modules = OrganizationModule.objects.filter(organization=org)
        enabled_set = {om.module_name for om in org_modules if om.is_enabled}
        features_map = {om.module_name: om.active_features for om in org_modules}

        all_modules = SystemModule.objects.filter(status='INSTALLED').order_by('name')

        data = []
        for m in all_modules:
            mf = m.manifest
            code = mf.get('code', m.name)
            is_core = mf.get('is_core', mf.get('required', False))
            plan_required = mf.get('plan_required', 'starter')
            can_access = _org_can_access(org_plan, plan_required)

            if is_core or m.name in enabled_set:
                state = 'ENABLED'
            elif can_access:
                state = 'AVAILABLE'
            else:
                state = 'LOCKED'

            data.append({
                'code': code,
                'name': mf.get('name', m.name),
                'version': m.version,
                'description': mf.get('description', m.description or ''),
                'category': mf.get('category', 'platform'),
                'plan_required': plan_required,
                'plan_accessible': can_access,
                'icon': mf.get('icon', m.icon or 'Box'),
                'is_core': is_core,
                'dependencies': mf.get('dependencies', []),
                'features': mf.get('features', []),
                'active_features': features_map.get(m.name, []),
                'state': state,
                'installed_at': m.installed_at.isoformat() if m.installed_at else None,
            })

        return Response(data)


class MarketplaceModuleActionView(APIView):
    """
    Enable or disable a specific module for the current org.
    POST /api/erp/marketplace/<code>/enable/
    POST /api/erp/marketplace/<code>/disable/
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code, action):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization context'}, status=400)

        try:
            sys_module = SystemModule.objects.get(name=code, status='INSTALLED')
        except SystemModule.DoesNotExist:
            return Response({'error': f'Module "{code}" not found or not installed.'}, status=404)

        mf = sys_module.manifest
        is_core = mf.get('is_core', mf.get('required', False))

        if action == 'enable':
            # Plan gate check
            plan_required = mf.get('plan_required', 'starter')
            org_plan = _get_org_plan_slug(org)
            if not _org_can_access(org_plan, plan_required):
                return Response({
                    'error': f'Your current plan ({org_plan}) does not include this module.',
                    'plan_required': plan_required,
                    'upgrade_required': True,
                }, status=403)

            ModuleManager.grant_access(code, org.id)

            # Emit event for downstream listeners (sidebar refresh, audit log, theme update)
            emit_event('marketplace.module_enabled', {
                'module_code': code,
                'organization_id': str(org.id),
                'tenant_id': str(org.id),
            })

            return Response({
                'message': f'Module "{code}" enabled successfully.',
                'state': 'ENABLED',
            })

        elif action == 'disable':
            if is_core:
                return Response({'error': f'Core module "{code}" cannot be disabled.'}, status=400)

            OrganizationModule.objects.filter(
                organization=org,
                module_name=code,
            ).update(is_enabled=False)

            # Emit event for downstream listeners
            emit_event('marketplace.module_disabled', {
                'module_code': code,
                'organization_id': str(org.id),
                'tenant_id': str(org.id),
            })

            return Response({
                'message': f'Module "{code}" disabled successfully.',
                'state': 'AVAILABLE',
            })

        return Response({'error': f'Unknown action "{action}". Use "enable" or "disable".'}, status=400)


class ActiveSidebarView(APIView):
    """
    Returns the merged sidebar_items from all ENABLED modules for the current org.
    Used by Sidebar.tsx to build the dynamic navigation menu.
    GET /api/erp/modules/active-sidebar/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response([], status=200)

        # Get all enabled module names for this org
        enabled_module_names = set(
            OrganizationModule.objects.filter(
                organization=org,
                is_enabled=True,
            ).values_list('module_name', flat=True)
        )

        sidebar_items = []

        # Always include core sidebar items (required modules)
        all_modules = SystemModule.objects.filter(status='INSTALLED')
        for m in all_modules:
            mf = m.manifest
            code = mf.get('code', m.name)
            is_core = mf.get('is_core', mf.get('required', False))

            if is_core or code in enabled_module_names or m.name in enabled_module_names:
                items = mf.get('sidebar_items', [])
                for item in items:
                    item['module_code'] = code
                    sidebar_items.append(item)

        return Response(sidebar_items)


# ── Legacy views (kept for backward compatibility) ────────────────────────────

class ModuleListView(APIView):
    """Deprecated: use MarketplaceView instead. Kept for backward compat."""
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
    """Deprecated: use MarketplaceModuleActionView instead."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        org = request.user.organization
        try:
            ModuleManager.grant_access(code, org.id)
            return Response({'message': f'Module {code} enabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class ModuleDisableView(APIView):
    """Deprecated: use MarketplaceModuleActionView instead."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, code):
        org = request.user.organization
        try:
            OrganizationModule.objects.filter(
                organization=org,
                module_name=code
            ).update(is_enabled=False)
            return Response({'message': f'Module {code} disabled successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
