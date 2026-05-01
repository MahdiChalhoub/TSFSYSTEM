"""
Tax Engine Extension Views
==========================
ViewSets for tax engine models + cross-cutting business events.
"""
from .base import (
    status, Response, action,
    TenantModelViewSet, get_current_tenant_id
)
# ── Tax-only models (stay in finance) ─────────────────────────────
from apps.finance.models.tax_engine_ext import (
    WithholdingTaxRule, BadDebtVATClaim,
    AdvancePaymentVAT, CreditNoteVATReversal,
    MarginSchemeTransaction, IntraBranchVATTransfer,
    ReverseChargeSelfAssessment, VATRateChangeHistory,
)
# ── Cross-cutting business events (moved to proper modules) ──────
# Pattern D: feed `queryset = Model.objects.all()` and `Meta.model = ...` at
# class-creation time. Connector isn't hydrated at app-load; direct imports are
# required. ImportError here is the correct fail-loud signal if the source
# module is missing — the dependent ViewSets register routes anyway.
from apps.inventory.models.gift_sample_models import GiftSampleEvent as GiftSampleVAT  # noqa: E402  (Pattern D)
from apps.inventory.models.internal_consumption_models import InternalConsumptionEvent as SelfSupplyVATEvent  # noqa: E402  (Pattern D)
from apps.pos.models.import_declaration_models import ImportDeclaration  # noqa: E402  (Pattern D)

from apps.finance.serializers.tax_engine_ext_serializers import (
    WithholdingTaxRuleSerializer, BadDebtVATClaimSerializer, ImportDeclarationSerializer,
    SelfSupplyVATEventSerializer, AdvancePaymentVATSerializer,
    CreditNoteVATReversalSerializer, GiftSampleVATSerializer,
    MarginSchemeTransactionSerializer, IntraBranchVATTransferSerializer,
    ReverseChargeSelfAssessmentSerializer, VATRateChangeHistorySerializer,
)


# ═══════════════════════════════════════════════════════════════════════
# Phase 1 ViewSets
# ═══════════════════════════════════════════════════════════════════════

class WithholdingTaxRuleViewSet(TenantModelViewSet):
    queryset = WithholdingTaxRule.objects.all()
    serializer_class = WithholdingTaxRuleSerializer

    @action(detail=False, methods=['get'], url_path='by-profile/(?P<profile_id>[^/.]+)')
    def by_profile(self, request, profile_id=None):
        """Get all withholding rules for a specific counterparty profile."""
        rules = self.get_queryset().filter(counterparty_profile_id=profile_id, status='ACTIVE')
        return Response(self.get_serializer(rules, many=True).data)


class BadDebtVATClaimViewSet(TenantModelViewSet):
    queryset = BadDebtVATClaim.objects.select_related('invoice', 'contact').all()
    serializer_class = BadDebtVATClaimSerializer

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """Dashboard stats for bad debt claims."""
        from django.db.models import Sum, Count
        qs = self.get_queryset()
        stats = {
            'total_claims': qs.count(),
            'eligible': qs.filter(status='ELIGIBLE').count(),
            'claimed': qs.filter(status='CLAIMED').count(),
            'recovered': qs.filter(status='RECOVERED').count(),
            'total_original_vat': float(qs.aggregate(s=Sum('original_vat_amount'))['s'] or 0),
            'total_recovered': float(qs.filter(status='RECOVERED').aggregate(s=Sum('recovered_amount'))['s'] or 0),
        }
        return Response(stats)

    @action(detail=True, methods=['post'], url_path='submit-claim')
    def submit_claim(self, request, pk=None):
        """Mark an eligible claim as submitted."""
        from django.utils import timezone
        claim = self.get_object()
        if claim.status != 'ELIGIBLE':
            return Response({'detail': f'Cannot submit claim in status {claim.status}'}, status=400)
        claim.status = 'CLAIMED'
        claim.claim_date = timezone.now().date()
        claim.save(update_fields=['status', 'claim_date'])
        return Response(self.get_serializer(claim).data)

    @action(detail=True, methods=['post'], url_path='mark-recovered')
    def mark_recovered(self, request, pk=None):
        """Mark a claimed item as recovered."""
        from django.utils import timezone
        claim = self.get_object()
        if claim.status not in ('CLAIMED', 'ELIGIBLE'):
            return Response({'detail': f'Cannot recover claim in status {claim.status}'}, status=400)
        claim.status = 'RECOVERED'
        claim.recovery_date = timezone.now().date()
        claim.recovered_amount = request.data.get('recovered_amount', claim.original_vat_amount)
        claim.save(update_fields=['status', 'recovery_date', 'recovered_amount'])
        return Response(self.get_serializer(claim).data)


