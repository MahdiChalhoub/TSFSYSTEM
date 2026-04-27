"""
External-rate sync for `CurrencyRatePolicy`.

Drives a freshly-fetched provider rate through the policy's `multiplier` and
`markup_pct`, then writes/updates an `ExchangeRate` row for today.

Providers:
  - ECB                — free public daily feed, EUR-based; cross-rate via EUR.
                         Plus EUR-pegged (XAF/XOF/KMF) and USD-pegged (AED/SAR/
                         QAR/BHD/OMR/JOD/HKD) extensions.
  - FRANKFURTER        — free JSON wrapper over ECB at api.frankfurter.app.
                         Same coverage as ECB but easier to consume + better
                         uptime than the ECB XML endpoint.
  - EXCHANGERATE_HOST  — free, broad coverage (170+ currencies including AED,
                         SAR, etc. without needing the peg fall-back).
  - FIXER              — placeholder; needs api_key in policy.provider_config.
  - OPENEXCHANGERATES  — placeholder; needs api_key in policy.provider_config.
  - MANUAL             — never auto-syncs (bail at the top of sync_pair).

Idempotent per (date, pair, rate_type): re-running for the same day updates
the same `ExchangeRate` row instead of stacking duplicates. The historical
chain is preserved via prior days' rows.
"""
from __future__ import annotations

import logging
from datetime import date as _date
from decimal import Decimal
from typing import Optional, Tuple
from urllib.request import urlopen
from xml.etree import ElementTree as ET

from django.utils import timezone

logger = logging.getLogger(__name__)

ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
FRANKFURTER_URL = 'https://api.frankfurter.app/latest'  # JSON wrapper over ECB
EXCHANGERATE_HOST_URL = 'https://api.exchangerate.host/live'  # free, ~170 ccys


def _fetch_frankfurter(from_code: str, to_code: str) -> Decimal:
    """Frankfurter provides direct pair quoting: ?from=USD&to=AED → {rates:{AED:3.67}}."""
    import json
    url = f'{FRANKFURTER_URL}?from={from_code}&to={to_code}'
    try:
        with urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read())
    except Exception as e:
        raise RateProviderError(f'Frankfurter fetch failed: {e}') from e
    rate = (payload.get('rates') or {}).get(to_code)
    if rate is None:
        raise RateProviderError(
            f'Frankfurter returned no rate for {from_code}→{to_code}. '
            f'Coverage matches ECB; switch provider for exotic currencies.'
        )
    return Decimal(str(rate)).quantize(Decimal('0.0000000001'))


def _fetch_exchangerate_host(from_code: str, to_code: str, access_key: str | None = None) -> Decimal:
    """exchangerate.host live endpoint: needs an API access_key on free tier
    since 2024. Returns USD-base; we cross-rate."""
    import json
    if not access_key:
        raise RateProviderError(
            'exchangerate.host requires an API access_key in provider_config '
            '(set the policy\'s provider_config.access_key).'
        )
    url = f'{EXCHANGERATE_HOST_URL}?access_key={access_key}'
    try:
        with urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read())
    except Exception as e:
        raise RateProviderError(f'exchangerate.host fetch failed: {e}') from e
    if not payload.get('success', True):
        info = (payload.get('error') or {}).get('info') or 'unknown error'
        raise RateProviderError(f'exchangerate.host: {info}')
    quotes = payload.get('quotes') or {}
    src = (payload.get('source') or 'USD').upper()
    # Quotes are like {"USDEUR": 0.92, "USDAED": 3.6725}.
    if from_code == src:
        target = quotes.get(f'{src}{to_code}')
        if target is None:
            raise RateProviderError(f'exchangerate.host has no rate for {to_code}')
        return Decimal(str(target)).quantize(Decimal('0.0000000001'))
    if to_code == src:
        target = quotes.get(f'{src}{from_code}')
        if target is None:
            raise RateProviderError(f'exchangerate.host has no rate for {from_code}')
        return (Decimal('1') / Decimal(str(target))).quantize(Decimal('0.0000000001'))
    # Cross via source.
    a = quotes.get(f'{src}{from_code}')
    b = quotes.get(f'{src}{to_code}')
    if a is None or b is None:
        raise RateProviderError(
            f'exchangerate.host missing one of {from_code}/{to_code} in {src}-base feed.'
        )
    return (Decimal(str(b)) / Decimal(str(a))).quantize(Decimal('0.0000000001'))


