"""
Procurement Governance ViewSets
================================
Enterprise procurement API endpoints:
- Purchase Requisitions (CRUD + lifecycle)
- Supplier Quotations (CRUD + lifecycle + conversion)
- 3-Way Match Results (read + resolve)
- Dispute Cases (CRUD + lifecycle)
- Procurement Budgets (CRUD)
- Supplier Performance Snapshots (read + compute)
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from decimal import Decimal

from erp.middleware import get_current_tenant_id

from apps.pos.models.procurement_governance_models import (
    ThreeWayMatchResult, ThreeWayMatchLine, DisputeCase,
    PurchaseRequisition, PurchaseRequisitionLine,
    SupplierQuotation, SupplierQuotationLine,
    ProcurementBudget, BudgetCommitment,
    SupplierPerformanceSnapshot,
)
from apps.pos.serializers.procurement_governance_serializers import (
    ThreeWayMatchResultSerializer, ThreeWayMatchLineSerializer,
    DisputeCaseSerializer,
    PurchaseRequisitionSerializer, PurchaseRequisitionLineSerializer,
    SupplierQuotationSerializer, SupplierQuotationLineSerializer,
    ProcurementBudgetSerializer, BudgetCommitmentSerializer,
    SupplierPerformanceSnapshotSerializer,
)


# =============================================================================
# PURCHASE REQUISITIONS
# =============================================================================

class PurchaseRequisitionViewSet(viewsets.ModelViewSet):
    """
    Purchase Requisition lifecycle:
    DRAFT → SUBMITTED → APPROVED → RFQ → CONVERTED → CLOSED | CANCELLED
    """
    serializer_class = PurchaseRequisitionSerializer
    queryset = PurchaseRequisition.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return PurchaseRequisition.objects.none()
        qs = PurchaseRequisition.objects.filter(
            organization_id=org_id
        ).select_related(
            'site', 'requested_by', 'approved_by', 'converted_po'
        ).prefetch_related('lines', 'lines__product').order_by('-created_at')

        req_status = self.request.query_params.get('status')
        if req_status:
            qs = qs.filter(status=req_status)
        priority = self.request.query_params.get('priority')
        if priority:
            qs = qs.filter(priority=priority)
        query = self.request.query_params.get('query')
        if query:
            from django.db.models import Q
            qs = qs.filter(
                Q(req_number__icontains=query) |
                Q(justification__icontains=query) |
                Q(notes__icontains=query)
            )
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        lines_data = self.request.data.get('lines', [])
        req = serializer.save(
            organization_id=org_id,
            requested_by=self.request.user if self.request.user.is_authenticated else None,
        )
        # Create lines from nested data
        for line_data in lines_data:
            PurchaseRequisitionLine.objects.create(
                organization_id=org_id,
                requisition=req,
                product_id=line_data.get('product_id') or line_data.get('product'),
                quantity=Decimal(str(line_data.get('quantity', 1))),
                estimated_unit_price=Decimal(str(line_data.get('estimated_unit_price', 0))) if line_data.get('estimated_unit_price') else None,
                needed_by=line_data.get('needed_by'),
                justification=line_data.get('justification', ''),
                preferred_supplier_id=line_data.get('preferred_supplier') or None,
            )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit requisition for approval."""
        req = self.get_object()
        if req.status != 'DRAFT':
            return Response({"error": "Only DRAFT requisitions can be submitted"}, status=400)
        if not req.lines.exists():
            return Response({"error": "Requisition must have at least one line"}, status=400)
        req.status = 'SUBMITTED'
        req.save()
        return Response(PurchaseRequisitionSerializer(req).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted requisition."""
        req = self.get_object()
        if req.status != 'SUBMITTED':
            return Response({"error": "Only SUBMITTED requisitions can be approved"}, status=400)
        req.status = 'APPROVED'
        req.approved_by = request.user if request.user.is_authenticated else None
        req.approved_at = timezone.now()
        req.save()
        return Response(PurchaseRequisitionSerializer(req).data)

    @action(detail=True, methods=['post'], url_path='create-rfq')
    def create_rfq(self, request, pk=None):
        """Create an RFQ (SupplierQuotation request) from an approved requisition."""
        req = self.get_object()
        if req.status not in ('APPROVED', 'RFQ'):
            return Response({"error": "Only APPROVED requisitions can generate RFQs"}, status=400)

        supplier_ids = request.data.get('supplier_ids', [])
        if not supplier_ids:
            return Response({"error": "At least one supplier_id is required"}, status=400)

        org_id = get_current_tenant_id()
        created_quotations = []

        for supplier_id in supplier_ids:
            sq = SupplierQuotation.objects.create(
                organization_id=org_id,
                requisition=req,
                supplier_id=supplier_id,
                status='REQUESTED',
                currency=request.data.get('currency', 'XOF'),
            )
            # Pre-populate lines from requisition
            for req_line in req.lines.all():
                SupplierQuotationLine.objects.create(
                    organization_id=org_id,
                    quotation=sq,
                    product=req_line.product,
                    requisition_line=req_line,
                    quantity=req_line.quantity,
                    unit_price=req_line.estimated_unit_price or Decimal('0'),
                )
            created_quotations.append(sq)

        req.status = 'RFQ'
        req.save(update_fields=['status'])

        return Response({
            'requisition': PurchaseRequisitionSerializer(req).data,
            'quotations_created': len(created_quotations),
            'quotation_ids': [q.id for q in created_quotations],
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a requisition."""
        req = self.get_object()
        if req.status in ('CONVERTED', 'CLOSED'):
            return Response({"error": f"Cannot cancel requisition in {req.status} status"}, status=400)
        req.status = 'CANCELLED'
        req.save(update_fields=['status'])
        return Response(PurchaseRequisitionSerializer(req).data)


# =============================================================================
# SUPPLIER QUOTATIONS
# =============================================================================

class SupplierQuotationViewSet(viewsets.ModelViewSet):
    """
    Supplier Quotation lifecycle:
    DRAFT → REQUESTED → RECEIVED → UNDER_REVIEW → SELECTED | REJECTED | EXPIRED
    """
    serializer_class = SupplierQuotationSerializer
    queryset = SupplierQuotation.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return SupplierQuotation.objects.none()
        qs = SupplierQuotation.objects.filter(
            organization_id=org_id
        ).select_related(
            'supplier', 'requisition', 'converted_po'
        ).prefetch_related('lines', 'lines__product').order_by('-created_at')

        req_status = self.request.query_params.get('status')
        if req_status:
            qs = qs.filter(status=req_status)
        supplier = self.request.query_params.get('supplier')
        if supplier:
            qs = qs.filter(supplier_id=supplier)
        requisition = self.request.query_params.get('requisition')
        if requisition:
            qs = qs.filter(requisition_id=requisition)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        lines_data = self.request.data.get('lines', [])
        sq = serializer.save(organization_id=org_id)
        for line_data in lines_data:
            SupplierQuotationLine.objects.create(
                organization_id=org_id,
                quotation=sq,
                product_id=line_data.get('product_id') or line_data.get('product'),
                quantity=Decimal(str(line_data.get('quantity', 1))),
                unit_price=Decimal(str(line_data.get('unit_price', 0))),
                tax_rate=Decimal(str(line_data.get('tax_rate', 0))),
                lead_time_days=int(line_data.get('lead_time_days', 0)),
                notes=line_data.get('notes', ''),
            )

    @action(detail=True, methods=['post'])
    def select(self, request, pk=None):
        """Select this supplier quotation as the winner."""
        sq = self.get_object()
        if sq.status not in ('RECEIVED', 'UNDER_REVIEW'):
            return Response({"error": "Only RECEIVED/UNDER_REVIEW quotations can be selected"}, status=400)
        sq.status = 'SELECTED'
        sq.save(update_fields=['status'])

        # Reject other quotations for the same requisition
        if sq.requisition_id:
            SupplierQuotation.objects.filter(
                requisition=sq.requisition,
                status__in=('RECEIVED', 'UNDER_REVIEW'),
            ).exclude(id=sq.id).update(status='REJECTED')

        return Response(SupplierQuotationSerializer(sq).data)

    @action(detail=True, methods=['post'], url_path='convert-to-po')
    def convert_to_po(self, request, pk=None):
        """Convert a selected supplier quotation into a Purchase Order."""
        sq = self.get_object()
        if sq.status != 'SELECTED':
            return Response({"error": "Only SELECTED quotations can be converted to PO"}, status=400)

        from apps.pos.services.procurement_domain_service import ProcurementDomainService

        org_id = get_current_tenant_id()
        from erp.models import Organization
        organization = Organization.objects.get(id=org_id)

        lines = []
        for sq_line in sq.lines.all():
            lines.append({
                'product_id': sq_line.product_id,
                'quantity': float(sq_line.quantity),
                'unit_price': float(sq_line.unit_price),
                'tax_rate': float(sq_line.tax_rate),
            })

        po = ProcurementDomainService.create_document(
            organization=organization,
            mode='FORMAL',
            user=request.user if request.user.is_authenticated else None,
            supplier=sq.supplier_id,
            supplier_name=sq.supplier.name if sq.supplier else '',
            site=request.data.get('site') or None,
            warehouse=request.data.get('warehouse') or None,
            expected_date=request.data.get('expected_date'),
            notes=f"Converted from Supplier Quotation {sq.quotation_number or sq.id}",
            lines=lines,
        )

        sq.converted_po = po
        sq.status = 'SELECTED'  # Already selected, but confirm
        sq.save(update_fields=['converted_po'])

        # Also update requisition if linked
        if sq.requisition:
            sq.requisition.converted_po = po
            sq.requisition.status = 'CONVERTED'
            sq.requisition.save(update_fields=['converted_po', 'status'])

        from apps.pos.serializers.purchase_serializers import PurchaseOrderSerializer
        return Response({
            'quotation': SupplierQuotationSerializer(sq).data,
            'purchase_order': PurchaseOrderSerializer(po).data,
        })

    @action(detail=False, methods=['get'])
    def compare(self, request):
        """Compare quotations for the same requisition side-by-side."""
        requisition_id = request.query_params.get('requisition')
        if not requisition_id:
            return Response({"error": "requisition query parameter required"}, status=400)

        org_id = get_current_tenant_id()
        quotations = SupplierQuotation.objects.filter(
            organization_id=org_id,
            requisition_id=requisition_id,
            status__in=('RECEIVED', 'UNDER_REVIEW', 'SELECTED'),
        ).select_related('supplier').prefetch_related('lines', 'lines__product')

        comparison = []
        for sq in quotations:
            comparison.append({
                'quotation_id': sq.id,
                'supplier_name': sq.supplier.name if sq.supplier else '',
                'status': sq.status,
                'total_amount': float(sq.total_amount),
                'currency': sq.currency,
                'valid_until': str(sq.valid_until) if sq.valid_until else None,
                'lines': [
                    {
                        'product_name': l.product.name,
                        'product_id': l.product_id,
                        'quantity': float(l.quantity),
                        'unit_price': float(l.unit_price),
                        'line_total': float(l.line_total),
                        'lead_time_days': l.lead_time_days,
                    }
                    for l in sq.lines.all()
                ],
            })

        return Response({'requisition_id': requisition_id, 'quotations': comparison})


# =============================================================================
# 3-WAY MATCH RESULTS
# =============================================================================

class ThreeWayMatchResultViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to 3-way match results.
    Plus resolve action for disputed matches.
    """
    serializer_class = ThreeWayMatchResultSerializer
    queryset = ThreeWayMatchResult.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return ThreeWayMatchResult.objects.none()
        qs = ThreeWayMatchResult.objects.filter(
            organization_id=org_id
        ).select_related(
            'purchase_order', 'invoice', 'matched_by', 'resolved_by'
        ).prefetch_related('lines', 'lines__product').order_by('-matched_at')

        match_status = self.request.query_params.get('status')
        if match_status:
            qs = qs.filter(status=match_status)
        po = self.request.query_params.get('purchase_order')
        if po:
            qs = qs.filter(purchase_order_id=po)
        blocked = self.request.query_params.get('payment_blocked')
        if blocked is not None:
            qs = qs.filter(payment_blocked=blocked.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark a disputed match as resolved."""
        match = self.get_object()
        if match.status not in ('DISPUTED', 'QTY_VARIANCE', 'PRICE_VARIANCE', 'BLOCKED'):
            return Response({"error": "Only disputed/variance matches can be resolved"}, status=400)

        match.status = 'RESOLVED'
        match.payment_blocked = False
        match.resolved_by = request.user if request.user.is_authenticated else None
        match.resolved_at = timezone.now()
        match.resolution_notes = request.data.get('notes', '')
        match.save()
        return Response(ThreeWayMatchResultSerializer(match).data)


# =============================================================================
# DISPUTE CASES
# =============================================================================

class DisputeCaseViewSet(viewsets.ModelViewSet):
    """
    Dispute lifecycle: OPEN → UNDER_REVIEW → ESCALATED → RESOLVED | CANCELLED
    """
    serializer_class = DisputeCaseSerializer
    queryset = DisputeCase.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return DisputeCase.objects.none()
        qs = DisputeCase.objects.filter(
            organization_id=org_id
        ).select_related(
            'purchase_order', 'invoice', 'match_result',
            'opened_by', 'resolved_by'
        ).order_by('-opened_at')

        dispute_status = self.request.query_params.get('status')
        if dispute_status:
            qs = qs.filter(status=dispute_status)
        dispute_type = self.request.query_params.get('type')
        if dispute_type:
            qs = qs.filter(dispute_type=dispute_type)
        po = self.request.query_params.get('purchase_order')
        if po:
            qs = qs.filter(purchase_order_id=po)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        serializer.save(
            organization_id=org_id,
            opened_by=self.request.user if self.request.user.is_authenticated else None,
        )

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve a dispute case."""
        dispute = self.get_object()
        if dispute.status in ('RESOLVED', 'CANCELLED'):
            return Response({"error": f"Cannot resolve dispute in {dispute.status} status"}, status=400)

        dispute.status = 'RESOLVED'
        dispute.resolution_type = request.data.get('resolution_type', 'NO_ACTION')
        dispute.resolution_notes = request.data.get('notes', '')
        dispute.resolved_by = request.user if request.user.is_authenticated else None
        dispute.resolved_at = timezone.now()
        dispute.save()

        # Unblock payment on associated match result
        if dispute.match_result and dispute.match_result.payment_blocked:
            dispute.match_result.payment_blocked = False
            dispute.match_result.status = 'RESOLVED'
            dispute.match_result.resolved_at = timezone.now()
            dispute.match_result.save(update_fields=['payment_blocked', 'status', 'resolved_at'])

        return Response(DisputeCaseSerializer(dispute).data)

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """Escalate a dispute."""
        dispute = self.get_object()
        if dispute.status not in ('OPEN', 'UNDER_REVIEW'):
            return Response({"error": "Only OPEN/UNDER_REVIEW disputes can be escalated"}, status=400)
        dispute.status = 'ESCALATED'
        dispute.save(update_fields=['status'])
        return Response(DisputeCaseSerializer(dispute).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a dispute."""
        dispute = self.get_object()
        if dispute.status == 'RESOLVED':
            return Response({"error": "Cannot cancel resolved disputes"}, status=400)
        dispute.status = 'CANCELLED'
        dispute.save(update_fields=['status'])
        return Response(DisputeCaseSerializer(dispute).data)


# =============================================================================
# PROCUREMENT BUDGETS
# =============================================================================

class ProcurementBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementBudgetSerializer
    queryset = ProcurementBudget.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return ProcurementBudget.objects.none()
        qs = ProcurementBudget.objects.filter(
            organization_id=org_id
        ).select_related('site', 'category').prefetch_related(
            'commitments', 'commitments__purchase_order'
        ).order_by('-period_start')

        active = self.request.query_params.get('active')
        if active is not None:
            qs = qs.filter(is_active=active.lower() == 'true')
        site = self.request.query_params.get('site')
        if site:
            qs = qs.filter(site_id=site)
        return qs

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        serializer.save(organization_id=org_id)


# =============================================================================
# SUPPLIER PERFORMANCE
# =============================================================================

class SupplierPerformanceViewSet(viewsets.ReadOnlyModelViewSet):
    """Read supplier performance snapshots + compute action."""
    serializer_class = SupplierPerformanceSnapshotSerializer
    queryset = SupplierPerformanceSnapshot.objects.all()

    def get_queryset(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return SupplierPerformanceSnapshot.objects.none()
        qs = SupplierPerformanceSnapshot.objects.filter(
            organization_id=org_id
        ).select_related('supplier').order_by('-period_end')

        supplier = self.request.query_params.get('supplier')
        if supplier:
            qs = qs.filter(supplier_id=supplier)
        return qs

    @action(detail=False, methods=['post'])
    def compute(self, request):
        """Compute a fresh performance snapshot for a supplier."""
        from apps.pos.services.procurement_domain_service import ProcurementDomainService
        from erp.models import Organization

        supplier_id = request.data.get('supplier_id')
        period_start = request.data.get('period_start')
        period_end = request.data.get('period_end')

        if not all([supplier_id, period_start, period_end]):
            return Response(
                {"error": "supplier_id, period_start, and period_end are required"},
                status=400
            )

        org_id = get_current_tenant_id()
        organization = Organization.objects.get(id=org_id)

        snapshot = ProcurementDomainService.compute_supplier_score(
            organization=organization,
            supplier_id=supplier_id,
            period_start=period_start,
            period_end=period_end,
        )

        if not snapshot:
            return Response({"error": "No purchase orders found for this supplier/period"}, status=404)

        return Response(SupplierPerformanceSnapshotSerializer(snapshot).data)

    @action(detail=False, methods=['get'], url_path='latest')
    def latest(self, request):
        """Get the latest performance snapshot for each supplier."""
        org_id = get_current_tenant_id()
        from django.db.models import Max, Subquery, OuterRef

        latest_ids = SupplierPerformanceSnapshot.objects.filter(
            organization_id=org_id
        ).values('supplier_id').annotate(
            latest_id=Max('id')
        ).values('latest_id')

        snapshots = SupplierPerformanceSnapshot.objects.filter(
            id__in=Subquery(latest_ids) if hasattr(latest_ids, 'query') else latest_ids
        ).select_related('supplier')

        return Response(SupplierPerformanceSnapshotSerializer(snapshots, many=True).data)
