"""
Closing — Partial-close (mid-year truncation) helper.

Splits a fiscal year at `close_date`: creates / locates a remainder
fiscal year, mirrors its period structure, relocates post-close JEs
into the remainder year, then truncates the original year. Extracted
from `_close_fiscal_year_impl` for the 300-line maintainability
ceiling. Module-private to the closing pipeline.
"""
import logging
from datetime import timedelta
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def handle_partial_close(organization, fiscal_year, close_date, user):
    """Truncate `fiscal_year` to `close_date` and migrate post-close
    activity into a remainder year (auto-created if missing).

    Returns (remainder_start, remainder_end) — the boundaries of the
    follow-on year so the caller can resolve `next_year` for opening-
    balance generation.
    """
    from apps.finance.models import (
        FiscalYear, FiscalPeriod, JournalEntry,
    )
    import calendar as _cal
    from datetime import date as _date

    remainder_start = close_date + timedelta(days=1)
    remainder_end = fiscal_year.end_date

    # ── Step A: Find or create the remainder fiscal year ─────
    # Exclude the FY being closed — its full range trivially
    # overlaps the remainder range, but it can't be its own
    # remainder.
    remainder_fy = (
        FiscalYear.objects
        .filter(
            organization=organization,
            start_date__lte=remainder_end,
            end_date__gte=remainder_start,
        )
        .exclude(id=fiscal_year.id)
        .first()
    )

    if remainder_fy is None:
        # Auto-create. Name it explicitly to make the split
        # visible in the fiscal-year list — no silent ghost FYs.
        remainder_fy = FiscalYear.objects.create(
            organization=organization,
            name=f"{fiscal_year.name} (remainder)",
            start_date=remainder_start,
            end_date=remainder_end,
            is_closed=False,
            is_hard_locked=False,
        )
        logger.info(
            f"ClosingService: Auto-created remainder fiscal year "
            f"'{remainder_fy.name}' ({remainder_start} → {remainder_end})"
        )

    # ── Step B: Ensure the remainder FY has periods ──────────
    # If user pre-created a bare FY, generate matching periods
    # using the same frequency (monthly / quarterly) inferred
    # from the original year.
    if not FiscalPeriod.objects.filter(fiscal_year=remainder_fy).exists():
        # Original FY periods we'll mirror in the remainder year.
        # Two things we infer:
        #   1. Frequency (monthly vs quarterly) from average length.
        #   2. Whether to create a 13th audit/adjustment period —
        #      if the original year had one (set by the wizard),
        #      the remainder year carries it forward so year-end
        #      adjustments still have a home.
        orig_periods = list(
            FiscalPeriod.objects
            .filter(fiscal_year=fiscal_year)
            .order_by('start_date')
        )
        # Period stats for inference (filter out audit period
        # since its 0-day length skews the average).
        non_audit = [p for p in orig_periods if not getattr(p, 'is_adjustment_period', False)]
        avg_len = (
            sum((p.end_date - p.start_date).days + 1 for p in non_audit) /
            max(len(non_audit), 1)
        ) if non_audit else 30
        quarterly = avg_len >= 80
        had_audit_period = any(getattr(p, 'is_adjustment_period', False) for p in orig_periods)

        cur = remainder_start
        while cur <= remainder_end:
            if quarterly:
                qe_month = ((cur.month - 1) // 3 + 1) * 3
                last_day = _cal.monthrange(cur.year, qe_month)[1]
                p_end = _date(cur.year, qe_month, last_day)
                p_name = f"Q{(qe_month // 3)}-{cur.year}"
            else:
                last_day = _cal.monthrange(cur.year, cur.month)[1]
                p_end = _date(cur.year, cur.month, last_day)
                p_name = cur.strftime('%B %Y')
            if p_end > remainder_end:
                p_end = remainder_end
            FiscalPeriod.objects.create(
                organization=organization,
                fiscal_year=remainder_fy,
                name=p_name,
                start_date=cur,
                end_date=p_end,
                status='OPEN',
                is_closed=False,
            )
            cur = p_end + timedelta(days=1)

        # 13th audit/adjustment period — mirrors the wizard's
        # behaviour. Single-day window at remainder_end so it
        # never overlaps the regular monthly/quarterly grid but
        # still has a unique date for posting adjustments.
        if had_audit_period:
            FiscalPeriod.objects.create(
                organization=organization,
                fiscal_year=remainder_fy,
                name=f"Audit {remainder_end.year}",
                start_date=remainder_end,
                end_date=remainder_end,
                status='OPEN',
                is_closed=False,
                is_adjustment_period=True,
            )

        logger.info(
            f"ClosingService: Generated periods for remainder FY '{remainder_fy.name}'"
            f"{' (incl. audit period)' if had_audit_period else ''}"
        )

    # ── Step C: Relocate post-close JEs into remainder periods ──
    # Source by transaction_date, NOT by period.start_date.
    # A spanning period (start ≤ close_date < end) holds JEs on
    # both sides of the close: the ones dated after close_date
    # belong in the remainder year. Filtering by period.start_date
    # alone would leave them as orphans whose date no longer
    # fits their truncated period (causing 75¢-style drifts in
    # subsequent opening-balance generation).
    remainder_periods = list(
        FiscalPeriod.objects
        .filter(fiscal_year=remainder_fy)
        .order_by('start_date')
    )

    def _period_for(d):
        for p in remainder_periods:
            if p.start_date <= d <= p.end_date:
                return p
        return None

    relocated = 0
    post_close_jes = JournalEntry.objects.filter(
        organization=organization,
        fiscal_year=fiscal_year,
        transaction_date__date__gt=close_date,
    )
    for je in post_close_jes:
        if je.transaction_date is None:
            raise ValidationError(
                f"Cannot relocate journal entry {je.reference} during partial "
                f"close: it has no transaction_date."
            )
        je_date = je.transaction_date.date() if hasattr(je.transaction_date, 'date') else je.transaction_date
        target = _period_for(je_date)
        if target is None:
            raise ValidationError(
                f"Cannot relocate journal entry {je.reference} dated {je_date}: "
                f"no period in remainder year '{remainder_fy.name}' covers that date. "
                f"Adjust the remainder year's date range or fix the JE date."
            )
        je.fiscal_period = target
        je.fiscal_year = remainder_fy
        # force_audit_bypass: lets us update POSTED entries.
        # We're not modifying lines/amounts/hash, only re-pointing
        # to the correct period after a structural year split.
        je.save(force_audit_bypass=True)
        relocated += 1
    if relocated:
        logger.info(
            f"ClosingService: Relocated {relocated} journal entries from "
            f"{fiscal_year.name} to {remainder_fy.name}"
        )

    # ── Step D: Delete now-empty post-close periods ──────────
    FiscalPeriod.objects.filter(
        fiscal_year=fiscal_year,
        start_date__gt=close_date,
    ).delete()

    # Truncate periods that span close_date
    spanning = FiscalPeriod.objects.filter(
        fiscal_year=fiscal_year,
        start_date__lte=close_date,
        end_date__gt=close_date,
    )
    for p in spanning:
        p.end_date = close_date
        p.save(update_fields=['end_date'])

    # Truncate fiscal year end_date
    fiscal_year.end_date = close_date
    fiscal_year.save(update_fields=['end_date'])

    logger.info(
        f"ClosingService: Partial close — truncated {fiscal_year.name} to {close_date}"
    )
    return remainder_start, remainder_end
