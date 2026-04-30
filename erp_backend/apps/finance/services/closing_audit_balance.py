"""
Closing Audit — Balance & parent-purity checks.

Read-only tripwires that surface accounting integrity issues independent
of the year-end close. Extracted from `closing_service.py` for the 300-
line maintainability ceiling. Re-attached to `ClosingService` as static
methods by the facade so all `ClosingService.method_name(...)` callers
keep working.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def check_parent_purity(organization):
    """Return a report of any parent/header account that currently
    holds non-zero direct postings, per scope.

    Invariant: a parent account's balance must equal the sum of its
    children — meaning no direct JE lines target the parent itself.
    This method implements that invariant as a live tripwire that
    runs independently of close. The close-integrity gate enforces
    it at finalize time; this method surfaces violations continuously
    so someone notices before the year rolls.

    Shape:
      {
        'organization_id': int, 'organization_slug': str,
        'clean': bool,
        'offenders': [
          {'account_id': int, 'code': str, 'name': str, 'type': str,
           'scope': 'OFFICIAL'|'INTERNAL',
           'debit': Decimal, 'credit': Decimal, 'net': Decimal,
           'n_lines': int},
          ...
        ],
      }
    """
    from apps.finance.models import ChartOfAccount, JournalEntryLine
    from apps.finance.services.closing_service import ClosingService
    from django.db.models import Count, Sum, Q

    tol = ClosingService._RECON_TOLERANCE
    # A "parent" for this check = any account with at least one
    # ACTIVE child. Accounts whose only children are archived
    # ghosts (e.g. from an unused template) are functional leaves.
    parent_ids = list(
        ChartOfAccount.objects
        .filter(organization=organization)
        .annotate(n_active=Count('children', filter=Q(children__is_active=True)))
        .filter(n_active__gt=0)
        .values_list('id', flat=True)
    )

    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'offenders': [],
    }

    if not parent_ids:
        return report

    for scope in ('OFFICIAL', 'INTERNAL'):
        rows = (
            JournalEntryLine.objects
            .filter(
                organization=organization,
                account_id__in=parent_ids,
                journal_entry__scope=scope,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
            )
            .values('account_id', 'account__code', 'account__name', 'account__type')
            .annotate(d=Sum('debit'), c=Sum('credit'), n=Count('id'))
        )
        for r in rows:
            net = (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
            if net.copy_abs() > tol or r['n'] > 0:
                report['offenders'].append({
                    'account_id': r['account_id'],
                    'code': r['account__code'],
                    'name': r['account__name'],
                    'type': r['account__type'],
                    'scope': scope,
                    'debit': r['d'] or Decimal('0.00'),
                    'credit': r['c'] or Decimal('0.00'),
                    'net': net,
                    'n_lines': r['n'],
                })
                report['clean'] = False
    return report


def validate_balance_integrity(organization):
    """Independent recomputation of every ChartOfAccount balance
    from POSTED, non-superseded JE lines, compared to the
    denormalized `balance` / `balance_official` fields on the COA
    row. Any difference > 1¢ is drift.

    Mirrors the formula in `recalc_balances`:
      balance          = SUM(debit - credit) over all POSTED lines
      balance_official = same, scope='OFFICIAL' only

    Read-only. Reports, does not fix. Use the `recalc_balances`
    command to actually rewrite the denormalized fields when drift
    is found.

    Report shape:
      {
        'organization_id', 'organization_slug', 'clean': bool,
        'accounts_checked': int, 'drifted': int,
        'drifts': [
          {'account_id', 'code', 'name',
           'field': 'balance' | 'balance_official',
           'stored': Decimal, 'recomputed': Decimal, 'diff': Decimal},
          ...
        ],
      }
    """
    from apps.finance.models import ChartOfAccount, JournalEntryLine
    from apps.finance.services.closing_service import ClosingService
    from django.db.models import Sum

    tol = ClosingService._RECON_TOLERANCE
    report = {
        'organization_id': organization.id,
        'organization_slug': getattr(organization, 'slug', None),
        'clean': True,
        'accounts_checked': 0,
        'drifted': 0,
        'drifts': [],
    }

    # One pass across all lines — aggregate by (account, scope),
    # cheaper than N queries per account.
    agg_all = (
        JournalEntryLine.objects
        .filter(
            organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
        )
        .values('account_id')
        .annotate(d=Sum('debit'), c=Sum('credit'))
    )
    all_by_acc = {
        r['account_id']: (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
        for r in agg_all
    }

    agg_off = (
        JournalEntryLine.objects
        .filter(
            organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope='OFFICIAL',
        )
        .values('account_id')
        .annotate(d=Sum('debit'), c=Sum('credit'))
    )
    off_by_acc = {
        r['account_id']: (r['d'] or Decimal('0.00')) - (r['c'] or Decimal('0.00'))
        for r in agg_off
    }

    for acc in ChartOfAccount.objects.filter(organization=organization):
        report['accounts_checked'] += 1
        account_drifted = False

        stored_bal = acc.balance or Decimal('0.00')
        recomp_bal = all_by_acc.get(acc.id, Decimal('0.00'))
        if (stored_bal - recomp_bal).copy_abs() > tol:
            report['drifts'].append({
                'account_id': acc.id,
                'code': acc.code, 'name': acc.name,
                'field': 'balance',
                'stored': stored_bal,
                'recomputed': recomp_bal,
                'diff': stored_bal - recomp_bal,
            })
            account_drifted = True

        stored_off = acc.balance_official or Decimal('0.00')
        recomp_off = off_by_acc.get(acc.id, Decimal('0.00'))
        if (stored_off - recomp_off).copy_abs() > tol:
            report['drifts'].append({
                'account_id': acc.id,
                'code': acc.code, 'name': acc.name,
                'field': 'balance_official',
                'stored': stored_off,
                'recomputed': recomp_off,
                'diff': stored_off - recomp_off,
            })
            account_drifted = True

        if account_drifted:
            report['drifted'] += 1
            report['clean'] = False

    return report