class RateProviderError(Exception):
    """Raised when a provider returns no usable rate."""


# ── Provider implementations ─────────────────────────────────────────────

def _fetch_ecb_eur_to_x() -> dict[str, Decimal]:
    """
    Fetch EUR-base rates from ECB. Returns {currency_code: rate} where each
    rate represents 1 EUR = `rate` units of `currency_code`.

    EUR is implicitly present as 1.0.
    """
    try:
        with urlopen(ECB_DAILY_URL, timeout=10) as resp:
            xml_data = resp.read()
    except Exception as e:
        raise RateProviderError(f'ECB fetch failed: {e}') from e

    root = ET.fromstring(xml_data)
    # XML namespace dance — ECB wraps payload in nested <Cube/> elements.
    rates: dict[str, Decimal] = {'EUR': Decimal('1')}
    for cube in root.iter():
        if cube.tag.endswith('Cube'):
            ccy = cube.attrib.get('currency')
            rate = cube.attrib.get('rate')
            if ccy and rate:
                try:
                    rates[ccy] = Decimal(rate)
                except Exception:
                    continue
    if len(rates) <= 1:
        raise RateProviderError('ECB returned no rates')
    return rates


def _ecb_pair_rate(from_code: str, to_code: str) -> Decimal:
    """
    Cross-rate via EUR using the ECB daily snapshot.
    Returns: 1 unit of `from_code` in `to_code`.

    Two layers of pegged-currency fall-back fill the gaps in ECB's feed:

    EUR-PEGGED (treaty-fixed against EUR — exact rates):
        1 EUR = 655.957   XAF  (Central African CFA, BEAC zone)
        1 EUR = 655.957   XOF  (West African CFA, BCEAO zone)
        1 EUR = 491.96775 KMF  (Comorian franc)
        1 EUR =   1.95583 BGN  (Bulgarian lev — already in ECB feed)
        1 EUR =   7.46038 DKK  (Danish krone — already in ECB feed)

    USD-PEGGED (long-running de-jure or de-facto pegs against USD —
    materialised via the EUR↔USD ECB rate so the math stays unified):
        1 USD = 3.6725   AED   (United Arab Emirates dirham, since 1997)
        1 USD = 3.75     SAR   (Saudi riyal, since 1986)
        1 USD = 3.64     QAR   (Qatari riyal, since 2001)
        1 USD = 0.376    BHD   (Bahraini dinar, since 1980)
        1 USD = 0.3845   OMR   (Omani rial, since 1986)
        1 USD = 0.709    JOD   (Jordanian dinar, since 1995)
        1 USD = 7.7      HKD   (Hong Kong dollar — band, midpoint approx)
        1 USD = 1500.0   LBP   (Lebanese pound — official peg; black-market
                                differs and operator should override via ×)
        1 USD = 18000.0  IRR   (Iranian rial — official peg, divergent)
        1 USD = 250.0    SYP   (Syrian pound — official, divergent)

    For divergent pegs (LBP/IRR/SYP) the operator is expected to use the
    multiplier × markup % knobs to express the actual operational rate.
    """
    # EUR-pegged: published as `1 EUR = peg X`.
    EUR_PEGS = {
        'XAF': Decimal('655.957'),
        'XOF': Decimal('655.957'),
        'KMF': Decimal('491.96775'),
    }
    # USD-pegged: published as `1 USD = peg X`. Materialised below through
    # the live EUR↔USD rate from ECB to keep cross-rates internally consistent.
    USD_PEGS = {
        'AED': Decimal('3.6725'),
        'SAR': Decimal('3.75'),
        'QAR': Decimal('3.64'),
        'BHD': Decimal('0.376'),
        'OMR': Decimal('0.3845'),
        'JOD': Decimal('0.709'),
        'HKD': Decimal('7.7'),
        # Divergent — operator should override via × multiplier:
        'LBP': Decimal('1500.0'),
        'IRR': Decimal('18000.0'),
        'SYP': Decimal('250.0'),
    }

    table = _fetch_ecb_eur_to_x()
    # Inject EUR-pegged codes (only if ECB didn't already publish them).
    for code, peg_rate in EUR_PEGS.items():
        if code not in table:
            table[code] = peg_rate
    # Inject USD-pegged codes via the live EUR→USD rate.
    # 1 EUR = table['USD'] USD = table['USD'] × peg(X) units of X.
    if 'USD' in table:
        usd_per_eur = table['USD']
        for code, usd_peg in USD_PEGS.items():
            if code not in table:
                table[code] = (usd_per_eur * usd_peg)

    if from_code not in table:
        raise RateProviderError(
            f'ECB has no rate for {from_code} '
            f'(use a MANUAL policy if your currency is not on ECB or pegged).'
        )
    if to_code not in table:
        raise RateProviderError(
            f'ECB has no rate for {to_code} '
            f'(use a MANUAL policy if your currency is not on ECB or pegged).'
        )
    # 1 from_code = (1 / rate_eur_to_from) EUR = (rate_eur_to_to / rate_eur_to_from) to_code
    return (table[to_code] / table[from_code]).quantize(Decimal('0.0000000001'))


