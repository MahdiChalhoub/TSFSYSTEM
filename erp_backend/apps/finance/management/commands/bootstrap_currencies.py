"""
Bootstrap multi-currency state for an organization.

For each org, this idempotent command:

  1. Materializes the base Currency row from `Organization.base_currency`
     (the global FK on Organization). If the org has no base set, defaults
     to MAD. Without a base Currency row, the FX guards stay silent and
     the revaluation engine skips revaluation — so this is the on-ramp.

  2. Adds USD and EUR as additional Currency rows (idempotent).

  3. Seeds a recent SPOT rate for USD→base and EUR→base if no rate is on
     file. Uses placeholder rates: USD→MAD = 9.85, EUR→MAD = 10.95. Edit
     them later via the Finance settings UI; the goal here is just to
     unblock posting.

Usage:
    python manage.py bootstrap_currencies
    python manage.py bootstrap_currencies --org-id <uuid>
    python manage.py bootstrap_currencies --base MAD --usd-rate 9.95 --eur-rate 11.10
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction


# MAD-based placeholders — used when base currency is MAD. For other
# bases we don't ship guesses; pass --usd-rate / --eur-rate explicitly.
# Better to error with "no rate on file" than book at a fake rate.
PLACEHOLDERS_BY_BASE = {
    'MAD': {
        'USD': Decimal('9.85'),   # 1 USD ≈ 9.85 MAD
        'EUR': Decimal('10.95'),  # 1 EUR ≈ 10.95 MAD
    },
    'USD': {
        'EUR': Decimal('1.10'),   # 1 EUR ≈ 1.10 USD
    },
    'EUR': {
        'USD': Decimal('0.91'),   # 1 USD ≈ 0.91 EUR
    },
}

CURRENCY_DEFAULTS = {
    'MAD': {'name': 'Moroccan Dirham', 'symbol': 'DH', 'decimal_places': 2},
    'USD': {'name': 'US Dollar', 'symbol': '$', 'decimal_places': 2},
    'EUR': {'name': 'Euro', 'symbol': '€', 'decimal_places': 2},
    'GBP': {'name': 'British Pound', 'symbol': '£', 'decimal_places': 2},
    'XOF': {'name': 'CFA Franc BCEAO', 'symbol': 'CFA', 'decimal_places': 0},
}


class Command(BaseCommand):
    help = 'Bootstrap base currency + USD/EUR + sample rates for each organization.'

    def add_arguments(self, parser):
        parser.add_argument('--org-id', type=str, default=None,
                            help='Restrict to one organization (UUID). Default: all orgs.')
        parser.add_argument('--base', type=str, default=None,
                            help='Force base currency code (default: org.base_currency.code, fallback MAD).')
        parser.add_argument('--usd-rate', type=str, default=None,
                            help='Override USD→base placeholder rate.')
        parser.add_argument('--eur-rate', type=str, default=None,
                            help='Override EUR→base placeholder rate.')

    def handle(self, *args, **opts):
        from erp.models import Organization
        from apps.finance.models.currency_models import Currency, ExchangeRate

        org_qs = Organization.objects.all()
        if opts['org_id']:
            org_qs = org_qs.filter(id=opts['org_id'])
        if not org_qs.exists():
            self.stderr.write('No organizations match the given filter.')
            return

        forced_base = opts.get('base')
        rate_overrides = {}
        if opts.get('usd_rate'):
            rate_overrides['USD'] = Decimal(opts['usd_rate'])
        if opts.get('eur_rate'):
            rate_overrides['EUR'] = Decimal(opts['eur_rate'])

        for org in org_qs:
            with transaction.atomic():
                base_code = self._resolve_base_code(org, forced_base)
                base_ccy = self._ensure_currency(org, base_code, is_base=True)
                # Reset is_base flag on any other rows that might be flagged.
                Currency.objects.filter(organization=org, is_base=True).exclude(id=base_ccy.id).update(is_base=False)

                created_currencies = []
                for code in ('USD', 'EUR'):
                    if code == base_code:
                        continue
                    ccy = self._ensure_currency(org, code, is_base=False)
                    if ccy._created:
                        created_currencies.append(code)

                created_rates = []
                today = date.today()
                base_placeholders = PLACEHOLDERS_BY_BASE.get(base_code, {})
                for code in ('USD', 'EUR'):
                    if code == base_code:
                        continue
                    rate_value = rate_overrides.get(code) or base_placeholders.get(code)
                    if rate_value is None:
                        # No placeholder for this base — skip silently. The
                        # caller can rerun with --usd-rate / --eur-rate.
                        continue
                    if ExchangeRate.objects.filter(
                        organization=org,
                        from_currency__code=code,
                        to_currency=base_ccy,
                    ).exists():
                        continue
                    from_ccy = Currency.objects.get(organization=org, code=code)
                    ExchangeRate.objects.create(
                        organization=org,
                        from_currency=from_ccy,
                        to_currency=base_ccy,
                        rate=rate_value,
                        rate_type='SPOT',
                        effective_date=today,
                        source='MANUAL',
                    )
                    created_rates.append(f'{code}→{base_code}={rate_value}')

            self.stdout.write(self.style.SUCCESS(
                f'[{org}] base={base_code} '
                f'currencies_added={created_currencies or "—"} '
                f'rates_added={created_rates or "—"}'
            ))

    # ── Helpers ──────────────────────────────────────────────────────
    def _resolve_base_code(self, org, forced):
        if forced:
            return forced.upper()
        org_base = getattr(org, 'base_currency', None)
        if org_base and getattr(org_base, 'code', None):
            return org_base.code.upper()
        return 'MAD'

    def _ensure_currency(self, org, code, *, is_base):
        from apps.finance.models.currency_models import Currency

        defaults_meta = CURRENCY_DEFAULTS.get(code, {
            'name': code, 'symbol': code, 'decimal_places': 2,
        })
        ccy, created = Currency.objects.get_or_create(
            organization=org, code=code,
            defaults={**defaults_meta, 'is_base': is_base, 'is_active': True},
        )
        ccy._created = created  # used by caller to report what changed
        if is_base and not ccy.is_base:
            ccy.is_base = True
            ccy.save(update_fields=['is_base'])
        return ccy
