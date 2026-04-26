"""
Currency Service — write-path helpers for multi-currency posting.

This is the partner of `RevaluationService` (read/recompute side):
RevaluationService periodically marks foreign balances to closing rate.
CurrencyService handles the write side — converting transaction amounts
to base currency and producing line dicts with all the FX metadata that
the immutable-ledger guard in `JournalEntry._validate_line_currencies`
requires.

Use this from invoice / payment / inventory write paths whenever the
counterpart account or transaction is in a non-base currency. Don't
write FX lines by hand; the math is mechanical and getting it wrong
silently breaks the revaluation engine months later.
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple, TYPE_CHECKING

from django.core.exceptions import ValidationError

if TYPE_CHECKING:  # avoid runtime circular imports
    from datetime import date
    from apps.finance.models import ChartOfAccount
    from apps.finance.models.currency_models import Currency, ExchangeRate
    from erp.models import Organization

logger = logging.getLogger(__name__)

TWOPLACES = Decimal('0.01')


class CurrencyService:
    """Write-side helpers for multi-currency posting."""

    # ── Base currency lookup ─────────────────────────────────────────
    @staticmethod
    def get_base_currency(organization) -> Optional['Currency']:
        """
        Return the org's base Currency row (the one with is_base=True).
        Falls back to creating one from `organization.base_currency` (the
        global FK on Organization) if the per-org row is missing.
        """
        from apps.finance.models.currency_models import Currency

        c = Currency.objects.filter(organization=organization, is_base=True).first()
        if c:
            return c

        org_base = getattr(organization, 'base_currency', None)
        if not org_base or not org_base.code:
            return None

        # Auto-materialize the per-org Currency row from the global FK so
        # downstream code has a stable handle.
        c, _ = Currency.objects.get_or_create(
            organization=organization,
            code=org_base.code,
            defaults={
                'name': getattr(org_base, 'name', org_base.code),
                'symbol': getattr(org_base, 'symbol', org_base.code),
                'decimal_places': getattr(org_base, 'decimal_places', 2),
                'is_base': True,
                'is_active': True,
            },
        )
        if not c.is_base:
            c.is_base = True
            c.save(update_fields=['is_base'])
        return c

    @staticmethod
    def get_base_code(organization) -> Optional[str]:
        c = CurrencyService.get_base_currency(organization)
        return c.code if c else None

    # ── Rate resolution ──────────────────────────────────────────────
    @staticmethod
    def resolve_rate(
        organization,
        from_code: str,
        on_date: 'date',
        rate_type: str = 'SPOT',
    ) -> Tuple[Optional[Decimal], Optional['ExchangeRate']]:
        """
        Look up the latest rate `from_code → base` on or before `on_date`.

        Fallback chain:
          1. Requested rate_type on/before date
          2. SPOT on/before date
          3. (None, None)  → caller decides whether to error or skip

        If from_code == base, returns (Decimal('1'), None).
        """
        from apps.finance.models.currency_models import ExchangeRate

        base = CurrencyService.get_base_currency(organization)
        if base is None:
            return None, None
        if from_code == base.code:
            return Decimal('1'), None

        qs = ExchangeRate.objects.filter(
            organization=organization,
            from_currency__code=from_code,
            to_currency=base,
            effective_date__lte=on_date,
        )
        rate_obj = qs.filter(rate_type=rate_type).order_by('-effective_date').first()
        if not rate_obj and rate_type != 'SPOT':
            rate_obj = qs.filter(rate_type='SPOT').order_by('-effective_date').first()
        if not rate_obj:
            return None, None
        return rate_obj.rate, rate_obj

    # ── Conversion ───────────────────────────────────────────────────
    @staticmethod
    def convert_to_base(
        amount: Decimal,
        from_code: str,
        on_date: 'date',
        organization,
        rate_type: str = 'SPOT',
    ) -> Tuple[Decimal, Decimal]:
        """
        Convert `amount` of `from_code` to the org's base currency on `on_date`.

        Returns (base_amount, rate_used). Raises ValidationError if no rate is
        on file — never silently picks 1.0, that's how books drift.
        """
        rate, _ = CurrencyService.resolve_rate(organization, from_code, on_date, rate_type)
        if rate is None:
            base_code = CurrencyService.get_base_code(organization) or '<no-base>'
            raise ValidationError(
                f"No exchange rate on file for {from_code}→{base_code} on or "
                f"before {on_date}. Add an ExchangeRate row before posting."
            )
        base_amount = (Decimal(amount) * rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        return base_amount, rate

    # ── Line factory ─────────────────────────────────────────────────
    @staticmethod
    def make_foreign_line(
        *,
        account: 'ChartOfAccount',
        signed_amount_in_account_ccy: Decimal,
        on_date: 'date',
        organization,
        description: str = '',
        rate_type: str = 'SPOT',
    ) -> dict:
        """
        Build a JournalEntryLine kwargs dict for posting to a foreign-
        currency account. Computes base debit/credit from the foreign
        amount and the prevailing rate, and stamps amount_currency +
        exchange_rate so the immutable-ledger guard accepts the line.

        `signed_amount_in_account_ccy` convention:
          positive = debit (account balance goes up)
          negative = credit (account balance goes down)

        Returns a dict suitable for `JournalEntryLine.objects.create(**kwargs)`
        — caller still passes journal_entry and organization themselves.
        """
        if not account.currency:
            raise ValidationError(
                f"Account {account.code} has no currency set; use a normal "
                f"line for base-currency postings."
            )

        signed_amount_in_account_ccy = Decimal(signed_amount_in_account_ccy).quantize(
            TWOPLACES, rounding=ROUND_HALF_UP
        )
        base_amount, rate = CurrencyService.convert_to_base(
            signed_amount_in_account_ccy, account.currency, on_date, organization, rate_type=rate_type,
        )

        debit = base_amount if base_amount > 0 else Decimal('0.00')
        credit = -base_amount if base_amount < 0 else Decimal('0.00')

        return {
            'account': account,
            'debit': debit,
            'credit': credit,
            'amount_currency': signed_amount_in_account_ccy,
            'currency': account.currency,
            'exchange_rate': rate,
            'description': description,
        }

    # ── Pre-flight validator (mirror of model.clean) ─────────────────
    @staticmethod
    def validate_line(line) -> None:
        """
        Standalone version of the model-level guard, callable on a
        line instance before save() so write paths can fail fast with
        a clear error rather than wait for POSTED clean().
        """
        from apps.finance.models import JournalEntry  # noqa
        je_proxy_org_id = line.organization_id
        if not line.account or not line.account.currency:
            return
        base_code = CurrencyService.get_base_code(line.organization)
        if not base_code or line.account.currency == base_code:
            return
        if line.amount_currency is None or line.exchange_rate is None:
            raise ValidationError(
                f"Line on account {line.account.code} is foreign-currency-"
                f"denominated; amount_currency and exchange_rate are required."
            )
        signed_base = (line.debit or Decimal('0')) - (line.credit or Decimal('0'))
        expected = (line.amount_currency * line.exchange_rate).quantize(TWOPLACES)
        if abs(signed_base - expected) > TWOPLACES:
            raise ValidationError(
                f"Line on account {line.account.code}: base {signed_base} "
                f"≠ {line.amount_currency} {line.account.currency} × "
                f"{line.exchange_rate} = {expected}."
            )