# ── Service ──────────────────────────────────────────────────────────────

class CurrencyRateSyncService:
    """Fetch + adjust + persist rates per `CurrencyRatePolicy`."""

    @staticmethod
    def sync_pair(policy, *, on_date: Optional[_date] = None) -> Tuple[bool, str]:
        """
        Sync one policy. Returns (ok, message).

        Writes/updates ONE `ExchangeRate` row dated `on_date` (default today).
        Sets policy.last_synced_at, last_sync_status, last_sync_error.
        """
        from apps.finance.models.currency_models import ExchangeRate

        on_date = on_date or _date.today()

        if policy.provider == 'MANUAL':
            policy.last_synced_at = timezone.now()
            policy.last_sync_status = 'SKIPPED'
            policy.last_sync_error = 'Provider is MANUAL — no auto-sync.'
            policy.save(update_fields=['last_synced_at', 'last_sync_status', 'last_sync_error'])
            return False, 'Provider is MANUAL'

        try:
            from_code = policy.from_currency.code
            to_code = policy.to_currency.code
            cfg = policy.provider_config or {}
            if policy.provider == 'ECB':
                raw_rate = _ecb_pair_rate(from_code, to_code)
            elif policy.provider == 'FRANKFURTER':
                raw_rate = _fetch_frankfurter(from_code, to_code)
            elif policy.provider == 'EXCHANGERATE_HOST':
                raw_rate = _fetch_exchangerate_host(from_code, to_code, cfg.get('access_key'))
            elif policy.provider in ('FIXER', 'OPENEXCHANGERATES'):
                # Stub for now — needs api_key in provider_config and an HTTP
                # client. Fail loudly so the caller knows it's not wired yet
                # rather than silently writing zero.
                raise RateProviderError(
                    f"{policy.provider} provider is not yet implemented. "
                    f"Use ECB / FRANKFURTER / EXCHANGERATE_HOST or MANUAL for now."
                )
            else:
                raise RateProviderError(f'Unknown provider: {policy.provider}')
        except Exception as e:
            policy.last_synced_at = timezone.now()
            policy.last_sync_status = 'FAIL'
            policy.last_sync_error = str(e)
            policy.save(update_fields=['last_synced_at', 'last_sync_status', 'last_sync_error'])
            return False, str(e)

        adjusted = policy.adjusted_rate(raw_rate)

        # Idempotent upsert: one row per (org, from, to, date, rate_type).
        rate_row, created = ExchangeRate.objects.update_or_create(
            organization=policy.organization,
            from_currency=policy.from_currency,
            to_currency=policy.to_currency,
            effective_date=on_date,
            rate_type=policy.rate_type,
            defaults={
                'rate': adjusted,
                'source': f'AUTO:{policy.provider}',
            },
        )

        policy.last_synced_at = timezone.now()
        policy.last_sync_status = 'OK'
        policy.last_sync_error = None
        policy.save(update_fields=['last_synced_at', 'last_sync_status', 'last_sync_error'])

        action = 'created' if created else 'updated'
        msg = (f'{policy.from_currency.code}→{policy.to_currency.code} '
               f'{action}: raw={raw_rate} × {policy.multiplier} '
               f'(+{policy.markup_pct}%) = {adjusted}')
        logger.info(msg)
        return True, msg

    # Minimum elapsed-hours-since-last-sync for each frequency. The cron
    # checks this before re-fetching, so the operator's "DAILY" cron job
    # can run hourly without spamming a WEEKLY policy.
    FREQUENCY_INTERVAL_HOURS = {
        'ON_TRANSACTION': None,  # cron skips entirely; pulled on demand
        'DAILY': 20,             # < 24h to be tolerant of cron clock drift
        'WEEKLY': 24 * 7 - 4,    # ~7 days
        'MONTHLY': 24 * 30 - 4,  # ~30 days
    }

    @classmethod
    def policy_due(cls, policy) -> bool:
        """Is this policy due for a refresh given its sync_frequency?

        Returns True if the policy should be (re-)fetched by the cron run.
        ON_TRANSACTION policies are NEVER due via cron — they're driven by
        the just-in-time hook (`sync_for_transaction()`). Policies that have
        never synced are always due.
        """
        from django.utils import timezone
        freq = getattr(policy, 'sync_frequency', 'DAILY')
        interval = cls.FREQUENCY_INTERVAL_HOURS.get(freq, 20)
        if interval is None:
            return False
        if not policy.last_synced_at:
            return True
        elapsed_h = (timezone.now() - policy.last_synced_at).total_seconds() / 3600
        return elapsed_h >= interval

    @staticmethod
    def sync_org(organization, *, only_auto: bool = True, on_date: Optional[_date] = None,
                 respect_frequency: bool = True):
        """
        Sync all eligible policies for one organization.

        only_auto=True (default): only policies with auto_sync=True.
        only_auto=False: every active policy regardless (manual UI "Sync All").

        respect_frequency=True (default for cron): skip policies whose
            sync_frequency interval hasn't elapsed yet (e.g. WEEKLY synced 2
            days ago). Set False for the manual "Sync All" button so the
            operator can force-refresh.

        Returns a list of {policy_id, ok, message} for reporting.
        ON_TRANSACTION policies are skipped here regardless of flag — they
        sync only on the just-in-time hook to avoid pre-fetching unused rates.
        """
        from apps.finance.models.currency_models import CurrencyRatePolicy

        qs = CurrencyRatePolicy.objects.filter(
            organization=organization, is_active=True,
        ).exclude(provider='MANUAL').select_related('from_currency', 'to_currency')
        if only_auto:
            qs = qs.filter(auto_sync=True)
        # ON_TRANSACTION never goes through batch sync.
        qs = qs.exclude(sync_frequency='ON_TRANSACTION')

        results = []
        for policy in qs:
            if respect_frequency and not CurrencyRateSyncService.policy_due(policy):
                results.append({
                    'policy_id': policy.id,
                    'ok': True,
                    'message': f'{policy.from_currency.code}→{policy.to_currency.code} '
                               f'skipped: still fresh under {policy.sync_frequency} cadence',
                    'skipped': True,
                })
                continue
            ok, msg = CurrencyRateSyncService.sync_pair(policy, on_date=on_date)
            results.append({'policy_id': policy.id, 'ok': ok, 'message': msg})
        return results

    @classmethod
    def sync_for_transaction(cls, organization, from_code: str, to_code: str,
                             rate_type: str = 'SPOT'):
        """
        Just-in-time refresh hook for ON_TRANSACTION policies. Called by the
        ledger / journal-entry posting path right before an FX rate is read.

        - Looks up the matching policy (organization, from, to, rate_type).
        - If found and provider != MANUAL, re-syncs it (regardless of when
          it was last synced — this is the per-transaction contract).
        - Returns (ok, message). Caller can soft-fail on False and fall back
          to the most recent stored ExchangeRate.
        """
        from apps.finance.models.currency_models import CurrencyRatePolicy
        try:
            policy = CurrencyRatePolicy.objects.select_related(
                'from_currency', 'to_currency',
            ).get(
                organization=organization,
                from_currency__code=from_code,
                to_currency__code=to_code,
                rate_type=rate_type,
                is_active=True,
            )
        except CurrencyRatePolicy.DoesNotExist:
            return False, f'No active policy for {from_code}→{to_code} ({rate_type})'
        if policy.provider == 'MANUAL':
            return False, 'MANUAL policy — no provider fetch'
        return cls.sync_pair(policy)
