"""
REST endpoints for the multi-currency stack.

Three resources:
  - Currency           — per-org list, exactly one is_base
  - ExchangeRate       — rate history, filterable by currency / type / date
  - CurrencyRevaluation — read-only audit + a `run` action that calls
                          RevaluationService.run_revaluation for a period
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from erp.middleware import get_current_tenant_id
from erp.models import Organization

from apps.finance.models.currency_models import (
    Currency, ExchangeRate, CurrencyRevaluation, CurrencyRevaluationLine,
    CurrencyRatePolicy,
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


class CurrencyRatePolicySerializer(serializers.ModelSerializer):
    from_code = serializers.CharField(source='from_currency.code', read_only=True)
    to_code = serializers.CharField(source='to_currency.code', read_only=True)

    class Meta:
        model = CurrencyRatePolicy
        fields = [
            'id', 'from_currency', 'from_code', 'to_currency', 'to_code',
            'rate_type', 'provider', 'provider_config',
            'auto_sync', 'multiplier', 'markup_pct',
            'last_synced_at', 'last_sync_status', 'last_sync_error',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'from_code', 'to_code',
            'last_synced_at', 'last_sync_status', 'last_sync_error',
            'created_at', 'updated_at',
        ]


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

    def list(self, request, *args, **kwargs):
        # Auto-materialize the per-org `apps.finance.Currency` row from
        # `Organization.base_currency` (set in /settings/regional) on first
        # read. Without this, tenants who configured their base via the
        # global FK see "No base currency" until they manually re-add it
        # here — which would be a duplicate source of truth. Reading from
        # /settings/regional is the canonical input, this view just mirrors.
        from apps.finance.services import CurrencyService
        org_id = get_current_tenant_id()
        if org_id:
            try:
                from erp.models import Organization
                org = Organization.objects.get(id=org_id)
                CurrencyService.get_base_currency(org)
            except Organization.DoesNotExist:
                pass
        return super().list(request, *args, **kwargs)

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


class CurrencyRatePolicyViewSet(TenantModelViewSet):
    """
    CRUD over rate-sync policies + a `sync_now` per-row action and a
    `sync_all` collection action.
    """
    queryset = CurrencyRatePolicy.objects.all()
    serializer_class = CurrencyRatePolicySerializer

    def get_queryset(self):
        org_id = get_current_tenant_id()
        return CurrencyRatePolicy.objects.filter(organization_id=org_id)\
            .select_related('from_currency', 'to_currency')\
            .order_by('from_currency__code')

    def perform_create(self, serializer):
        serializer.save(organization_id=get_current_tenant_id())

    @action(detail=True, methods=['post'], url_path='sync-now')
    def sync_now(self, request, pk=None):
        from apps.finance.services import CurrencyRateSyncService
        policy = self.get_object()
        ok, msg = CurrencyRateSyncService.sync_pair(policy)
        policy.refresh_from_db()
        return Response({
            'ok': ok,
            'message': msg,
            'policy': self.get_serializer(policy).data,
        }, status=200 if ok else 400)

    @action(detail=False, methods=['post'], url_path='sync-all')
    def sync_all(self, request):
        from erp.models import Organization
        from apps.finance.services import CurrencyRateSyncService
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'tenant context missing'}, status=400)
        org = Organization.objects.get(id=org_id)
        # only_auto=False so the operator's "Sync All" button hits every
        # active non-MANUAL policy, regardless of the auto_sync flag.
        results = CurrencyRateSyncService.sync_org(org, only_auto=False)
        return Response({'results': results, 'count': len(results)}, status=200)
