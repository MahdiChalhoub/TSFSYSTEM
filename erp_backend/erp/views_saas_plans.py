from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from django.db import models as models
from .models import SystemModule, Organization, OrganizationModule, SystemUpdate
from .module_manager import ModuleManager
from .kernel_manager import KernelManager
import logging

logger = logging.getLogger(__name__)


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
        """List all subscription plans, optionally filtered by business_type"""
        from erp.models import SubscriptionPlan
        plans = SubscriptionPlan.objects.select_related('category').prefetch_related('business_types').all()
        # Filter by business type if specified
        bt_id = request.query_params.get('business_type')
        if bt_id:
            plans = plans.filter(
                models.Q(business_types__id=bt_id) | models.Q(business_types__isnull=True)
            ).distinct()
        return Response([self._serialize_plan(p) for p in plans])

    def retrieve(self, request, pk=None):
        """Get plan detail with organizations and addons"""
        from erp.models import SubscriptionPlan
        try:
            plan = SubscriptionPlan.objects.select_related('category').prefetch_related('organizations', 'addons__plans').get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._serialize_plan(plan, include_orgs=True))

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def subscribe(self, request, pk=None):
        """Subscribe the current user's organization to this plan."""
        from erp.models import SubscriptionPlan, Organization
        try:
            plan = SubscriptionPlan.objects.get(pk=pk, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found or inactive'}, status=404)

        if not hasattr(request.user, 'organization') or not request.user.organization:
            return Response({'error': 'No organization associated with user'}, status=400)

        org = request.user.organization
        # Perform plan change logic
        invoices = OrgModuleViewSet._perform_plan_change(org, plan, request.user)
        
        return Response({
            'message': f'Successfully subscribed to {plan.name}',
            'invoices': invoices
        })

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