class ImportDeclarationViewSet(TenantModelViewSet):
    queryset = ImportDeclaration.objects.select_related('purchase_order').all()
    serializer_class = ImportDeclarationSerializer

    @action(detail=True, methods=['post'], url_path='calculate')
    def calculate(self, request, pk=None):
        """Calculate customs duty and import VAT from CIF components."""
        decl = self.get_object()
        decl.customs_duty_amount = decl.cif_value * decl.customs_duty_rate
        if decl.import_vat_base == 'CIF_PLUS_DUTY':
            vat_base = decl.cif_value + decl.customs_duty_amount
        else:
            vat_base = decl.cif_value
        decl.import_vat_amount = vat_base * decl.import_vat_rate
        decl.other_charges_total = sum(c.get('amount', 0) for c in (decl.other_charges or []))
        decl.save(update_fields=[
            'customs_duty_amount', 'import_vat_amount', 'other_charges_total'
        ])
        serializer = self.get_serializer(decl)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """Dashboard stats for import declarations."""
        from django.db.models import Sum, Count
        qs = self.get_queryset()
        stats = {
            'total_declarations': qs.count(),
            'draft': qs.filter(status='DRAFT').count(),
            'cleared': qs.filter(status='CLEARED').count(),
            'total_duties': float(qs.aggregate(s=Sum('customs_duty_amount'))['s'] or 0),
            'total_import_vat': float(qs.aggregate(s=Sum('import_vat_amount'))['s'] or 0),
            'total_other': float(qs.aggregate(s=Sum('other_charges_total'))['s'] or 0),
        }
        return Response(stats)


# ═══════════════════════════════════════════════════════════════════════
# Phase 2 ViewSets
# ═══════════════════════════════════════════════════════════════════════

class SelfSupplyVATEventViewSet(TenantModelViewSet):
    queryset = SelfSupplyVATEvent.objects.all()
    serializer_class = SelfSupplyVATEventSerializer

    @action(detail=True, methods=['post'], url_path='assess')
    def assess(self, request, pk=None):
        """Calculate and assess VAT on self-supply event."""
        event = self.get_object()
        if event.status != 'PENDING':
            return Response({'detail': f'Cannot assess event in status {event.status}'}, status=400)
        event.vat_amount = event.fair_market_value * event.vat_rate
        event.status = 'ASSESSED'
        event.save(update_fields=['vat_amount', 'status'])
        return Response(self.get_serializer(event).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_events': qs.count(),
            'pending': qs.filter(status='PENDING').count(),
            'assessed': qs.filter(status='ASSESSED').count(),
            'declared': qs.filter(status='DECLARED').count(),
            'total_vat_due': float(qs.filter(status__in=['ASSESSED', 'DECLARED']).aggregate(s=Sum('vat_amount'))['s'] or 0),
        })


class AdvancePaymentVATViewSet(TenantModelViewSet):
    queryset = AdvancePaymentVAT.objects.select_related('contact', 'payment', 'invoice').all()
    serializer_class = AdvancePaymentVATSerializer

    @action(detail=True, methods=['post'], url_path='declare')
    def declare(self, request, pk=None):
        """Mark deposit VAT as declared."""
        from django.utils import timezone
        obj = self.get_object()
        if obj.status != 'PENDING':
            return Response({'detail': f'Cannot declare in status {obj.status}'}, status=400)
        obj.status = 'VAT_DECLARED'
        obj.save(update_fields=['status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=['post'], url_path='link-invoice')
    def link_invoice(self, request, pk=None):
        """Link final invoice and adjust VAT."""
        obj = self.get_object()
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'detail': 'invoice_id required'}, status=400)
        obj.invoice_id = invoice_id
        obj.status = 'INVOICED'
        obj.save(update_fields=['invoice_id', 'status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_deposits': qs.count(),
            'pending': qs.filter(status='PENDING').count(),
            'declared': qs.filter(status='VAT_DECLARED').count(),
            'invoiced': qs.filter(status='INVOICED').count(),
            'total_deposit_vat': float(qs.aggregate(s=Sum('vat_amount'))['s'] or 0),
        })


class CreditNoteVATReversalViewSet(TenantModelViewSet):
    queryset = CreditNoteVATReversal.objects.select_related('original_invoice').all()
    serializer_class = CreditNoteVATReversalSerializer

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_reversals': qs.count(),
            'output_adjustments': qs.filter(is_output_adjustment=True).count(),
            'input_adjustments': qs.filter(is_output_adjustment=False).count(),
            'total_reversed_vat': float(qs.aggregate(s=Sum('reversed_vat_amount'))['s'] or 0),
        })


class GiftSampleVATViewSet(TenantModelViewSet):
    queryset = GiftSampleVAT.objects.select_related('recipient_contact').all()
    serializer_class = GiftSampleVATSerializer

    @action(detail=True, methods=['post'], url_path='assess')
    def assess(self, request, pk=None):
        """Assess VAT on a gift/sample based on cumulative threshold."""
        obj = self.get_object()
        if obj.cumulative_value_ytd > obj.threshold and obj.threshold > 0:
            obj.vat_amount = obj.cost_value * obj.vat_rate
            obj.status = 'VAT_DUE'
        else:
            obj.vat_amount = 0
            obj.status = 'BELOW_THRESHOLD'
        obj.save(update_fields=['vat_amount', 'status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_gifts': qs.count(),
            'below_threshold': qs.filter(status='BELOW_THRESHOLD').count(),
            'vat_due': qs.filter(status='VAT_DUE').count(),
            'declared': qs.filter(status='DECLARED').count(),
            'total_vat_due': float(qs.filter(status__in=['VAT_DUE', 'DECLARED']).aggregate(s=Sum('vat_amount'))['s'] or 0),
        })


