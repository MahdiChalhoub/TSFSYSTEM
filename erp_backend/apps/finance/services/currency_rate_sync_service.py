"""
External-rate sync for `CurrencyRatePolicy`.

Drives a freshly-fetched provider rate through the policy's `multiplier` and
`markup_pct`, then writes/updates an `ExchangeRate` row for today.

Providers:
  - ECB                — free public daily feed, EUR-based; cross-rate via EUR.
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
    """
    table = _fetch_ecb_eur_to_x()
    if from_code not in table:
        raise RateProviderError(f'ECB has no rate for {from_code}')
    if to_code not in table:
        raise RateProviderError(f'ECB has no rate for {to_code}')
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
            if policy.provider == 'ECB':
                raw_rate = _ecb_pair_rate(policy.from_currency.code, policy.to_currency.code)
            elif policy.provider in ('FIXER', 'OPENEXCHANGERATES'):
                # Stub for now — needs api_key in provider_config and an HTTP
                # client. Fail loudly so the caller knows it's not wired yet
                # rather than silently writing zero.
                raise RateProviderError(
                    f"{policy.provider} provider is not yet implemented. "
                    f"Use ECB (free) or MANUAL for now."
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

    @staticmethod
    def sync_org(organization, *, only_auto: bool = True, on_date: Optional[_date] = None):
        """
        Sync all eligible policies for one organization.

        only_auto=True (default): only policies with auto_sync=True.
        only_auto=False: every active policy regardless (manual UI "Sync All").

        Returns a list of {policy_id, ok, message} for reporting.
        """
        from apps.finance.models.currency_models import CurrencyRatePolicy

        qs = CurrencyRatePolicy.objects.filter(
            organization=organization, is_active=True,
        ).exclude(provider='MANUAL').select_related('from_currency', 'to_currency')
        if only_auto:
            qs = qs.filter(auto_sync=True)

        results = []
        for policy in qs:
            ok, msg = CurrencyRateSyncService.sync_pair(policy, on_date=on_date)
            results.append({'policy_id': policy.id, 'ok': ok, 'message': msg})
        return results
