"""
REST endpoints for the multi-currency stack.

Three resources:
  - Currency           — per-org list, exactly one is_base
  - ExchangeRate       — rate history, filterable by currency / type / date
  - CurrencyRevaluation — read-only audit + a `run` action that calls
                          RevaluationService.run_revaluation for a period
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
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
                  'rate', 'rate_type', 'rate_side', 'effective_date', 'source']
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
                  'old_base_amount', 'new_base_amount', 'difference',
                  'rate_type_used', 'classification']


class CurrencyRatePolicySerializer(serializers.ModelSerializer):
    from_code = serializers.CharField(source='from_currency.code', read_only=True)
    to_code = serializers.CharField(source='to_currency.code', read_only=True)

    class Meta:
        model = CurrencyRatePolicy
        fields = [
            'id', 'from_currency', 'from_code', 'to_currency', 'to_code',
            'rate_type', 'provider', 'provider_config',
            'auto_sync', 'sync_frequency',
            'multiplier', 'markup_pct',
            'bid_spread_pct', 'ask_spread_pct',
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

    approver_name = serializers.SerializerMethodField()
    reversal_je_reference = serializers.CharField(
        source='reversal_journal_entry.reference', read_only=True, default=None,
    )

    class Meta:
        model = CurrencyRevaluation
        fields = ['id', 'fiscal_period', 'period_name', 'fiscal_year_name',
                  'revaluation_date', 'status', 'scope',
                  'total_gain', 'total_loss', 'net_impact', 'accounts_processed',
                  'materiality_pct', 'excluded_account_ids',
                  'auto_reverse_at_period_start',
                  'reversal_journal_entry', 'reversal_je_reference',
                  'approved_by', 'approver_name', 'approved_at',
                  'rejection_reason',
                  'journal_entry', 'je_reference',
                  'created_at', 'lines']

    def get_approver_name(self, obj):
        u = obj.approved_by
        if not u: return None
        return getattr(u, 'username', None) or getattr(u, 'email', None) or str(u.id)


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
                # IMPORTANT: errors used to be swallowed silently here, which
                # produced empty FX dropdowns with zero diagnostic. Now we log
                # at warning level so the issue surfaces in the backend logs
                # while still allowing other rows to mirror successfully.
                import logging
                _logger = logging.getLogger(__name__)
                for oc in OrgCurrency.objects.filter(
                    organization=org,
                ).select_related('currency'):
                    try:
                        _mirror_org_currency_to_finance(oc)
                    except Exception as e:
                        _logger.warning(
                            "[CurrencyViewSet.list] mirror failed for OrgCurrency#%s "
                            "(code=%s, org=%s): %s",
                            oc.id, getattr(oc.currency, 'code', '?'), org_id, e,
                        )
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

    # ────────────────────────────────────────────────────────────────────
    # Helpers shared by run / preview / catchup
    # ────────────────────────────────────────────────────────────────────
    def _get_org(self):
        org_id = get_current_tenant_id()
        if not org_id:
            return None, Response({'error': 'tenant context missing'}, status=400)
        return Organization.objects.get(id=org_id), None

    def _get_period(self, org_id, period_id):
        from apps.finance.models.fiscal_models import FiscalPeriod
        try:
            return FiscalPeriod.objects.get(id=period_id, organization_id=org_id), None
        except FiscalPeriod.DoesNotExist:
            return None, Response({'error': 'fiscal period not found'}, status=404)

    def _decimalize(self, obj):
        """Recursively convert Decimals to strings so DRF can serialize."""
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, dict):
            return {k: self._decimalize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._decimalize(v) for v in obj]
        return obj

    @action(detail=False, methods=['post'])
    def preview(self, request):
        """
        Compute a revaluation WITHOUT writing anything. Returns the line-by-line
        breakdown the UI uses to populate the preview drawer.

        Body: {
            fiscal_period: <id>,
            scope?: 'OFFICIAL'|'INTERNAL',
            excluded_account_ids?: [int],
        }
        """
        from apps.finance.services import RevaluationService

        org, err = self._get_org()
        if err: return err
        period_id = request.data.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period is required'}, status=400)
        period, err = self._get_period(org.id, period_id)
        if err: return err

        scope = request.data.get('scope', 'OFFICIAL')
        excluded = request.data.get('excluded_account_ids') or []
        try:
            preview = RevaluationService.preview(
                organization=org, fiscal_period=period, scope=scope,
                excluded_account_ids=excluded,
            )
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, 'message') else (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'error': msg}, status=400)
        return Response(self._decimalize(preview), status=200)

    @action(detail=False, methods=['post'])
    def run(self, request):
        """
        Body: {
            fiscal_period: <id>,
            scope?: 'OFFICIAL'|'INTERNAL',
            excluded_account_ids?: [int],
            auto_reverse?: bool,
            force_post?: bool,   # bypass materiality approval gate
        }
        Returns the created CurrencyRevaluation row (or null if no foreign
        balances were found to revalue). Status will be PENDING_APPROVAL
        if the materiality threshold was tripped.
        """
        from apps.finance.services import RevaluationService

        org, err = self._get_org()
        if err: return err
        period_id = request.data.get('fiscal_period')
        if not period_id:
            return Response({'error': 'fiscal_period is required'}, status=400)
        period, err = self._get_period(org.id, period_id)
        if err: return err

        scope = request.data.get('scope', 'OFFICIAL')
        excluded = request.data.get('excluded_account_ids') or []
        auto_reverse = bool(request.data.get('auto_reverse', True))
        force_post = bool(request.data.get('force_post', False))
        user = request.user if request.user.is_authenticated else None

        try:
            reval = RevaluationService.run_revaluation(
                organization=org, fiscal_period=period, user=user, scope=scope,
                excluded_account_ids=excluded, auto_reverse=auto_reverse,
                force_post=force_post,
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

    def _user_can_approve(self, user):
        """Approval requires explicit permission OR superuser. Materiality is the
        gate; the user is the lock. Anyone with FX-page access can submit a run
        — only authorized reviewers can approve/reject."""
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if hasattr(user, 'role') and user.role:
            return user.role.permissions.filter(code='finance.revaluation.approve').exists()
        return False

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Post the JE for a PENDING_APPROVAL revaluation. Requires
        `finance.revaluation.approve` permission (or superuser)."""
        from apps.finance.services import RevaluationService
        if not self._user_can_approve(request.user):
            return Response(
                {'error': 'You do not have permission to approve revaluations. '
                          'Required: finance.revaluation.approve'},
                status=status.HTTP_403_FORBIDDEN,
            )
        reval = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            RevaluationService.approve(reval, user=user)
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, 'message') else (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'error': msg}, status=400)
        return Response(self.get_serializer(reval).data, status=200)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a PENDING_APPROVAL revaluation. Body: { reason?: str }.
        Same approval permission required as approve()."""
        from apps.finance.services import RevaluationService
        if not self._user_can_approve(request.user):
            return Response(
                {'error': 'You do not have permission to reject revaluations. '
                          'Required: finance.revaluation.approve'},
                status=status.HTTP_403_FORBIDDEN,
            )
        reval = self.get_object()
        user = request.user if request.user.is_authenticated else None
        reason = (request.data.get('reason') or '')[:1000]
        try:
            RevaluationService.reject(reval, user=user, reason=reason)
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, 'message') else (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'error': msg}, status=400)
        return Response(self.get_serializer(reval).data, status=200)

    @action(detail=True, methods=['post'], url_path='reverse-at-next-period')
    def reverse_at_next_period(self, request, pk=None):
        """
        Auto-post a reversing JE on day 1 of the next fiscal period.
        Idempotent — returns the existing reversal if already done.
        """
        from apps.finance.services import RevaluationService
        reval = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            je = RevaluationService.reverse_at_period_start(reval, user=user)
        except DjangoValidationError as e:
            msg = e.message if hasattr(e, 'message') else (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'error': msg}, status=400)
        return Response({
            'reversal_journal_entry_id': je.id if je else None,
            'revaluation': self.get_serializer(reval).data,
        }, status=200)

    @action(detail=False, methods=['post'])
    def catchup(self, request):
        """
        Run revaluations for every unrevalued fiscal period through a target.

        Body: {
            through_period: <id>,
            scope?: 'OFFICIAL'|'INTERNAL',
            auto_reverse?: bool,
            force_post?: bool,
        }
        """
        from apps.finance.services import RevaluationService
        org, err = self._get_org()
        if err: return err
        period_id = request.data.get('through_period')
        if not period_id:
            return Response({'error': 'through_period is required'}, status=400)
        period, err = self._get_period(org.id, period_id)
        if err: return err
        scope = request.data.get('scope', 'OFFICIAL')
        auto_reverse = bool(request.data.get('auto_reverse', True))
        force_post = bool(request.data.get('force_post', False))
        user = request.user if request.user.is_authenticated else None

        results = RevaluationService.run_multi_period_catchup(
            organization=org, through_period=period, user=user, scope=scope,
            force_post=force_post, auto_reverse=auto_reverse,
        )
        return Response({'results': results}, status=200)

    @action(detail=False, methods=['get'])
    def exposure(self, request):
        """
        FX exposure snapshot.
        Query params:
            as_of: ISO date (default = today)
            scope: OFFICIAL | INTERNAL (default OFFICIAL)
        """
        from datetime import date as date_cls
        from apps.finance.services import RevaluationService

        org, err = self._get_org()
        if err: return err
        as_of_str = request.query_params.get('as_of')
        try:
            as_of = date_cls.fromisoformat(as_of_str) if as_of_str else timezone.now().date()
        except ValueError:
            return Response({'error': 'invalid as_of date'}, status=400)
        scope = request.query_params.get('scope', 'OFFICIAL')
        report = RevaluationService.compute_exposure_report(
            organization=org, as_of_date=as_of, scope=scope,
        )
        return Response(self._decimalize(report), status=200)


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
        # respect_frequency=False so the operator can force-refresh even if
        # a WEEKLY/MONTHLY policy was synced recently — the cron job is
        # what honours the cadence, manual buttons override it.
        results = CurrencyRateSyncService.sync_org(
            org, only_auto=False, respect_frequency=False,
        )
        return Response({'results': results, 'count': len(results)}, status=200)

    @action(detail=False, methods=['post'], url_path='bulk-update-provider')
    def bulk_update_provider(self, request):
        """
        Re-assign the broker for many policies in one shot.

        Body:
            {
                "provider": "FRANKFURTER",         # required — broker code
                "provider_config": {"access_key":"…"},  # optional, merged into existing
                "scope": "all" | "include" | "exclude",
                "from_currency_codes": ["AED","SAR"]  # codes (case-insensitive)
                                                       # required when scope ∈ {include, exclude}
            }

        Scopes:
          - "all"      — every active policy in the org switches to `provider`.
          - "include"  — only policies whose from_code is in the list.
          - "exclude"  — every active policy EXCEPT those in the list.

        Returns: { "updated": [policy, …], "count": N, "skipped": [{from_code, reason}] }
        """
        org_id = get_current_tenant_id()
        if not org_id:
            return Response({'error': 'tenant context missing'}, status=400)

        provider = request.data.get('provider')
        if not provider:
            return Response({'error': 'provider is required'}, status=400)
        # Reject unimplemented providers up front instead of failing on first sync.
        IMPLEMENTED = {'MANUAL', 'ECB', 'FRANKFURTER', 'EXCHANGERATE_HOST', 'FIXER', 'OPENEXCHANGERATES'}
        if provider not in IMPLEMENTED:
            return Response({
                'error': f'Provider "{provider}" not yet implemented. '
                         f'Pick one of: {", ".join(sorted(IMPLEMENTED))}',
            }, status=400)

        scope = (request.data.get('scope') or 'all').lower()
        if scope not in ('all', 'include', 'exclude'):
            return Response({'error': 'scope must be "all" | "include" | "exclude"'}, status=400)

        codes = request.data.get('from_currency_codes') or []
        if not isinstance(codes, list):
            return Response({'error': 'from_currency_codes must be a list'}, status=400)
        codes_upper = {str(c).strip().upper() for c in codes if c}
        if scope in ('include', 'exclude') and not codes_upper:
            return Response({
                'error': f'scope="{scope}" requires a non-empty from_currency_codes list',
            }, status=400)

        # Build the queryset by scope. Always limit to active policies — the
        # operator can re-enable a deactivated policy explicitly elsewhere.
        qs = CurrencyRatePolicy.objects.filter(
            organization_id=org_id, is_active=True,
        ).select_related('from_currency', 'to_currency')
        if scope == 'include':
            qs = qs.filter(from_currency__code__in=codes_upper)
        elif scope == 'exclude':
            qs = qs.exclude(from_currency__code__in=codes_upper)

        provider_config_patch = request.data.get('provider_config') or {}
        if not isinstance(provider_config_patch, dict):
            return Response({'error': 'provider_config must be an object'}, status=400)

        # Optional: create-if-missing for codes that were picked but don't yet
        # have a policy. Only meaningful for scope='include' (otherwise we
        # don't have a clean list of intended codes to create).
        create_if_missing = bool(request.data.get('create_if_missing', False))
        rate_type_default = request.data.get('rate_type', 'SPOT')

        updated, skipped, created = [], [], []
        for policy in qs:
            # MANUAL → any other transition: clear stale sync_status so an old
            # FAIL doesn't keep showing in the UI for a freshly-rewired policy.
            policy.provider = provider
            # Merge new config keys into existing dict — don't blow it away.
            merged = dict(policy.provider_config or {})
            merged.update(provider_config_patch)
            policy.provider_config = merged
            # Reset sync metadata — a new broker means the prior result is moot.
            policy.last_sync_status = None
            policy.last_sync_error = None
            policy.save(update_fields=[
                'provider', 'provider_config', 'last_sync_status', 'last_sync_error', 'updated_at',
            ])
            updated.append(self.get_serializer(policy).data)

        # Optionally create policies for picked codes that had no policy.
        if create_if_missing and scope == 'include':
            from apps.finance.models.currency_models import Currency
            existing_from_codes = {row['from_code'] for row in updated}
            base = Currency.objects.filter(
                organization_id=org_id, is_base=True, is_active=True,
            ).first()
            if base:
                missing_codes = codes_upper - existing_from_codes
                # Currencies in finance.Currency that match the missing codes,
                # excluding base. Skip codes that don't exist yet (mirror lag).
                from_qs = Currency.objects.filter(
                    organization_id=org_id, code__in=missing_codes, is_active=True,
                ).exclude(id=base.id)
                for ccy in from_qs:
                    new_policy = CurrencyRatePolicy.objects.create(
                        organization_id=org_id,
                        from_currency=ccy, to_currency=base,
                        rate_type=rate_type_default, provider=provider,
                        provider_config=dict(provider_config_patch),
                        # Sensible defaults for new policies — operator can edit.
                        auto_sync=(provider != 'MANUAL'),
                        is_active=True,
                    )
                    created.append(self.get_serializer(new_policy).data)
                # Codes the user picked but that don't have a finance.Currency row
                still_missing = missing_codes - {p['from_code'] for p in created}
                for code in sorted(still_missing):
                    skipped.append({
                        'from_code': code,
                        'reason': 'not enabled in /settings/regional Currencies tab',
                    })

        return Response({
            'updated': updated,
            'created': created,
            'skipped': skipped,
            'count': len(updated) + len(created),
        }, status=200)

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
        from apps.reference.models import OrgCurrency
        from apps.finance.signals import _mirror_org_currency_to_finance
        import logging
        _logger = logging.getLogger(__name__)
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

        # Self-heal: if the operator's finance.Currency table is empty (mirror
        # signal lagged / failed silently in the past), force-mirror from the
        # OrgCurrency source-of-truth before checking for a base. This makes
        # the bulk-create button work on first click instead of failing with
        # "No base currency configured" while the user's Currencies tab
        # clearly shows a base.
        if not Currency.objects.filter(organization_id=org_id, is_active=True).exists():
            for oc in OrgCurrency.objects.filter(
                organization_id=org_id,
            ).select_related('currency'):
                try:
                    _mirror_org_currency_to_finance(oc)
                except Exception as e:
                    _logger.warning(
                        "[bulk_create.self-heal] mirror failed for OrgCurrency#%s: %s",
                        oc.id, e,
                    )

        base = Currency.objects.filter(organization_id=org_id, is_base=True, is_active=True).first()
        if not base:
            # Surface a precise error mentioning the OrgCurrency state so the
            # operator knows whether they need to set a base in the Currencies
            # tab or whether the mirror is broken.
            org_ccys = list(OrgCurrency.objects.filter(
                organization_id=org_id,
            ).select_related('currency').values_list('currency__code', 'is_default'))
            if not org_ccys:
                return Response({'error': 'No currencies enabled in /settings/regional yet.'}, status=400)
            has_default = any(d for _, d in org_ccys)
            if not has_default:
                return Response({
                    'error': 'No base currency set. Mark one as the default in the Currencies tab (⭐).',
                }, status=400)
            return Response({
                'error': 'Currency mirror is out of sync. Reload /settings/regional, then retry.',
            }, status=409)

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
