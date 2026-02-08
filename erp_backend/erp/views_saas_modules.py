from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from .models import SystemModule, Organization, OrganizationModule, SystemUpdate
from .module_manager import ModuleManager
from .kernel_manager import KernelManager

class SaaSUpdateViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for System Kernel Updates.
    Identical to Windows Update - handles core OS/Kernel patching.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Returns the current running kernel version and environment info"""
        return Response({
            'current_version': KernelManager.get_current_version(),
            'integrity': 'Verified',
            'environment': 'Production' if not settings.DEBUG else 'Development'
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Returns the history of staged and applied updates"""
        updates = SystemUpdate.objects.all().order_by('-created_at')
        data = []
        for u in updates:
            data.append({
                'id': u.id,
                'version': u.version,
                'changelog': u.changelog,
                'is_applied': u.is_applied,
                'applied_at': u.applied_at,
                'created_at': u.created_at
            })
        return Response(data)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Handles .kernel.zip upload and staging"""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.kernel.zip'):
            return Response({'error': 'Invalid file type. Must be .kernel.zip'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            update_record = KernelManager.stage_update(file_obj)
            return Response({
                'message': f'Kernel v{update_record.version} staged successfully.',
                'id': update_record.id
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def apply(self, request):
        """Applies a staged update"""
        update_id = request.data.get('id')
        if not update_id:
            return Response({'error': 'Update ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            update = KernelManager.apply_update(update_id)
            return Response({'message': f'System successfully updated to v{update.version}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SaaSModuleViewSet(viewsets.ViewSet):
    """
    SaaS Manager viewpoint for Global Module Registry.
    Requires Staff/Superuser permissions and no organization context.
    """
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def list(self, request):
        modules = SystemModule.objects.all().order_by('name')
        data = []
        for m in modules:
            code = m.manifest.get('code', m.name)
            # Count how many orgs have this installed
            install_count = OrganizationModule.objects.filter(module_name=m.name, is_enabled=True).count()
            data.append({
                'code': code,
                'name': m.manifest.get('name', m.name),
                'version': m.version,
                'description': m.description or m.manifest.get('description', ''),
                'icon': m.icon or '',
                'visibility': m.visibility,
                'features': m.manifest.get('features', []),
                'dependencies': m.manifest.get('dependencies', []),
                'is_core': m.manifest.get('is_core', False) or m.manifest.get('required', False) or code in ['core', 'coreplatform'],
                'total_installs': install_count
            })
        return Response(data)

    @action(detail=True, methods=['patch'], url_path='update')
    def update_module(self, request, pk=None):
        """Update module visibility, description, icon"""
        try:
            m = SystemModule.objects.get(name=pk)
        except SystemModule.DoesNotExist:
            try:
                m = SystemModule.objects.get(manifest__code=pk)
            except SystemModule.DoesNotExist:
                return Response({'error': 'Module not found'}, status=status.HTTP_404_NOT_FOUND)

        d = request.data
        if 'visibility' in d and d['visibility'] in ['public', 'organization', 'private']:
            m.visibility = d['visibility']
        if 'description' in d:
            m.description = d['description']
        if 'icon' in d:
            m.icon = d['icon']
        m.save()
        return Response({
            'code': m.manifest.get('code', m.name),
            'visibility': m.visibility,
            'description': m.description,
            'icon': m.icon,
            'message': f'Module {m.name} updated'
        })


    @action(detail=False, methods=['post'])
    def sync_global(self, request):
        """Re-scans filesystem and updates SystemModule table"""
        names = ModuleManager.sync()
        return Response({'message': f'Synced {len(names)} modules from filesystem', 'codes': names})

    @action(detail=True, methods=['post'])
    def install_global(self, request, pk=None):
        """Installs a specific module for ALL organizations (feature grant)"""
        try:
            count = ModuleManager.install_for_all(pk)
            return Response({'message': f'Granted module {pk} for {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def uninstall_global(self, request, pk=None):
        """Revokes a specific module for ALL organizations"""
        try:
            count = ModuleManager.revoke_all(pk)
            return Response({'message': f'Revoked module {pk} from {count} organizations'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def delete_module(self, request, pk=None):
        """Wipes a module from registry and filesystem"""
        try:
            ModuleManager.delete(pk)
            return Response({'message': f'Module {pk} deleted successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def backups(self, request, pk=None):
        """Lists available backups for a module"""
        try:
            backups = ModuleManager.list_backups(pk)
            return Response(backups)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def rollback_module(self, request, pk=None):
        """Restores a previous version from backup"""
        target_version = request.data.get('target_version')
        if not target_version:
            return Response({'error': 'target_version is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ModuleManager.rollback(pk, target_version)
            return Response({'message': f'Module {pk} rolled back to {target_version}'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload_module(self, request):
        """Handles .modpkg.zip upload and installation"""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.endswith('.modpkg.zip'):
            return Response({'error': 'Invalid file type. Must be .modpkg.zip'}, status=status.HTTP_400_BAD_REQUEST)

        # Save temporarily using direct IO to avoid storage path mixups
        import os
        from django.conf import settings

        temp_dir = os.path.join(settings.BASE_DIR, 'tmp')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        full_path = os.path.join(temp_dir, file_obj.name)
        
        # Write chunks to avoid memory issues
        with open(full_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)

        try:
            # Extract module code from filename: module_v1.0.0.modpkg.zip OR module.modpkg.zip
            base_name = file_obj.name.replace('.modpkg.zip', '')
            if '_v' in base_name:
                module_code = base_name.split('_v')[0]
            elif '_' in base_name:
                module_code = base_name.split('_')[0]
            else:
                module_code = base_name
            
            ModuleManager.upgrade(module_code, full_path, user=request.user)
            return Response({'message': f'Module {module_code} uploaded and installed successfully'})
        except Exception as e:
            import traceback
            traceback.print_exc()  # Log full error to console
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            if os.path.exists(full_path):
                os.remove(full_path)

    @action(detail=False, methods=['get'])
    def sidebar(self, request):
        """Returns aggregated sidebar items for the current session context"""
        # 1. Start with Core items (Always visible)
        items = []
        
        # 2. Add items from ACTIVE modules
        # If no organization context, we treat as MASTER PANEL (is_saas)
        # BUGFIX: Also treat 'saas' slug organization as SaaS context for panel visibility
        is_saas = not hasattr(request, 'tenant') or request.tenant is None or getattr(request.tenant, 'slug', '') == 'saas'
        
        active_modules = SystemModule.objects.all()
        for m in active_modules:
            # Verify module exists in filesystem before trusting manifest
            mod_path = ModuleManager.get_module_path(m.name)
            if not mod_path:
                continue
                
            # Extract sidebar items from manifest
            mod_items = m.manifest.get('sidebar_items', [])
            for item in mod_items:
                # Visibility check: Some items only show in SaaS, some only in Tenant
                if item.get('visibility') == 'saas' and not is_saas:
                    continue
                if item.get('visibility') == 'tenant' and is_saas:
                    continue
                    
                items.append(item)
                
        return Response(items)


class PublicPricingView(views.APIView):
    """Public pricing endpoint — no auth required. Returns only active, public plans."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from erp.models import SubscriptionPlan, SystemModule as SM
        plans = SubscriptionPlan.objects.select_related('category').filter(
            is_active=True, is_public=True
        ).order_by('sort_order', 'monthly_price')

        # Only show publicly-visible modules on the landing page
        public_modules = set(
            sm.manifest.get('code', sm.name)
            for sm in SM.objects.filter(visibility='public')
        )

        data = [{
            'id': str(p.id),
            'name': p.name,
            'description': p.description or '',
            'monthly_price': str(p.monthly_price),
            'annual_price': str(p.annual_price),
            'modules': [m for m in (p.modules or []) if m in public_modules],
            'features': p.features or {},
            'limits': p.limits or {},
            'is_active': p.is_active,
            'trial_days': p.trial_days,
        } for p in plans]
        return Response(data)


