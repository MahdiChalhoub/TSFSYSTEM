"""
Compliance Views
================
REST ViewSets for PriceRegulation, RegulationRule, and RegulationAuditLog.
Also exposes compliance dashboard summary and enforcement actions.
"""
import logging
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.views_base import TenantModelViewSet
from erp.middleware import get_current_tenant_id
from erp.mixins import UDLEViewSetMixin
from apps.compliance.models import PriceRegulation, RegulationRule, RegulationAuditLog
from apps.compliance.serializers.regulation_serializers import (
    PriceRegulationSerializer,
    PriceRegulationListSerializer,
    RegulationRuleSerializer,
    RegulationAuditLogSerializer,
)
from apps.compliance.services.regulation_service import PriceRegulationService

logger = logging.getLogger(__name__)


class PriceRegulationViewSet(UDLEViewSetMixin, TenantModelViewSet):
    """
    CRUD for PriceRegulations + compliance actions.
    Supports UDLE metadata introspection.
    """
    queryset = PriceRegulation.objects.all()
    serializer_class = PriceRegulationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'regulation_type', 'severity', 'scope',
                        'jurisdiction_country', 'is_current']
    search_fields = ['name', 'code', 'reference', 'authority']
    ordering_fields = ['name', 'code', 'effective_date', 'expiry_date',
                       'created_at', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return PriceRegulationListSerializer
        return PriceRegulationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # By default, only show current versions
        show_history = self.request.query_params.get('show_history', 'false').lower()
        if show_history != 'true':
            qs = qs.filter(is_current=True)
        return qs.select_related('currency', 'jurisdiction_country')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Compliance dashboard summary metrics."""
        org_id = get_current_tenant_id() or request.user.organization_id
        if not org_id:
            return Response({'error': 'No organization context'}, status=400)

        from apps.inventory.models import Product

        regulations = PriceRegulation.objects.filter(
            organization_id=org_id, is_current=True
        )

        total_regs = regulations.count()
        active_regs = regulations.filter(status='ACTIVE').count()

        regulated_products = Product.objects.filter(
            organization_id=org_id,
            price_regulation__isnull=False,
        )
        total_regulated = regulated_products.count()
        compliant = regulated_products.filter(regulation_status='COMPLIANT').count()
        violating = regulated_products.filter(regulation_status='VIOLATION').count()

        compliance_rate = (compliant / total_regulated * 100) if total_regulated > 0 else 100.0

        thirty_days = timezone.now().date() + timedelta(days=30)
        expiring = regulations.filter(
            status='ACTIVE',
            expiry_date__isnull=False,
            expiry_date__lte=thirty_days,
        ).count()

        return Response({
            'total_regulations': total_regs,
            'active_regulations': active_regs,
            'total_regulated_products': total_regulated,
            'compliant_products': compliant,
            'violating_products': violating,
            'compliance_rate': round(compliance_rate, 1),
            'expiring_soon': expiring,
        })

    @action(detail=False, methods=['post'], url_path='bulk-check')
    def bulk_check(self, request):
        """Run bulk compliance check across all regulated products."""
        org_id = get_current_tenant_id() or request.user.organization_id
        if not org_id:
            return Response({'error': 'No organization context'}, status=400)

        from erp.models import Organization
        org = Organization.objects.get(id=org_id)
        auto_fix = request.data.get('auto_fix', False)

        service = PriceRegulationService()
        result = service.bulk_compliance_check(
            organization=org, auto_fix=auto_fix, user=request.user
        )
        return Response(result)

    @action(detail=True, methods=['post'], url_path='new-version')
    def new_version(self, request, pk=None):
        """Create a new version of a regulation (e.g., price update)."""
        regulation = self.get_object()
        updated_fields = {}

        for field in ['fixed_price', 'max_price', 'min_price', 'tolerance',
                      'effective_date', 'expiry_date', 'notes']:
            if field in request.data:
                updated_fields[field] = request.data[field]

        new_reg = regulation.create_new_version(**updated_fields)
        new_reg.save()

        # Log version update
        RegulationAuditLog.log(
            organization=regulation.organization,
            action='REGULATION_UPDATED',
            regulation=new_reg,
            source='manual',
            user=request.user,
            details={
                'old_version': regulation.version,
                'new_version': new_reg.version,
                'updated_fields': list(updated_fields.keys()),
            },
        )

        return Response(PriceRegulationSerializer(new_reg).data, status=201)


class RegulationRuleViewSet(UDLEViewSetMixin, TenantModelViewSet):
    """CRUD for RegulationRules."""
    queryset = RegulationRule.objects.all()
    serializer_class = RegulationRuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['regulation', 'is_active', 'category', 'unit']
    ordering_fields = ['priority', 'created_at']

    def get_queryset(self):
        return super().get_queryset().select_related(
            'regulation', 'category', 'product_country', 'unit', 'parfum'
        ).prefetch_related('brands')

    @action(detail=True, methods=['get'], url_path='preview-matches')
    def preview_matches(self, request, pk=None):
        """Preview which products a rule would match (without applying)."""
        rule = self.get_object()
        org_id = get_current_tenant_id() or request.user.organization_id

        from apps.inventory.models import Product
        products = Product.objects.filter(
            organization_id=org_id, status='ACTIVE'
        ).select_related('category', 'brand', 'unit')

        limit = int(request.query_params.get('limit', 50))
        matches = []
        for p in products[:500]:  # Check up to 500 products
            if rule.matches_product(p):
                matches.append({
                    'id': p.id,
                    'name': p.name,
                    'sku': p.sku,
                    'category': p.category.name if p.category else None,
                    'brand': p.brand.name if p.brand else None,
                    'selling_price': float(p.selling_price_ttc),
                })
                if len(matches) >= limit:
                    break

        return Response({
            'total_matched': len(matches),
            'matches': matches,
        })


class RegulationAuditLogViewSet(TenantModelViewSet):
    """Read-only ViewSet for the audit trail."""
    queryset = RegulationAuditLog.objects.all()
    serializer_class = RegulationAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options']  # Read-only
    filterset_fields = ['action', 'source', 'product', 'regulation']
    ordering_fields = ['timestamp']

    def get_queryset(self):
        org_id = get_current_tenant_id() or self.request.user.organization_id
        if not org_id:
            return self.queryset.none()
        return self.queryset.filter(
            organization_id=org_id
        ).select_related('user', 'product', 'regulation', 'currency')
