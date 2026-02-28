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

