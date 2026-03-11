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



class OrgSaasBillingMixin:

    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        """Returns live usage metrics for an organization — reads real plan data"""
        from erp.models import User, SubscriptionPlan, SubscriptionPayment
        from apps.inventory.models import Warehouse
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
        # Filter by org's business type if set — plans with no business_types = universal
        all_plans = SubscriptionPlan.objects.filter(is_active=True).select_related('category').prefetch_related('business_types').order_by('sort_order', 'monthly_price')
        if org.business_type_id:
            all_plans = all_plans.filter(
                models.Q(business_types__id=org.business_type_id) | models.Q(business_types__isnull=True)
            ).distinct()
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
        site_count = Warehouse.objects.filter(organization=org, location_type='BRANCH').count()
        
        # [FIX] Module count must match the modules() list logic:
        # Count OrganizationModule records that are enabled PLUS core modules
        # that are always considered INSTALLED even without an OrganizationModule record.
        enabled_module_names = set(
            OrganizationModule.objects.filter(organization=org, is_enabled=True)
            .values_list('module_name', flat=True)
        )
        # Add core modules that are always INSTALLED
        for sm in SystemModule.objects.all():
            is_core = sm.manifest.get('is_core', False) or sm.manifest.get('required', False) or sm.name in ['core', 'coreplatform']
            if is_core:
                enabled_module_names.add(sm.name)
        module_count = len(enabled_module_names)
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


    @staticmethod
    def _perform_plan_change(org, new_plan, user):
        """Core logic for plan change, reusable by different views."""
        from erp.models import SubscriptionPayment, SystemModule, OrganizationModule
        from decimal import Decimal

        old_plan = org.current_plan
        old_price = old_plan.monthly_price if old_plan else Decimal('0.00')
        new_price = new_plan.monthly_price
        old_plan_name = old_plan.name if old_plan else 'Free Tier'

        # ─── 1. Determine direction ─────────────────────────────────
        invoices_created = []

        if new_price > old_price:
            # UPGRADE
            diff = new_price - old_price
            SubscriptionPayment.objects.create(
                organization=org, plan=new_plan, previous_plan=old_plan,
                amount=diff, type='PURCHASE', status='COMPLETED',
                notes=f'Upgrade from "{old_plan_name}" to "{new_plan.name}". Difference: ${diff}/mo.'
            )
            invoices_created.append({'type': 'PURCHASE', 'amount': str(diff), 'description': f'Upgrade to {new_plan.name}'})
        elif new_price < old_price:
            # DOWNGRADE
            refund = old_price - new_price
            SubscriptionPayment.objects.create(
                organization=org, plan=old_plan, previous_plan=old_plan,
                amount=refund, type='CREDIT_NOTE', status='COMPLETED',
                notes=f'Credit for downgrade from "{old_plan_name}". Refund: ${refund}/mo.'
            )
            invoices_created.append({'type': 'CREDIT_NOTE', 'amount': str(refund), 'description': f'Credit for {old_plan_name} downgrade'})
            SubscriptionPayment.objects.create(
                organization=org, plan=new_plan, previous_plan=old_plan,
                amount=new_price, type='PURCHASE', status='COMPLETED',
                notes=f'New subscription: "{new_plan.name}".'
            )
            invoices_created.append({'type': 'PURCHASE', 'amount': str(new_price), 'description': f'New plan: {new_plan.name}'})
        else:
            if new_price > Decimal('0.00'):
                SubscriptionPayment.objects.create(
                    organization=org, plan=new_plan, previous_plan=old_plan,
                    amount=new_price, type='PURCHASE', status='COMPLETED',
                    notes=f'Plan switch to "{new_plan.name}" (same price).'
                )
                invoices_created.append({'type': 'PURCHASE', 'amount': str(new_price), 'description': f'Switch to {new_plan.name}'})

        # ─── 2. Update org plan ──────────────────────────────────────
        org.current_plan = new_plan
        org.save(update_fields=['current_plan'])

        # ─── 3. Sync modules & features ─────────────────────────────
        new_plan_modules = set(new_plan.modules or [])
        old_plan_modules = set(old_plan.modules or []) if old_plan else set()

        for mod_code in new_plan_modules:
            try:
                sm = SystemModule.objects.get(models.Q(name=mod_code) | models.Q(manifest__code=mod_code))
                om, _ = OrganizationModule.objects.get_or_create(
                    organization=org, module_name=sm.name,
                    defaults={'is_enabled': True, 'module_version': sm.version}
                )
                if not om.is_enabled:
                    om.is_enabled = True
                    om.save(update_fields=['is_enabled'])
                
                # Apply features
                plan_features = (new_plan.features or {}).get(mod_code, [])
                if plan_features:
                    om.active_features = plan_features
                    om.save(update_fields=['active_features'])
            except Exception: continue

        for mod_code in (old_plan_modules - new_plan_modules):
            OrganizationModule.objects.filter(organization=org, module_name=mod_code, is_enabled=True).update(is_enabled=False)

        # ─── 4. Dispatch Subscription Event ─────────────────────────
        try:
            from erp.connector_engine import ConnectorEngine
            engine = ConnectorEngine()
            
            # Identify SaaS org for context
            saas_org = Organization.objects.filter(slug='saas').first()
            saas_org_id = saas_org.id if saas_org else None

            for inv in invoices_created:
                engine.dispatch_event(
                    source_module='saas',
                    event_name='subscription:updated',
                    payload={
                        'type': inv['type'],
                        'amount': inv['amount'],
                        'description': inv['description'],
                        'target_org_id': str(org.id),
                        'target_org_name': org.name
                    },
                    tenant_id=saas_org_id
                )
        except Exception as e:
            logger.error(f"Failed to dispatch subscription event: {e}")

        return invoices_created


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
            # Resolve the linked CRM Contact ID in the SaaS org (for direct profile navigation)
            crm_contact_id = None
            try:
                from apps.crm.models import Contact
                saas_org = Organization.objects.filter(slug='saas').first()
                if saas_org:
                    crm_contact = Contact.objects.filter(
                        organization=saas_org,
                        email=org.client.email
                    ).values('id').first()
                    if crm_contact:
                        crm_contact_id = str(crm_contact['id'])
            except Exception:
                pass

            client_data = {
                'id': str(org.client.id),
                'full_name': org.client.full_name,
                'email': org.client.email,
                'phone': org.client.phone,
                'company_name': org.client.company_name,
                'crm_contact_id': crm_contact_id,
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

