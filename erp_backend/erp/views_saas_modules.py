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
            # ARCHITECTURE: Skip core/platform modules — their sidebar items
            # are already hardcoded in the frontend Sidebar.tsx (MENU_ITEMS).
            # Only business modules should inject dynamic sidebar items.
            manifest = m.manifest or {}
            if manifest.get('is_core', False) or manifest.get('category') == 'core':
                continue

            # Verify module exists in filesystem before trusting manifest
            mod_path = ModuleManager.get_module_path(m.name)
            if not mod_path:
                continue
                
            # Extract sidebar items from manifest
            mod_items = manifest.get('sidebar_items', [])
            for item in mod_items:
                # Visibility check: Some items only show in SaaS, some only in Tenant
                if item.get('visibility') == 'saas' and not is_saas:
                    continue
                if item.get('visibility') == 'tenant' and is_saas:
                    continue
                    
                items.append(item)
                
        return Response(items)

    # ── AES-256 Encryption Management ────────────────────────────────

    @action(detail=False, methods=['get'], url_path='encryption/status')
    def encryption_status(self, request):
        """Get encryption status for the current organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'tenant', None)
        if not org:
            return Response({'error': 'No organization context'}, status=400)
        return Response(EncryptionService.get_status(org))

    @action(detail=False, methods=['post'], url_path='encryption/activate')
    def encryption_activate(self, request):
        """Activate AES-256 encryption for an organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'tenant', None)
        if not org:
            # Allow superadmin to specify org_id
            org_id = request.data.get('organization_id')
            if org_id and request.user.is_superuser:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)

        force = request.user.is_superuser and request.data.get('force', False)
        result = EncryptionService.activate(org, force=force)
        return Response(result, status=200 if result['success'] else 403)

    @action(detail=False, methods=['post'], url_path='encryption/deactivate')
    def encryption_deactivate(self, request):
        """Deactivate encryption for an organization."""
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'tenant', None)
        if not org:
            org_id = request.data.get('organization_id')
            if org_id and request.user.is_superuser:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)
        
        result = EncryptionService.deactivate(org)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='encryption/rotate-key')
    def encryption_rotate_key(self, request):
        """Rotate the encryption key for an organization. Superadmin only."""
        if not request.user.is_superuser:
            return Response({'error': 'Superadmin access required'}, status=403)
        
        from erp.encryption_service import EncryptionService
        org = getattr(request, 'tenant', None)
        if not org:
            org_id = request.data.get('organization_id')
            if org_id:
                from erp.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Organization.DoesNotExist:
                    return Response({'error': 'Organization not found'}, status=404)
            else:
                return Response({'error': 'No organization context'}, status=400)
        
        result = EncryptionService.rotate_key(org)
        return Response(result, status=200 if result['success'] else 400)


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

    # ── Organization Add-on Purchase & Tracking ──────────────────────
    @action(detail=False, methods=['get'], url_path='org-addons/(?P<org_id>[^/.]+)')
    def org_addon_list(self, request, org_id=None):
        """List an organization's purchased add-ons and available add-ons for purchase."""
        from erp.models import Organization, OrganizationAddon, PlanAddon
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        # Purchased add-ons
        purchased = OrganizationAddon.objects.filter(organization=org).select_related('addon')
        purchased_data = [{
            'id': str(p.id),
            'addon_id': str(p.addon.id),
            'addon_name': p.addon.name,
            'addon_type': p.addon.addon_type,
            'quantity': p.quantity,
            'billing_cycle': p.billing_cycle,
            'status': p.status,
            'monthly_price': str(p.addon.monthly_price),
            'annual_price': str(p.addon.annual_price),
            'effective_price': str(p.effective_price),
            'purchased_at': p.purchased_at.isoformat() if p.purchased_at else None,
            'cancelled_at': p.cancelled_at.isoformat() if p.cancelled_at else None,
            'notes': p.notes,
        } for p in purchased]

        # Available add-ons (active, and linked to org's plan or to all plans)
        available_qs = PlanAddon.objects.filter(is_active=True).prefetch_related('plans')
        if org.current_plan:
            # Add-ons explicitly linked to this plan OR add-ons with no plans (available to all)
            from django.db.models import Q
            available_qs = available_qs.filter(
                Q(plans=org.current_plan) | Q(plans__isnull=True)
            ).distinct()

        # Exclude add-ons already actively purchased
        active_addon_ids = OrganizationAddon.objects.filter(
            organization=org, status='active'
        ).values_list('addon_id', flat=True)

        available_data = [{
            'id': str(a.id),
            'name': a.name,
            'addon_type': a.addon_type,
            'quantity': a.quantity,
            'monthly_price': str(a.monthly_price),
            'annual_price': str(a.annual_price),
            'already_purchased': a.id in active_addon_ids,
        } for a in available_qs]

        return Response({
            'purchased': purchased_data,
            'available': available_data,
        })

    @action(detail=False, methods=['post'], url_path='org-addons/(?P<org_id>[^/.]+)/purchase')
    def org_addon_purchase(self, request, org_id=None):
        """Purchase an add-on for a specific organization."""
        from erp.models import Organization, OrganizationAddon, PlanAddon
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        addon_id = request.data.get('addon_id')
        if not addon_id:
            return Response({'error': 'addon_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            addon = PlanAddon.objects.get(id=addon_id, is_active=True)
        except PlanAddon.DoesNotExist:
            return Response({'error': 'Add-on not found or inactive'}, status=status.HTTP_404_NOT_FOUND)

        # Check if already purchased and active
        if OrganizationAddon.objects.filter(organization=org, addon=addon, status='active').exists():
            return Response({'error': 'This add-on is already active for this organization'}, status=status.HTTP_400_BAD_REQUEST)

        quantity = request.data.get('quantity', 1)
        billing_cycle = request.data.get('billing_cycle', 'MONTHLY')
        notes = request.data.get('notes', '')

        purchase = OrganizationAddon.objects.create(
            organization=org,
            addon=addon,
            quantity=quantity,
            billing_cycle=billing_cycle,
            notes=notes,
        )

        return Response({
            'id': str(purchase.id),
            'message': f'Add-on "{addon.name}" purchased for {org.name}',
            'addon_name': addon.name,
            'addon_type': addon.addon_type,
            'effective_price': str(purchase.effective_price),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='org-addons/(?P<org_id>[^/.]+)/cancel/(?P<purchase_id>[^/.]+)')
    def org_addon_cancel(self, request, org_id=None, purchase_id=None):
        """Cancel a purchased add-on for a specific organization."""
        from erp.models import OrganizationAddon
        from django.utils import timezone
        try:
            purchase = OrganizationAddon.objects.get(id=purchase_id, organization_id=org_id)
        except OrganizationAddon.DoesNotExist:
            return Response({'error': 'Purchase not found'}, status=status.HTTP_404_NOT_FOUND)

        if purchase.status != 'active':
            return Response({'error': f'Cannot cancel — status is already "{purchase.status}"'}, status=status.HTTP_400_BAD_REQUEST)

        purchase.status = 'cancelled'
        purchase.cancelled_at = timezone.now()
        purchase.save(update_fields=['status', 'cancelled_at'])

        return Response({
            'message': f'Add-on "{purchase.addon.name}" cancelled for organization',
            'status': 'cancelled',
        })

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

        # Also fetch all available plans for display (only active ones)
        all_plans = SubscriptionPlan.objects.filter(is_active=True).select_related('category').order_by('sort_order', 'monthly_price')
        available_plans = [{
            'id': str(p.id),
            'name': p.name,
            'description': p.description or '',
            'monthly_price': str(p.monthly_price),
            'annual_price': str(p.annual_price),
            'modules': p.modules or [],
            'features': p.features or {},
            'limits': p.limits or {},
            'trial_days': p.trial_days,
            'is_public': p.is_public,
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
            'client': {
                'id': str(org.client.id),
                'full_name': org.client.full_name,
                'email': org.client.email,
                'phone': org.client.phone,
                'company_name': org.client.company_name,
            } if org.client else None,
            'warnings': self._get_org_warnings(org, plan, user_count, site_count, module_count),
        })

    def _get_org_warnings(self, org, plan, user_count, site_count, module_count):
        """Check org integrity and return actionable warnings"""
        warnings = []
        
        # Missing client (account owner)
        if not org.client:
            warnings.append({
                'level': 'critical',
                'code': 'NO_CLIENT',
                'message': 'No account owner assigned',
                'suggestion': 'Assign a client to this organization from the Overview tab. Every instance must have an account owner for billing and communication.',
            })
        
        # No plan
        if not plan:
            warnings.append({
                'level': 'warning',
                'code': 'NO_PLAN',
                'message': 'No subscription plan assigned',
                'suggestion': 'Assign a subscription plan from the Billing tab to define resource limits and enable billing.',
            })
        
        # Expired plan
        if org.plan_expiry_at:
            from django.utils import timezone as tz
            if org.plan_expiry_at < tz.now():
                warnings.append({
                    'level': 'critical',
                    'code': 'PLAN_EXPIRED',
                    'message': f'Subscription expired on {org.plan_expiry_at.strftime("%b %d, %Y")}',
                    'suggestion': 'Renew the subscription or switch to a new plan to avoid service interruption.',
                })
        
        # No modules enabled
        if module_count == 0:
            warnings.append({
                'level': 'warning',
                'code': 'NO_MODULES',
                'message': 'No modules enabled',
                'suggestion': 'Enable at least the core modules from the Modules tab so the organization can function.',
            })
        
        # Missing business email
        if not org.business_email:
            warnings.append({
                'level': 'info',
                'code': 'NO_EMAIL',
                'message': 'No business email configured',
                'suggestion': 'Set a business email for this organization for notifications and correspondence.',
            })
        
        # No users
        if user_count == 0:
            warnings.append({
                'level': 'warning',
                'code': 'NO_USERS',
                'message': 'No users in this organization',
                'suggestion': 'Create at least one admin user from the Users tab so the organization can be accessed.',
            })
        
        # No sites
        if site_count == 0:
            warnings.append({
                'level': 'info',
                'code': 'NO_SITES',
                'message': 'No sites/locations configured',
                'suggestion': 'Create at least one site from the Sites tab for POS and inventory operations.',
            })
        
        return warnings

    @action(detail=True, methods=['post'], url_path='set-client')
    def set_client(self, request, pk=None):
        """Assign or unassign a client to this organization"""
        from erp.models import SaaSClient
        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        client_id = request.data.get('client_id')
        if client_id:
            try:
                client = SaaSClient.objects.get(id=client_id)
            except SaaSClient.DoesNotExist:
                return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)
            org.client = client
            org.save(update_fields=['client'])
            return Response({'message': f'Client "{client.full_name}" assigned to {org.name}'})
        else:
            org.client = None
            org.save(update_fields=['client'])
            return Response({'message': f'Client unassigned from {org.name}'})


    @action(detail=True, methods=['post'], url_path='change-plan')
    def change_plan(self, request, pk=None):
        """
        Change the subscription plan for an organization.
        
        Handles:
        - Upgrade: creates Purchase Invoice for price difference
        - Downgrade: creates Credit Note + Purchase Invoice
        - Module sync: enables new plan modules, disables modules not in new plan
        - Feature sync: applies plan features to org modules
        - Connector hook: notifies Finance module via ConnectorEngine
        """
        from erp.models import SubscriptionPlan, SubscriptionPayment
        from decimal import Decimal

        try:
            org = Organization.objects.get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found or inactive'}, status=status.HTTP_404_NOT_FOUND)

        old_plan = org.current_plan
        old_price = old_plan.monthly_price if old_plan else Decimal('0.00')
        new_price = new_plan.monthly_price
        old_plan_name = old_plan.name if old_plan else 'Free Tier'

        # ─── 1. Determine direction ─────────────────────────────────
        invoices_created = []

        if new_price > old_price:
            # UPGRADE: Purchase Invoice for the difference
            diff = new_price - old_price
            payment = SubscriptionPayment.objects.create(
                organization=org,
                plan=new_plan,
                previous_plan=old_plan,
                amount=diff,
                type='PURCHASE',
                status='COMPLETED',
                notes=f'Upgrade from "{old_plan_name}" (${old_price}/mo) to "{new_plan.name}" (${new_price}/mo). Difference: ${diff}/mo.'
            )
            invoices_created.append({
                'type': 'PURCHASE',
                'amount': str(diff),
                'description': f'Upgrade to {new_plan.name}',
            })

        elif new_price < old_price:
            # DOWNGRADE: Credit Note (refund old) + Purchase Invoice (new)
            refund = old_price - new_price
            SubscriptionPayment.objects.create(
                organization=org,
                plan=old_plan,
                previous_plan=old_plan,
                amount=refund,
                type='CREDIT_NOTE',
                status='COMPLETED',
                notes=f'Credit for downgrade from "{old_plan_name}" (${old_price}/mo). Refund: ${refund}/mo.'
            )
            invoices_created.append({
                'type': 'CREDIT_NOTE',
                'amount': str(refund),
                'description': f'Credit for {old_plan_name} downgrade',
            })

            SubscriptionPayment.objects.create(
                organization=org,
                plan=new_plan,
                previous_plan=old_plan,
                amount=new_price,
                type='PURCHASE',
                status='COMPLETED',
                notes=f'New subscription: "{new_plan.name}" (${new_price}/mo). Downgraded from "{old_plan_name}".'
            )
            invoices_created.append({
                'type': 'PURCHASE',
                'amount': str(new_price),
                'description': f'New plan: {new_plan.name}',
            })

        else:
            # Same price (lateral move): Purchase Invoice for continuity
            if new_price > Decimal('0.00'):
                SubscriptionPayment.objects.create(
                    organization=org,
                    plan=new_plan,
                    previous_plan=old_plan,
                    amount=new_price,
                    type='PURCHASE',
                    status='COMPLETED',
                    notes=f'Plan switch from "{old_plan_name}" to "{new_plan.name}" (same price: ${new_price}/mo).'
                )
                invoices_created.append({
                    'type': 'PURCHASE',
                    'amount': str(new_price),
                    'description': f'Switch to {new_plan.name}',
                })

        # ─── 2. Update org plan ──────────────────────────────────────
        org.current_plan = new_plan
        org.save(update_fields=['current_plan'])

        # ─── 3. Sync modules ────────────────────────────────────────
        new_plan_modules = set(new_plan.modules or [])
        old_plan_modules = set(old_plan.modules or []) if old_plan else set()

        modules_enabled = []
        modules_disabled = []

        # Enable new plan modules
        for mod_code in new_plan_modules:
            sm = None
            try:
                sm = SystemModule.objects.get(name=mod_code)
            except SystemModule.DoesNotExist:
                try:
                    sm = SystemModule.objects.get(manifest__code=mod_code)
                except SystemModule.DoesNotExist:
                    continue
            om, created = OrganizationModule.objects.get_or_create(
                organization=org, module_name=sm.name,
                defaults={'is_enabled': True, 'module_version': sm.version}
            )
            if not om.is_enabled:
                om.is_enabled = True
                om.save(update_fields=['is_enabled'])
            modules_enabled.append(sm.name)

        # Disable modules that are NOT in the new plan but were in the old plan
        modules_to_disable = old_plan_modules - new_plan_modules
        for mod_code in modules_to_disable:
            OrganizationModule.objects.filter(
                organization=org, module_name=mod_code, is_enabled=True
            ).update(is_enabled=False)
            modules_disabled.append(mod_code)

        # ─── 4. Sync features ───────────────────────────────────────
        plan_features = new_plan.features or {}
        for mod_code, features_list in plan_features.items():
            OrganizationModule.objects.filter(
                organization=org, module_name=mod_code
            ).update(active_features=features_list)

        # ─── 5. Connector hook — notify Finance module ──────────────
        try:
            from erp.connector_engine import ConnectorEngine
            engine = ConnectorEngine()
            for inv in invoices_created:
                engine.route_write(
                    source_module='saas',
                    target_module='finance',
                    endpoint='billing/plan-change/',
                    data={
                        'organization_id': str(org.id),
                        'organization_name': org.name,
                        'type': inv['type'],
                        'amount': inv['amount'],
                        'description': inv['description'],
                        'plan_name': new_plan.name,
                        'previous_plan_name': old_plan_name,
                    },
                    organization_id=str(org.id),
                    user=request.user,
                )
        except Exception as e:
            # Connector is best-effort — don't fail the plan change
            import logging
            logging.getLogger('erp').warning(f"Connector hook failed for plan change: {e}")

        direction = 'upgrade' if new_price > old_price else ('downgrade' if new_price < old_price else 'switch')

        return Response({
            'message': f'Plan {direction}d to "{new_plan.name}"',
            'direction': direction,
            'plan': {
                'id': str(new_plan.id),
                'name': new_plan.name,
                'monthly_price': str(new_plan.monthly_price),
            },
            'previous_plan': old_plan_name,
            'invoices': invoices_created,
            'modules_enabled': modules_enabled,
            'modules_disabled': modules_disabled,
        })

    @action(detail=True, methods=['get'])
    def billing(self, request, pk=None):
        """Returns billing/payment history + balance for an organization"""
        from erp.models import SubscriptionPayment
        from django.db.models import Sum, Q
        try:
            org = Organization.objects.select_related('client').get(id=pk)
        except Organization.DoesNotExist:
            return Response({'error': 'Organization not found'}, status=status.HTTP_404_NOT_FOUND)

        payments = SubscriptionPayment.objects.filter(
            organization=org
        ).select_related('plan').order_by('-created_at')[:50]

        history = [{
            'id': str(p.id),
            'plan_name': p.plan.name if p.plan else 'Unknown',
            'amount': str(p.amount),
            'type': p.type,
            'status': p.status,
            'notes': p.notes,
            'previous_plan_name': p.previous_plan.name if p.previous_plan else None,
            'created_at': p.created_at.isoformat(),
        } for p in payments]

        # Calculate balance from completed payments
        completed = SubscriptionPayment.objects.filter(
            organization=org, status__in=['COMPLETED', 'PAID']
        )
        total_paid = completed.exclude(type='CREDIT_NOTE').aggregate(
            total=Sum('amount'))['total'] or 0
        total_credits = completed.filter(type='CREDIT_NOTE').aggregate(
            total=Sum('amount'))['total'] or 0
        net_balance = float(total_paid) - float(total_credits)

        # Client info for billing card
        client_data = None
        if org.client:
            client_data = {
                'id': str(org.client.id),
                'full_name': org.client.full_name,
                'email': org.client.email,
                'phone': org.client.phone,
                'company_name': org.client.company_name,
            }

        return Response({
            'history': history,
            'balance': {
                'total_paid': f'{float(total_paid):.2f}',
                'total_credits': f'{float(total_credits):.2f}',
                'net_balance': f'{net_balance:.2f}',
            },
            'client': client_data,
        })

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


# ═══════════════════════════════════════════════════════════════════════════
# SaaS CLIENT (Account Owner) ViewSet
# ═══════════════════════════════════════════════════════════════════════════

class SaaSClientViewSet(viewsets.ViewSet):
    """
    CRUD for SaaS Client (account owner / billing contact).
    One client can own multiple organization instances.
    """
    permission_classes = [permissions.IsAdminUser]

    def list(self, request):
        """List all clients with their org count"""
        from erp.models import SaaSClient
        from django.db.models import Count

        clients = SaaSClient.objects.annotate(
            org_count=Count('organizations')
        ).order_by('-created_at')

        # Optional search
        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            clients = clients.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search)
            )

        data = [{
            'id': str(c.id),
            'first_name': c.first_name,
            'last_name': c.last_name,
            'full_name': c.full_name,
            'email': c.email,
            'phone': c.phone,
            'company_name': c.company_name,
            'city': c.city,
            'country': c.country,
            'is_active': c.is_active,
            'org_count': c.org_count,
            'created_at': c.created_at.isoformat(),
        } for c in clients]

        return Response(data)

    def retrieve(self, request, pk=None):
        """Get a single client with their linked organizations"""
        from erp.models import SaaSClient
        try:
            c = SaaSClient.objects.get(id=pk)
        except SaaSClient.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        orgs = c.organizations.all().order_by('-created_at')
        org_data = [{
            'id': str(o.id),
            'name': o.name,
            'slug': o.slug,
            'is_active': o.is_active,
            'plan_name': o.current_plan.name if o.current_plan else 'No Plan',
            'created_at': o.created_at.isoformat(),
        } for o in orgs]

        return Response({
            'id': str(c.id),
            'first_name': c.first_name,
            'last_name': c.last_name,
            'full_name': c.full_name,
            'email': c.email,
            'phone': c.phone,
            'company_name': c.company_name,
            'address': c.address,
            'city': c.city,
            'country': c.country,
            'is_active': c.is_active,
            'notes': c.notes,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
            'organizations': org_data,
        })

    def create(self, request):
        """Create a new client"""
        from erp.models import SaaSClient
        data = request.data

        required = ['first_name', 'last_name', 'email']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return Response({'error': f'Missing required fields: {", ".join(missing)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Check email uniqueness
        if SaaSClient.objects.filter(email=data['email']).exists():
            return Response({'error': 'A client with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        client = SaaSClient.objects.create(
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            phone=data.get('phone', ''),
            company_name=data.get('company_name', ''),
            address=data.get('address', ''),
            city=data.get('city', ''),
            country=data.get('country', ''),
            notes=data.get('notes', ''),
        )

        # Sync to CRM Contact in SaaS org
        client.sync_to_crm_contact()

        return Response({
            'id': str(client.id),
            'full_name': client.full_name,
            'email': client.email,
            'message': f'Client "{client.full_name}" created',
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """Update client details"""
        from erp.models import SaaSClient
        try:
            client = SaaSClient.objects.get(id=pk)
        except SaaSClient.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        updatable = ['first_name', 'last_name', 'email', 'phone', 'company_name',
                      'address', 'city', 'country', 'is_active', 'notes']
        updated = []
        for field in updatable:
            if field in request.data:
                setattr(client, field, request.data[field])
                updated.append(field)

        if updated:
            client.save(update_fields=updated + ['updated_at'])

        return Response({
            'id': str(client.id),
            'full_name': client.full_name,
            'message': f'Client updated ({", ".join(updated)})',
        })

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Consolidated billing statement across all client organizations"""
        from erp.models import SaaSClient, SubscriptionPayment

        try:
            client = SaaSClient.objects.get(id=pk)
        except SaaSClient.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        org_ids = client.organizations.values_list('id', flat=True)
        payments = SubscriptionPayment.objects.filter(
            organization_id__in=org_ids
        ).select_related('plan', 'organization', 'previous_plan').order_by('-created_at')[:100]

        from decimal import Decimal
        total_billed = sum(p.amount for p in payments if p.type == 'PURCHASE')
        total_credits = sum(p.amount for p in payments if p.type == 'CREDIT_NOTE')

        data = [{
            'id': str(p.id),
            'organization_name': p.organization.name,
            'plan_name': p.plan.name if p.plan else 'Unknown',
            'type': p.type,
            'amount': str(p.amount),
            'status': p.status,
            'notes': p.notes,
            'created_at': p.created_at.isoformat(),
        } for p in payments]

        return Response({
            'client': client.full_name,
            'total_billed': str(total_billed),
            'total_credits': str(total_credits),
            'net_total': str(total_billed - total_credits),
            'payments': data,
        })
