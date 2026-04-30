"""
Closing — Year-end orchestrator helpers.

Small focused helpers used only by `_close_fiscal_year_impl`.
Module-private to the closing pipeline.
"""
import logging
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def check_fx_revaluation_pre_close(organization, fiscal_year, yr_end, preview):
    """Hybrid-mode FX revaluation pre-check (warn-only).

    Foreign-pinned accounts store the foreign amount + rate per line,
    but the books stay in base currency. Period-end revaluation is
    OPTIONAL — operators run it on demand from the Currencies page
    when they need IFRS-style mark-to-market for a reporting
    deliverable. We don't block the close. We surface missing
    revaluation as a `messages` warning in the close preview.
    """
    from apps.finance.models import (
        JournalEntryLine, FiscalPeriod, ChartOfAccount,
    )
    from apps.finance.models.currency_models import (
        Currency as _Currency, CurrencyRevaluation,
    )

    base_ccy = _Currency.objects.filter(
        organization=organization, is_base=True,
    ).first()
    if not base_ccy:
        return

    in_window_periods = FiscalPeriod.objects.filter(
        fiscal_year=fiscal_year,
        start_date__lte=yr_end,
    )
    foreign_account_ids = list(
        ChartOfAccount.objects.filter(
            organization=organization,
            is_active=True,
        ).exclude(currency=base_ccy.code).exclude(currency__isnull=True)
        .values_list('id', flat=True)
    )
    if not foreign_account_ids:
        return

    missing = []
    for fp in in_window_periods:
        has_fx_activity = JournalEntryLine.objects.filter(
            organization=organization,
            account_id__in=foreign_account_ids,
            journal_entry__fiscal_period=fp,
            journal_entry__status='POSTED',
        ).exists()
        if not has_fx_activity:
            continue
        has_revaluation = CurrencyRevaluation.objects.filter(
            organization=organization,
            fiscal_period=fp,
            status='POSTED',
        ).exists()
        if not has_revaluation:
            missing.append(fp.name)
    if missing:
        warn_msg = (
            f"Hybrid mode: closing without period-end revaluation "
            f"in {len(missing)} period(s) — "
            f"{', '.join(missing[:5])}{'…' if len(missing) > 5 else ''}. "
            f"Foreign balances stay at booked rates. Run Revalue "
            f"on the Currencies page if you need IFRS mark-to-market."
        )
        logger.warning(warn_msg)
        try:
            preview['messages'].append(warn_msg)
        except Exception:
            pass


def backfill_orphan_jes(organization, yr_start, yr_end):
    """Backfill orphan JEs (NULL fiscal_year_id) into this year — these
    were created before fiscal_year linkage existed and would otherwise
    be invisible to balance / audit queries.
    """
    from apps.finance.models import JournalEntry as JE, FiscalPeriod
    orphans = JE.objects.filter(
        organization=organization,
        fiscal_year__isnull=True,
        transaction_date__date__gte=yr_start,
        transaction_date__date__lte=yr_end,
    )
    # Use queryset.update() to bypass the ImmutableLedger save() guard
    # (POSTED JEs reject .save()). Linking fiscal_year is metadata, not
    # a financial change — safe to write directly.
    for je in orphans:
        fp = FiscalPeriod.objects.filter(
            organization=organization,
            start_date__lte=je.transaction_date,
            end_date__gte=je.transaction_date,
        ).first()
        if fp:
            JE.objects.filter(pk=je.pk).update(
                fiscal_year=fp.fiscal_year,
                fiscal_period=fp,
            )


def resolve_retained_earnings_account(organization, retained_earnings_account_id):
    """Resolve and validate the RE account for the close JE."""
    from apps.finance.models import ChartOfAccount

    if retained_earnings_account_id:
        re_account = ChartOfAccount.objects.get(
            id=retained_earnings_account_id, organization=organization
        )
    else:
        from apps.finance.models.posting_rule import PostingRule
        rule = PostingRule.objects.filter(
            organization=organization,
            event_code='equity.retained_earnings.transfer',
            is_active=True,
        ).select_related('account').first()
        if not rule:
            raise ValidationError(
                "No posting rule for 'equity.retained_earnings.transfer'. "
                "Configure it under Finance → Posting Rules, or pass "
                "retained_earnings_account_id explicitly."
            )
        re_account = rule.account

    # Enforce account-type correctness — silently closing into a
    # non-EQUITY account (e.g. a misconfigured ASSET or INCOME
    # account) would corrupt the balance sheet permanently with
    # no obvious tell at read time.
    if re_account.type != 'EQUITY':
        raise ValidationError(
            f"Retained Earnings account '{re_account.code} — {re_account.name}' "
            f"has type '{re_account.type}' — must be EQUITY. Pick a different "
            f"account or update the posting rule."
        )
    if not re_account.is_active:
        raise ValidationError(
            f"Retained Earnings account '{re_account.code} — {re_account.name}' "
            f"is inactive. Activate it or pick a different account."
        )
    return re_account