# ═══════════════════════════════════════════════════════════════════════
# Phase 3 ViewSets
# ═══════════════════════════════════════════════════════════════════════

class MarginSchemeTransactionViewSet(TenantModelViewSet):
    queryset = MarginSchemeTransaction.objects.select_related('supplier', 'buyer').all()
    serializer_class = MarginSchemeTransactionSerializer

    @action(detail=True, methods=['post'], url_path='calculate')
    def calculate_margin(self, request, pk=None):
        """Calculate margin and VAT on margin."""
        txn = self.get_object()
        if txn.status not in ('DRAFT',):
            return Response({'detail': f'Cannot calculate in status {txn.status}'}, status=400)
        txn.status = 'CALCULATED'
        txn.save(update_fields=['status'])
        return Response(self.get_serializer(txn).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum, F
        from django.db.models.functions import Greatest
        qs = self.get_queryset()
        total_margin = sum(float(max(i.sale_price_ht - i.purchase_price_ht, 0)) for i in qs)
        total_vat = sum(float(max(i.sale_price_ht - i.purchase_price_ht, 0) * i.vat_rate) for i in qs)
        return Response({
            'total_transactions': qs.count(),
            'draft': qs.filter(status='DRAFT').count(),
            'calculated': qs.filter(status='CALCULATED').count(),
            'declared': qs.filter(status='DECLARED').count(),
            'total_margin': total_margin,
            'total_vat_on_margin': total_vat,
        })


class IntraBranchVATTransferViewSet(TenantModelViewSet):
    queryset = IntraBranchVATTransfer.objects.all()
    serializer_class = IntraBranchVATTransferSerializer

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Approve VAT treatment for this transfer."""
        obj = self.get_object()
        if obj.status != 'PENDING':
            return Response({'detail': f'Cannot approve in status {obj.status}'}, status=400)
        obj.status = 'APPROVED'
        obj.save(update_fields=['status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_transfers': qs.count(),
            'pending': qs.filter(status='PENDING').count(),
            'approved': qs.filter(status='APPROVED').count(),
            'adjusted': qs.filter(status='ADJUSTED').count(),
            'no_action': qs.filter(status='NO_ACTION').count(),
            'total_adjustment': float(qs.aggregate(s=Sum('vat_adjustment'))['s'] or 0),
        })


class ReverseChargeSelfAssessmentViewSet(TenantModelViewSet):
    queryset = ReverseChargeSelfAssessment.objects.select_related('supplier').all()
    serializer_class = ReverseChargeSelfAssessmentSerializer

    @action(detail=True, methods=['post'], url_path='assess')
    def assess(self, request, pk=None):
        """Self-assess VAT: calculate output, input, and net cost."""
        obj = self.get_object()
        if obj.status != 'PENDING':
            return Response({'detail': f'Cannot assess in status {obj.status}'}, status=400)
        obj.output_vat = obj.purchase_amount_ht * obj.local_vat_rate
        obj.input_vat = obj.output_vat * obj.recovery_rate
        obj.net_vat_cost = obj.output_vat - obj.input_vat
        obj.status = 'ASSESSED'
        obj.save(update_fields=['output_vat', 'input_vat', 'net_vat_cost', 'status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        from django.db.models import Sum
        qs = self.get_queryset()
        return Response({
            'total_assessments': qs.count(),
            'pending': qs.filter(status='PENDING').count(),
            'assessed': qs.filter(status='ASSESSED').count(),
            'declared': qs.filter(status='DECLARED').count(),
            'total_output_vat': float(qs.aggregate(s=Sum('output_vat'))['s'] or 0),
            'total_input_vat': float(qs.aggregate(s=Sum('input_vat'))['s'] or 0),
            'total_net_cost': float(qs.aggregate(s=Sum('net_vat_cost'))['s'] or 0),
        })


class VATRateChangeHistoryViewSet(TenantModelViewSet):
    queryset = VATRateChangeHistory.objects.select_related('tax_group').all()
    serializer_class = VATRateChangeHistorySerializer

    @action(detail=True, methods=['post'], url_path='apply')
    def apply_change(self, request, pk=None):
        """Apply rate change to the linked TaxGroup."""
        obj = self.get_object()
        if obj.applied_to_tax_group:
            return Response({'detail': 'Already applied'}, status=400)
        # Update the TaxGroup rate
        tax_group = obj.tax_group
        tax_group.rate = obj.new_rate
        tax_group.save(update_fields=['rate'])
        obj.applied_to_tax_group = True
        obj.status = 'ACTIVE'
        obj.save(update_fields=['applied_to_tax_group', 'status'])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        qs = self.get_queryset()
        return Response({
            'total_changes': qs.count(),
            'upcoming': qs.filter(status='UPCOMING').count(),
            'active': qs.filter(status='ACTIVE').count(),
            'historical': qs.filter(status='HISTORICAL').count(),
            'unapplied': qs.filter(applied_to_tax_group=False).count(),
        })
