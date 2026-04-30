"""
Closing — Period-level integrity gate.

Runs at month-end period close (`close_fiscal_period`); a lighter
sibling of the year-end `_assert_close_integrity`. Extracted from
`closing_service.py` for the 300-line maintainability ceiling.
Re-attached to `ClosingService` as a static method by the facade.
"""
import logging
from decimal import Decimal
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def _assert_period_integrity(organization, fiscal_period):
    """Period-level integrity gate — lighter than the year gate.

    Two invariants:
      1. Per-scope double-entry within the period (ΣDebit = ΣCredit)
      2. No JE line in this period targets a parent account
         (active children count, consistent with other guards)
    """
    from apps.finance.models import JournalEntryLine, ChartOfAccount
    from apps.finance.services.closing_service import ClosingService
    from django.db.models import Sum, Count, Q

    tol = ClosingService._RECON_TOLERANCE

    for scope in ('OFFICIAL', 'INTERNAL'):
        agg = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope=scope,
        ).aggregate(d=Sum('debit'), c=Sum('credit'))
        d = agg['d'] or Decimal('0.00')
        c = agg['c'] or Decimal('0.00')
        if (d - c).copy_abs() > tol:
            raise ValidationError(
                f"[{scope}] Period {fiscal_period.name} has unbalanced "
                f"JE lines: ΣDr={d}, ΣCr={c}, diff={d-c}. Period close "
                f"aborted."
            )

    # Parent-posting check (consistent with active-children-only rule)
    parent_ids = list(
        ChartOfAccount.objects
        .filter(organization=organization)
        .annotate(n=Count('children', filter=Q(children__is_active=True)))
        .filter(n__gt=0)
        .values_list('id', flat=True)
    )
    if parent_ids:
        off = JournalEntryLine.objects.filter(
            organization=organization,
            account_id__in=parent_ids,
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
        ).values('account__code', 'account__name').annotate(n=Count('id'))
        offenders = [
            f"{r['account__code']} {r['account__name']} ({r['n']} lines)"
            for r in off
        ]
        if offenders:
            raise ValidationError(
                f"Period {fiscal_period.name} has JE lines on parent "
                f"accounts — reclass to leaves first:\n  "
                + "\n  ".join(offenders)
            )