class SaaSPlansViewSet(viewsets.ViewSet):
    """SaaS Subscription Plans Management"""
    permission_classes = [permissions.IsAdminUser]

    def _serialize_plan(self, p, include_orgs=False):
        data = {
            'id': str(p.id),
            'name': p.name,
            'description': p.description or '',
            'monthly_price': str(p.monthly_price),
            'annual_price': str(p.annual_price),
            'modules': p.modules or [],
            'features': p.features or {},
            'limits': p.limits or {},
            'is_active': p.is_active,
            'is_public': p.is_public,
            'sort_order': p.sort_order,
            'trial_days': p.trial_days,
            'category': {
                'id': str(p.category.id),
                'name': p.category.name,
                'type': p.category.type,
            } if p.category else None,
            'created_at': p.created_at.isoformat() if p.created_at else None,
        }
        if include_orgs:
            data['organizations'] = [
                {'id': str(o.id), 'name': o.name, 'slug': o.slug, 'is_active': o.is_active}
                for o in p.organizations.all()
            ]
            data['addons'] = [self._serialize_addon(a) for a in p.addons.all()]
        return data

    def _serialize_addon(self, a):
        return {
            'id': str(a.id),
            'name': a.name,
            'addon_type': a.addon_type,
            'quantity': a.quantity,
            'monthly_price': str(a.monthly_price),
            'annual_price': str(a.annual_price),
            'is_active': a.is_active,
            'plan_ids': [str(p.id) for p in a.plans.all()],
        }

    def list(self, request):
        """List all subscription plans"""
        from erp.models import SubscriptionPlan
        plans = SubscriptionPlan.objects.select_related('category').all()
        return Response([self._serialize_plan(p) for p in plans])

    def retrieve(self, request, pk=None):
        """Get plan detail with organizations and addons"""
        from erp.models import SubscriptionPlan
        try:
            plan = SubscriptionPlan.objects.select_related('category').prefetch_related('organizations', 'addons__plans').get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._serialize_plan(plan, include_orgs=True))

    def partial_update(self, request, pk=None):
        """Update a plan (PATCH)"""
        from erp.models import SubscriptionPlan, PlanCategory
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        d = request.data
        if 'name' in d: plan.name = d['name']
        if 'description' in d: plan.description = d['description']
        if 'monthly_price' in d: plan.monthly_price = d['monthly_price']
        if 'annual_price' in d: plan.annual_price = d['annual_price']
        if 'modules' in d: plan.modules = d['modules']
        if 'features' in d: plan.features = d['features']
        if 'limits' in d: plan.limits = d['limits']
        if 'is_active' in d: plan.is_active = d['is_active']
        if 'is_public' in d: plan.is_public = d['is_public']
        if 'sort_order' in d: plan.sort_order = d['sort_order']
        if 'trial_days' in d: plan.trial_days = d['trial_days']
        if 'category_id' in d:
            try:
                plan.category = PlanCategory.objects.get(id=d['category_id'])
            except PlanCategory.DoesNotExist:
                return Response({'error': 'Category not found'}, status=status.HTTP_400_BAD_REQUEST)
        plan.save()
        return Response(self._serialize_plan(plan))

    def create(self, request):
        """Create a new subscription plan"""
        from erp.models import SubscriptionPlan, PlanCategory
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Plan name is required'}, status=status.HTTP_400_BAD_REQUEST)

        category_id = request.data.get('category_id') or request.data.get('category')
        try:
            category = PlanCategory.objects.get(id=category_id) if category_id else PlanCategory.objects.first()
        except PlanCategory.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_400_BAD_REQUEST)

        if not category:
            return Response({'error': 'No plan categories exist. Create one first.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = SubscriptionPlan.objects.create(
                name=name,
                description=request.data.get('description', ''),
                monthly_price=request.data.get('monthly_price', 0),
                annual_price=request.data.get('annual_price', 0),
                modules=request.data.get('modules', []),
                features=request.data.get('features', {}),
                limits=request.data.get('limits', {}),
                category=category,
                is_active=request.data.get('is_active', True),
                is_public=request.data.get('is_public', True),
                sort_order=request.data.get('sort_order', 0),
                trial_days=request.data.get('trial_days', 0),
            )
            return Response({'message': f'Plan "{name}" created', 'id': str(plan.id)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def toggle_public(self, request, pk=None):
        """Toggle plan public/private visibility"""
        from erp.models import SubscriptionPlan
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        plan.is_public = not plan.is_public
        plan.save()
        return Response({'is_public': plan.is_public, 'message': f'Plan is now {"public" if plan.is_public else "private"}'})

    @action(detail=False, methods=['get'], url_path='module-features')
    def module_features(self, request):
        """Return available features for each module (from manifest)"""
        from erp.models import SystemModule
        result = {}
        for m in SystemModule.objects.all():
            code = m.manifest.get('code', m.name.lower())
            feats = m.manifest.get('features', [])
            if feats:
                result[code] = {
                    'name': m.name,
                    'features': feats,  # [{code, name, default}, ...]
                }
        return Response(result)

    @action(detail=False, methods=['get', 'post'])
    def categories(self, request):
        """List or create plan categories"""
        from erp.models import PlanCategory
        if request.method == 'GET':
            cats = PlanCategory.objects.all().order_by('name')
            data = [{'id': str(c.id), 'name': c.name, 'type': c.type} for c in cats]
            return Response(data)
        else:
            name = request.data.get('name', '').strip()
            cat_type = request.data.get('type', 'SAAS').strip()
            if not name:
                return Response({'error': 'Category name is required'}, status=status.HTTP_400_BAD_REQUEST)
            cat, created = PlanCategory.objects.get_or_create(name=name, defaults={'type': cat_type})
            return Response({'id': str(cat.id), 'name': cat.name, 'type': cat.type, 'created': created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get', 'post'], url_path='addons')
    def addon_list(self, request):
        """List or create add-ons"""
        from erp.models import PlanAddon
        if request.method == 'GET':
            addons = PlanAddon.objects.prefetch_related('plans').all()
            return Response([self._serialize_addon(a) for a in addons])
        else:
            d = request.data
            name = d.get('name', '').strip()
            if not name:
                return Response({'error': 'Add-on name is required'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                addon = PlanAddon.objects.create(
                    name=name,
                    addon_type=d.get('addon_type', 'users'),
                    quantity=d.get('quantity', 1),
                    monthly_price=d.get('monthly_price', 0),
                    annual_price=d.get('annual_price', 0),
                    is_active=d.get('is_active', True),
                )
                plan_ids = d.get('plan_ids', [])
                if plan_ids:
                    from erp.models import SubscriptionPlan
                    addon.plans.set(SubscriptionPlan.objects.filter(id__in=plan_ids))
                return Response(self._serialize_addon(addon), status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['patch', 'delete'], url_path='addons/(?P<addon_id>[^/.]+)')
    def addon_detail(self, request, addon_id=None):
        """Update or delete an add-on"""
        from erp.models import PlanAddon
        try:
            addon = PlanAddon.objects.get(pk=addon_id)
        except PlanAddon.DoesNotExist:
            return Response({'error': 'Add-on not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'DELETE':
            addon.delete()
            return Response({'message': 'Add-on deleted'})

        d = request.data
        if 'name' in d: addon.name = d['name']
        if 'addon_type' in d: addon.addon_type = d['addon_type']
        if 'quantity' in d: addon.quantity = d['quantity']
        if 'monthly_price' in d: addon.monthly_price = d['monthly_price']
        if 'annual_price' in d: addon.annual_price = d['annual_price']
        if 'is_active' in d: addon.is_active = d['is_active']
        addon.save()
        if 'plan_ids' in d:
            from erp.models import SubscriptionPlan
            addon.plans.set(SubscriptionPlan.objects.filter(id__in=d['plan_ids']))
        return Response(self._serialize_addon(addon))

class OrgModuleViewSet(viewsets.ViewSet):
    """Management of modules for a specific Organization (SaaS View)"""
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'])
    def business_types(self, request):
        """List all available business types"""
        from erp.models import BusinessType
        data = [{'id': str(bt.id), 'name': bt.name, 'slug': bt.slug, 'description': bt.description or ''} for bt in BusinessType.objects.all().order_by('name')]
        return Response(data)

    # Default feature definitions for modules whose manifests lack a 'features' key
    DEFAULT_FEATURES = {
        'finance': [
            {'code': 'chart_of_accounts', 'name': 'Chart of Accounts'},
            {'code': 'journal_entries', 'name': 'Journal Entries'},
            {'code': 'fiscal_years', 'name': 'Fiscal Years'},
            {'code': 'loans', 'name': 'Loans & Installments'},
            {'code': 'financial_reports', 'name': 'Financial Reports'},
        ],
        'inventory': [
            {'code': 'products', 'name': 'Product Management'},
            {'code': 'warehouses', 'name': 'Warehouses'},
            {'code': 'stock_movements', 'name': 'Stock Movements'},
            {'code': 'brands', 'name': 'Brands & Categories'},
            {'code': 'barcode', 'name': 'Barcode System'},
        ],
        'pos': [
            {'code': 'sales', 'name': 'Sales & Orders'},
            {'code': 'returns', 'name': 'Returns & Refunds'},
            {'code': 'receipts', 'name': 'Receipt Printing'},
            {'code': 'cash_register', 'name': 'Cash Register'},
            {'code': 'pos_terminal', 'name': 'POS Terminal'},
        ],
        'crm': [
            {'code': 'contacts', 'name': 'Contact Management'},
            {'code': 'leads', 'name': 'Leads & Pipelines'},
        ],
        'hr': [
            {'code': 'employees', 'name': 'Employee Management'},
            {'code': 'payroll', 'name': 'Payroll'},
            {'code': 'attendance', 'name': 'Attendance Tracking'},
        ],
        'core': [
            {'code': 'organizations', 'name': 'Organizations'},
            {'code': 'sites', 'name': 'Sites / Locations'},
            {'code': 'users', 'name': 'User Management'},
            {'code': 'roles', 'name': 'Roles & Permissions'},
        ],
        'coreplatform': [
            {'code': 'modules', 'name': 'Module Registry'},
            {'code': 'system_updates', 'name': 'System Updates'},
            {'code': 'platform_settings', 'name': 'Platform Settings'},
        ],
    }

    @action(detail=True, methods=['get'])
    def modules(self, request, pk=None):
        org = Organization.objects.get(id=pk)
        all_modules = SystemModule.objects.all()
        org_modules = OrganizationModule.objects.filter(organization=org)
        # Helper lookup for enabled modules
        enabled_map = {om.module_name: om for om in org_modules if om.is_enabled}

        data = []
        for m in all_modules:
            is_core = m.manifest.get('is_core', False) or m.manifest.get('required', False) or m.name in ['core', 'coreplatform']
            om_record = enabled_map.get(m.name)
            
            # [FEATURE FLAGS] Extract features from manifest, fallback to defaults
            available_features = m.manifest.get('features', [])
            if not available_features:
                available_features = self.DEFAULT_FEATURES.get(m.name, [])
            
            data.append({
                'code': m.name,
                'name': m.name,
                'status': 'INSTALLED' if (is_core or m.name in enabled_map) else 'UNINSTALLED',
                'is_core': is_core,
                'active_features': om_record.active_features if om_record else [],
                'available_features': available_features
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

    @action(detail=True, methods=['post'])
    def update_features(self, request, pk=None):
        org_id = pk
        module_code = request.data.get('module_code')
        features = request.data.get('features', []) # List of strings

        try:
            OrganizationModule.objects.filter(
                organization_id=org_id,
                module_name=module_code
            ).update(active_features=features)
            return Response({'message': 'Features updated successfully', 'features': features})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        """Returns live usage metrics for an organization — reads real plan data"""
        from erp.models import Site, User, SubscriptionPlan, SubscriptionPayment
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        # Read real plan from DB
        plan = org.current_plan
        max_users = 5
        max_sites = 1
        max_storage_mb = 500
        max_invoices = 100

        plan_data = {
            'id': None,
            'name': 'Free Tier',
            'monthly_price': '0.00',
            'annual_price': '0.00',
            'category': None,
            'expiry': org.plan_expiry_at.isoformat() if org.plan_expiry_at else None,
        }

        if plan:
            # Read limits from plan.limits JSONB field
            limits = plan.limits or {}
            max_users = limits.get('max_users', max_users)
            max_sites = limits.get('max_sites', max_sites)
            max_storage_mb = limits.get('max_storage_mb', max_storage_mb)
            max_invoices = limits.get('max_invoices', max_invoices)

            plan_data = {
                'id': str(plan.id),
                'name': plan.name,
                'monthly_price': str(plan.monthly_price),
                'annual_price': str(plan.annual_price),
                'category': plan.category.name if plan.category else None,
                'expiry': org.plan_expiry_at.isoformat() if org.plan_expiry_at else None,
            }

        # Also fetch all available plans for display
        all_plans = SubscriptionPlan.objects.all().order_by('monthly_price')
        available_plans = [{
            'id': str(p.id),
            'name': p.name,
            'monthly_price': str(p.monthly_price),
            'annual_price': str(p.annual_price),
            'category': p.category.name if p.category else None,
        } for p in all_plans]

        user_count = User.objects.filter(organization=org).count()
        site_count = Site.original_objects.filter(organization=org).count()
        module_count = OrganizationModule.objects.filter(organization=org, is_enabled=True).count()
        storage_mb = round(org.data_usage_bytes / (1024 * 1024), 1) if org.data_usage_bytes else 0

        # Invoice count this month (from SubscriptionPayment)
        from django.utils import timezone
        now = timezone.now()
        invoices_month = SubscriptionPayment.objects.filter(
            organization=org,
            created_at__year=now.year,
            created_at__month=now.month
        ).count()

        return Response({
            'users': {'current': user_count, 'limit': max_users, 'percent': round(user_count / max_users * 100)},
            'sites': {'current': site_count, 'limit': max_sites, 'percent': round(site_count / max_sites * 100)},
            'storage': {'current_mb': storage_mb, 'limit_mb': max_storage_mb, 'percent': round(storage_mb / max_storage_mb * 100)},
            'modules': {'current': module_count, 'total_available': SystemModule.objects.count()},
            'invoices': {'current': invoices_month, 'limit': max_invoices, 'percent': round(invoices_month / max_invoices * 100) if max_invoices else 0},
            'plan': plan_data,
            'available_plans': available_plans,
        })

    @action(detail=True, methods=['get'])
    def billing(self, request, pk=None):
        """Returns billing/payment history for an organization"""
        from erp.models import SubscriptionPayment
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        payments = SubscriptionPayment.objects.filter(
            organization=org
        ).select_related('plan').order_by('-created_at')[:50]

        data = [{
            'id': str(p.id),
            'plan_name': p.plan.name if p.plan else 'Unknown',
            'amount': str(p.amount),
            'status': p.status,
            'created_at': p.created_at.isoformat(),
        } for p in payments]

        return Response(data)

    # ─── User Management Endpoints ────────────────────────────────────

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """List all users for an organization"""
        from erp.models import User
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        users = User.objects.filter(organization=org).select_related('role').order_by('-date_joined')
        data = [{
            'id': str(u.id),
            'username': u.username,
            'email': u.email or '',
            'first_name': u.first_name or '',
            'last_name': u.last_name or '',
            'is_superuser': u.is_superuser,
            'is_staff': u.is_staff,
            'is_active': u.is_active,
            'role': u.role.name if u.role else None,
            'date_joined': u.date_joined.isoformat() if u.date_joined else None,
        } for u in users]

        return Response(data)

    @action(detail=True, methods=['post'])
    def create_user(self, request, pk=None):
        """Create a new user in an organization"""
        from erp.models import User
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()
        is_superuser = request.data.get('is_superuser', False)
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()

        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check unique username per org
        if User.objects.filter(username=username, organization=org).exists():
            return Response({'error': f'Username "{username}" already exists in this organization'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                organization=org,
                first_name=first_name,
                last_name=last_name,
                is_superuser=is_superuser,
                is_staff=is_superuser,  # superusers are also staff
            )
            return Response({
                'message': f'User "{username}" created successfully',
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'is_superuser': user.is_superuser,
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Reset a user's password"""
        from erp.models import User
        user_id = request.data.get('user_id')
        new_password = request.data.get('new_password', '').strip()

        if not user_id or not new_password:
            return Response({'error': 'user_id and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id, organization_id=pk)
            user.set_password(new_password)
            user.save(update_fields=['password'])
            return Response({'message': f'Password reset for "{user.username}"'})
        except User.DoesNotExist:
            return Response({'error': 'User not found in this organization'}, status=status.HTTP_404_NOT_FOUND)

    # ─── Site Management Endpoints ────────────────────────────────────

    @action(detail=True, methods=['get'])
    def sites(self, request, pk=None):
        """List all sites for an organization"""
        from erp.models import Site
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        sites = Site.original_objects.filter(organization=org).order_by('-created_at')
        data = [{
            'id': str(s.id),
            'name': s.name,
            'code': s.code or '',
            'address': s.address or '',
            'city': s.city or '',
            'phone': s.phone or '',
            'vat_number': s.vat_number or '',
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat() if s.created_at else None,
        } for s in sites]

        return Response(data)

    @action(detail=True, methods=['post'])
    def create_site(self, request, pk=None):
        """Create a new site in an organization"""
        from erp.models import Site
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name', '').strip()
        code = request.data.get('code', '').strip()
        address = request.data.get('address', '').strip()
        city = request.data.get('city', '').strip()
        phone = request.data.get('phone', '').strip()
        vat_number = request.data.get('vat_number', '').strip()

        if not name:
            return Response({'error': 'Site name is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check unique code per org
        if code and Site.original_objects.filter(code=code, organization=org).exists():
            return Response({'error': f'Site code "{code}" already exists in this organization'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            site = Site.original_objects.create(
                name=name,
                code=code or None,
                address=address or None,
                city=city or None,
                phone=phone or None,
                vat_number=vat_number or None,
                organization=org,
                is_active=True,
            )
            return Response({
                'message': f'Site "{name}" created successfully',
                'site': {
                    'id': str(site.id),
                    'name': site.name,
                    'code': site.code,
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def toggle_site(self, request, pk=None):
        """Toggle site active/inactive"""
        from erp.models import Site
        site_id = request.data.get('site_id')

        if not site_id:
            return Response({'error': 'site_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            site = Site.original_objects.get(id=site_id, organization_id=pk)
            site.is_active = not site.is_active
            site.save(update_fields=['is_active'])
            status_text = 'activated' if site.is_active else 'deactivated'
            return Response({'message': f'Site "{site.name}" {status_text}'})
        except Site.DoesNotExist:
            return Response({'error': 'Site not found in this organization'}, status=status.HTTP_404_NOT_FOUND)
