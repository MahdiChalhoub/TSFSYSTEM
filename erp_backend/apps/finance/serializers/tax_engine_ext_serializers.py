"""
Tax Engine Extension Serializers
================================
Serializers for tax engine models + cross-cutting business events.
"""
from rest_framework import serializers
# ── Tax-only models (stay in finance) ─────────────────────────────
from apps.finance.models.tax_engine_ext import (
    WithholdingTaxRule, BadDebtVATClaim,
    AdvancePaymentVAT, CreditNoteVATReversal,
    MarginSchemeTransaction, IntraBranchVATTransfer,
    ReverseChargeSelfAssessment, VATRateChangeHistory,
)
# ── Cross-cutting business events (moved to proper modules) ──────
# Pattern D: these classes feed `Meta.model = ...` below, which DRF resolves at
# class-creation time (i.e. at app load). The connector registry isn't hydrated
# yet, so direct imports are the only viable path. If the source module is
# uninstalled, ImportError here is the correct fail-loud signal — these
# serializers register URL routes that would 500 anyway.
from apps.inventory.models.gift_sample_models import GiftSampleEvent  # noqa: E402  (Pattern D)
from apps.inventory.models.internal_consumption_models import InternalConsumptionEvent  # noqa: E402  (Pattern D)
from apps.pos.models.import_declaration_models import ImportDeclaration  # noqa: E402  (Pattern D)
# Backward-compat aliases
GiftSampleVAT = GiftSampleEvent
SelfSupplyVATEvent = InternalConsumptionEvent


class WithholdingTaxRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WithholdingTaxRule
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class BadDebtVATClaimSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, default='')
    contact_name = serializers.CharField(source='contact.name', read_only=True, default='')
    total_landed_cost = serializers.SerializerMethodField()

    class Meta:
        model = BadDebtVATClaim
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')

    def get_total_landed_cost(self, obj):
        return None  # Not applicable for bad debt claims


class ImportDeclarationSerializer(serializers.ModelSerializer):
    cif_value = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_landed_cost = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True, default='')

    class Meta:
        model = ImportDeclaration
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


# ═══════════════════════════════════════════════════════════════════════
# Phase 2 Serializers
# ═══════════════════════════════════════════════════════════════════════

class SelfSupplyVATEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SelfSupplyVATEvent
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class AdvancePaymentVATSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True, default='')
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True, default='')

    class Meta:
        model = AdvancePaymentVAT
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class CreditNoteVATReversalSerializer(serializers.ModelSerializer):
    original_invoice_number = serializers.CharField(source='original_invoice.invoice_number', read_only=True, default='')

    class Meta:
        model = CreditNoteVATReversal
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class GiftSampleVATSerializer(serializers.ModelSerializer):
    recipient_display = serializers.SerializerMethodField()

    class Meta:
        model = GiftSampleVAT
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')

    def get_recipient_display(self, obj):
        if obj.recipient_contact:
            return str(obj.recipient_contact)
        return obj.recipient_name or 'Unknown'


# ═══════════════════════════════════════════════════════════════════════
# Phase 3 Serializers
# ═══════════════════════════════════════════════════════════════════════

class MarginSchemeTransactionSerializer(serializers.ModelSerializer):
    margin = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    vat_on_margin = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = MarginSchemeTransaction
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class IntraBranchVATTransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntraBranchVATTransfer
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class ReverseChargeSelfAssessmentSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')

    class Meta:
        model = ReverseChargeSelfAssessment
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')


class VATRateChangeHistorySerializer(serializers.ModelSerializer):
    tax_group_name = serializers.CharField(source='tax_group.name', read_only=True, default='')
    change_display = serializers.SerializerMethodField()

    class Meta:
        model = VATRateChangeHistory
        fields = '__all__'
        read_only_fields = ('organization', 'created_at', 'updated_at')

    def get_change_display(self, obj):
        old_pct = float(obj.old_rate or 0) * 100
        new_pct = float(obj.new_rate or 0) * 100
        return f"{old_pct:.1f}% → {new_pct:.1f}%"
