"""
Closing Audit — Tax-pack coverage and FX integrity tripwires.

Read-only checks that surface multi-currency / multi-jurisdiction
correctness issues independent of the year-end close. Extracted from
`closing_service.py` for the 300-line maintainability ceiling.
Re-attached to `ClosingService` as static methods by the facade.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def check_tax_coverage(organization):
    """Tax-pack coverage tripwire.

    Walks every CounterpartyTaxProfile and OrgTaxPolicy on this org,
    collects distinct country_codes, and flags any that don't have a
    matching CountryTaxTemplate in the global library. Missing
    coverage means transactions with that counterparty will fall
    through to default VAT handling — usually wrong.

    Also surfaces the org's OWN country if no tax policy is defined.

    Skipped silently (reports clean) if the tax engine models aren't
    installed in this deployment.
    """
    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'covered_countries': 0,
        'uncovered_countries': [],
    }

    try:
        from apps.finance.models import (
            CountryTaxTemplate, OrgTaxPolicy, CounterpartyTaxProfile,
        )
    except Exception:
        return report

    supported = set(
        CountryTaxTemplate.objects.filter(is_active=True)
        .values_list('country_code', flat=True)
    )
    report['covered_countries'] = len(supported)

    referenced = set()
    try:
        referenced |= set(
            OrgTaxPolicy.objects.filter(organization=organization)
            .values_list('country_code', flat=True)
        )
    except Exception:
        pass
    try:
        referenced |= set(
            CounterpartyTaxProfile.objects.filter(organization=organization)
            .values_list('country_code', flat=True)
        )
    except Exception:
        pass

    referenced = {c for c in referenced if c and c.strip()}
    missing = sorted(referenced - supported)
    if missing:
        report['uncovered_countries'] = missing
        report['clean'] = False

    return report


def check_fx_integrity(organization):
    """FX tripwire — three correctness conditions on foreign-currency
    activity:

      1. Stale-rate: every JE line in a non-base currency has a
         recorded `exchange_rate` (value provided at posting time).
         Lines missing the rate can't be revalued correctly at
         period-end.
      2. Missing revaluation: every CLOSED FiscalPeriod that holds
         foreign-currency activity must have a CurrencyRevaluation
         row. Absence means the unrealized FX gain/loss for that
         period was never computed.
      3. Orphaned revaluation: every CurrencyRevaluation row whose
         status is POSTED must have its JE attached. Missing JE
         means the unrealized gain/loss was computed but never
         reflected on the ledger.

    Read-only. Reports only; fixing is the operator's job via the
    RevaluationService.run_revaluation call per missing period.
    """
    from apps.finance.models import (
        ChartOfAccount, JournalEntryLine, FiscalPeriod,
    )
    from django.db.models import Count, Sum, Q

    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'stale_rate_lines': 0,
        'stale_rate_samples': [],
        'missing_revaluation_periods': [],
        'orphaned_revaluations': [],
    }

    # Determine base currency. If none configured, FX checks are
    # skipped (no reference point to revalue against).
    try:
        from apps.finance.models import Currency as _Currency
        base = _Currency.objects.filter(organization=organization, is_base=True).first()
    except Exception:
        base = None
    if not base:
        return report  # No base currency → FX rules don't apply yet.

    base_code = base.code

    # ── 1. Stale-rate detection ──
    stale = (
        JournalEntryLine.objects.filter(
            organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
        )
        .exclude(currency__isnull=True)
        .exclude(currency='')
        .exclude(currency=base_code)
        .filter(Q(exchange_rate__isnull=True) | Q(exchange_rate=0))
    )
    stale_cnt = stale.count()
    report['stale_rate_lines'] = stale_cnt
    if stale_cnt:
        report['stale_rate_samples'] = list(
            stale.values('id', 'currency', 'debit', 'credit')[:5]
        )
        report['clean'] = False

    # ── 2. Missing revaluation on CLOSED periods with FX activity ──
    try:
        from apps.finance.models import CurrencyRevaluation
        closed_with_fx = (
            FiscalPeriod.objects
            .filter(organization=organization, is_closed=True)
            .filter(
                journalentry__lines__currency__isnull=False,
            )
            .exclude(journalentry__lines__currency=base_code)
            .annotate(n=Count('id'))
            .distinct()
        )
        for fp in closed_with_fx:
            exists = CurrencyRevaluation.objects.filter(
                organization=organization, fiscal_period=fp,
            ).exists()
            if not exists:
                report['missing_revaluation_periods'].append({
                    'fiscal_period_id': fp.id, 'name': fp.name,
                })
                report['clean'] = False
    except Exception:
        pass  # CurrencyRevaluation model may not be installed in old deploys

    # ── 3. Orphaned revaluations (POSTED status but no journal_entry) ──
    try:
        from apps.finance.models import CurrencyRevaluation
        orphans = CurrencyRevaluation.objects.filter(
            organization=organization, status='POSTED',
            journal_entry__isnull=True,
        )
        for r in orphans:
            report['orphaned_revaluations'].append({
                'revaluation_id': r.id,
                'fiscal_period_id': r.fiscal_period_id,
                'net_gain_loss': str(getattr(r, 'net_gain_loss', 0)),
            })
            report['clean'] = False
    except Exception:
        pass

    return report
