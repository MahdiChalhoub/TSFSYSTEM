"""
REST endpoints for the multi-currency stack.

Three resources:
  - Currency           — per-org list, exactly one is_base
  - ExchangeRate       — rate history, filterable by currency / type / date
  - CurrencyRevaluation — read-only audit + a `run` action that calls
                          RevaluationService.run_revaluation for a period
"""
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.middleware import get_current_tenant_id
from erp.models import Organization

from apps.finance.models.currency_models import (
    Currency, ExchangeRate, CurrencyRevaluation, CurrencyRevaluationLine,
)
from apps.finance.views.base import TenantModelViewSet


# ── Serializers ──────────────────────────────────────────────────────────

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'symbol', 'decimal_places',
                  'is_base', 'is_active']
        read_only_fields = ['id']


class ExchangeRateSerializer(serializers.ModelSerializer):
    from_code = serializers.CharField(source='from_currency.code', read_only=True)
    to_code = serializers.CharField(source='to_currency.code', read_only=True)

    class Meta:
        model = ExchangeRate
        fields = ['id', 'from_currency', 'from_code', 'to_currency', 'to_code',
                  'rate', 'rate_type', 'effective_date', 'source']
        read_only_fields = ['id', 'from_code', 'to_code']


class CurrencyRevaluationLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    currency_code = serializers.CharField(source='currency.code', read_only=True)

    class Meta:
        model = CurrencyRevaluationLine
        fields = ['id', 'account', 'account_code', 'account_name',
                  'currency', 'currency_code',
                  'balance_in_currency', 'old_rate', 'new_rate',
                  'old_base_amount', 'new_base_amount', 'difference']


class CurrencyRevaluationSerializer(serializers.ModelSerializer):
    period_name = serializers.CharField(source='fiscal_period.name', read_only=True)
    fiscal_year_name = serializers.CharField(source='fiscal_period.fiscal_year.name', read_only=True)
    lines = CurrencyRevaluationLineSerializer(many=True, read_only=True)
    je_reference = serializers.CharField(source='journal_entry.reference', read_only=True)

    class Meta:
        model = CurrencyRevaluation
        fields = ['id', 'fiscal_period', 'period_name', 'fiscal_year_name',
                  'revaluation_date', 'status', 'scope',
                  'total_gain', 'total_loss', 'net_impact', 'accounts_processed',
                  'journal_entry', 'je_reference',
                  'created_at', 'lines']


# ── ViewSets ─────────────────────────────────────────────────────────────

class CurrencyViewSet(TenantModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return Currency.objects.filter(organization_id=org_id).order_by('-is_base', 'code')

    def perform_create(self, serializer):
        org_id = get_current_tenant_id()
        # Enforce exactly-one-base invariant: if this row is_base=True, demote others.
        if serializer.validated_data.get('is_base'):
            Currency.objects.filter(organization_id=org_id, is_base=True).update(is_base=False)
        serializer.save(organization_id=org_id)

    def perform_update(self, serializer):
        if serializer.validated_data.get('is_base'):
            org_id = get_current_tenant_id()
            Currency.objects.filter(organization_id=org_id, is_base=True).exclude(
                pk=serializer.instance.pk
            ).update(is_base=False)
        serializer.save()


class ExchangeRateViewSet(TenantModelViewSet):
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        qs = ExchangeRate.objects.filter(organization_id=org_id)
        # Optional filters
        from_code = self.request.query_params.get('from_code')
        if from_code:
            qs = qs.filter(from_currency__code=from_code)
        rate_type = self.request.query_params.get('rate_type')
        if rate_type:
            qs = qs.filter(rate_type=rate_type)
        return qs.select_related('from_currency', 'to_currency').order_by('-effective_date', 'from_currency__code')

    def perform_create(self, serializer):
        serializer.save(organization_id=get_current_tenant_id())


class CurrencyRevaluationViewSet(TenantModelViewSet):
    """
    Read-only over CRUD; trigger a new revaluation via the `run` action.
    """
    queryset = CurrencyRevaluation.objects.all()
    serializer_class = CurrencyRevaluationSerializer
    http_method_names = ['get', 'head', 'options', 'post']  # block PUT/PATCH/DELETE

    def get_queryset(self):
        org_id = get_current_tenant_id()
        qs = CurrencyRevaluation.objects.filter(organization_id=org_id)
        period_id = self.request.query_params.get('fiscal_period')
        if period_id:
            qs = qs.filter(fiscal_period_id=period_id)
        return qs.select_related('fiscal_period', 'fiscal_period__fiscal_year', 'journal_entry')\
                 .prefetch_related('lines', 'lines__account', 'lines__currency')\
                 .order_by('-revaluation_date')

    def create(self, request, *args, **kwargs):
        # Disable raw create — caller must use `run` action with a fiscal_period.
        return Response(
            {'detail': 'Use POST /run/ with fiscal_period to trigger a revaluation.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=['post'])
    def run(self, request):
        """
        Body: { fiscal_period: <id>, scope?: 'OFFICIAL'|'INTERNAL' }
        Returns the created CurrencyRevaluation row (or null if no foreign
        balances were found to revalue).
        """
        from apps.finance.models.fiscal_models import FiscalPeriod
        from apps.finance.services import RevaluationService

        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'tenant context missing'}, status=400)
        organization = Organization.objects.get(id=org_id)

        period_id = request.data.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period is required'}, status=400)
        try:
            period = FiscalPeriod.objects.get(id=period_id, organization_id=org_id)
        except FiscalPeriod.DoesNotExist:
            return Response({'error': 'fiscal period not found'}, status=404)

        scope = request.data.get('scope', 'OFFICIAL')
        user = request.user if request.user.is_authenticated else None

        try:
            reval = RevaluationService.run_revaluation(
                organization=organization, fiscal_period=period,
                user=user, scope=scope,
            )
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, 'message') else (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'error': msg}, status=400)

        if reval is None:
            return Response({
                'detail': 'No foreign-currency activity found to revalue.',
                'revaluation': None,
            }, status=200)

        return Response(self.get_serializer(reval).data, status=201)
