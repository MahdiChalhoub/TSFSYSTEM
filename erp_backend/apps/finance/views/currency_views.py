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
        # Single-source-of-truth bridge to /settings/regional Currencies tab.
        #
        # Strategy: on every read, walk OrgCurrency for this org and run the
        # same mirror logic the post_save signal uses. This means pre-signal
        # rows (existing tenants, prod data, demo seed leftovers) get caught
        # up the first time the FX page loads — without needing a backfill
        # migration or asking the operator to re-toggle currencies.
        #
        #  Pass 1: materialize / update finance.Currency from each OrgCurrency
        #          (creates new rows, sets is_active, propagates is_default→is_base).
        #  Pass 2: deactivate any orphan finance.Currency (= currency the
        #          operator removed from the regional list).
        from apps.finance.services import CurrencyService
        org_id = get_current_tenant_id()
        if org_id:
            try:
                from erp.models import Organization
                from apps.reference.models import OrgCurrency
                from apps.finance.signals import _mirror_org_currency_to_finance
                org = Organization.objects.get(id=org_id)

                # Pass 1: mirror every OrgCurrency row (handles legacy data
                # that pre-dates the signal — same code path as on_save).
                for oc in OrgCurrency.objects.filter(
                    organization=org,
                ).select_related('currency'):
                    try:
                        _mirror_org_currency_to_finance(oc)
                    except Exception:
                        # Don't fail the whole list call on one bad row.
                        continue

                # Pass 2: deactivate orphans not in the regional list.
                enabled_codes = set(OrgCurrency.objects.filter(
                    organization=org, is_enabled=True,
                ).values_list('currency__code', flat=True))
                if enabled_codes:
                    Currency.objects.filter(
                        organization=org, is_active=True,
                    ).exclude(code__in=enabled_codes).update(is_active=False)

                # Last-resort: if there's still no base, fall back to
                # Organization.base_currency FK auto-materialize.
                if not Currency.objects.filter(
                    organization=org, is_base=True, is_active=True,
                ).exists():
                    CurrencyService.get_base_currency(org)
            except Organization.DoesNotExist:
                pass
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # Only return currencies that are actively enabled. Disabled rows
        # (those whose OrgCurrency in /settings/regional was unchecked) get
        # is_active=False via the OrgCurrency→finance.Currency mirror signal
        # — we filter them out here so the FX dropdowns / rate forms only
        # see currencies the user actually enabled.
        org_id = get_current_tenant_id()
        return Currency.objects.filter(
            organization_id=org_id, is_active=True,
        ).order_by('-is_base', 'code')

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
        # Only return rates whose BOTH endpoints are still in the org's
        # currency list (is_active=True). This hides historical rate rows
        # like EUR→USD when the operator has since removed EUR or USD from
        # /settings/regional Currencies tab. The data isn't deleted — just
        # not surfaced — so audit history is preserved on the model.
        org_id = get_current_tenant_id()
        qs = ExchangeRate.objects.filter(
            organization_id=org_id,
            from_currency__is_active=True,
            to_currency__is_active=True,
        )
        from_code = self.request.query_params.get('from_code')
        if from_code:
            qs = qs.filter(from_currency__code=from_code)
        rate_type = self.request.query_params.get('rate_type')
        if rate_type:
            qs = qs.filter(rate_type=rate_type)
        # Allow `?include_inactive=1` for an admin/audit view if needed.
        if self.request.query_params.get('include_inactive') == '1':
            qs = ExchangeRate.objects.filter(organization_id=org_id)
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
        # Hide policies for currencies that have been removed from the
        # /settings/regional Currencies tab. The policy row stays in the
        # DB (sync history preserved) but doesn't surface in the UI.
        org_id = get_current_tenant_id()
        qs = CurrencyRatePolicy.objects.filter(
            organization_id=org_id,
            from_currency__is_active=True,
            to_currency__is_active=True,
        )
        if self.request.query_params.get('include_inactive') == '1':
            qs = CurrencyRatePolicy.objects.filter(organization_id=org_id)
        return qs.select_related('from_currency', 'to_currency')\
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

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """
        One-shot setup: create an ECB / SPOT / auto-sync policy for every
        active non-base currency that doesn't already have one. Existing
        policies are left untouched (idempotent).

        Optional payload:
          {
              "provider":   "ECB",        # default
              "rate_type":  "SPOT",       # default
              "auto_sync":  true,         # default
              "multiplier": "1.000000",   # default
              "markup_pct": "0.0000",     # default
              "from_currency_ids": [3, 4] # optional explicit subset; otherwise
                                          # uses every active non-base currency
          }

        Returns: { "created": [policy, …], "skipped": [{from_code, reason}, …] }
        """
        from apps.finance.models.currency_models import Currency
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'tenant context missing'}, status=400)

        provider = request.data.get('provider', 'ECB')
        if provider not in ('ECB', 'MANUAL'):
            return Response({'error': f'Provider {provider} not supported for bulk create yet'}, status=400)
        rate_type = request.data.get('rate_type', 'SPOT')
        auto_sync = bool(request.data.get('auto_sync', True))
        multiplier = str(request.data.get('multiplier', '1.000000'))
        markup_pct = str(request.data.get('markup_pct', '0.0000'))

        base = Currency.objects.filter(organization_id=org_id, is_base=True, is_active=True).first()
        if not base:
            return Response({'error': 'No base currency configured for this organization.'}, status=400)

        explicit_ids = request.data.get('from_currency_ids')
        if explicit_ids:
            from_qs = Currency.objects.filter(
                organization_id=org_id, id__in=explicit_ids, is_active=True,
            ).exclude(id=base.id)
        else:
            from_qs = Currency.objects.filter(
                organization_id=org_id, is_active=True,
            ).exclude(id=base.id)

        created, skipped = [], []
        for ccy in from_qs:
            existing = CurrencyRatePolicy.objects.filter(
                organization_id=org_id,
                from_currency=ccy, to_currency=base, rate_type=rate_type,
            ).first()
            if existing:
                skipped.append({'from_code': ccy.code, 'reason': 'policy already exists'})
                continue
            policy = CurrencyRatePolicy.objects.create(
                organization_id=org_id,
                from_currency=ccy, to_currency=base,
                rate_type=rate_type, provider=provider,
                auto_sync=auto_sync, multiplier=multiplier, markup_pct=markup_pct,
                is_active=True,
            )
            created.append(self.get_serializer(policy).data)

        return Response({
            'created': created,
            'skipped': skipped,
            'count': len(created),
        }, status=201 if created else 200)
