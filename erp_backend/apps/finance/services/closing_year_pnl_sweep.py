"""
Closing — P&L sweep into retained earnings (per scope).

Builds and posts the per-scope CLOSING journal entries that zero out
INCOME, EXPENSE, and clears_at_close=True accounts into the retained
earnings account at year-end. Extracted from `_close_fiscal_year_impl`
for the 300-line maintainability ceiling. Module-private to the
closing pipeline.
"""
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def sweep_pnl_into_retained_earnings(organization, fiscal_year, re_account,
                                     user, preview, dry_run):
    """Compute P&L per (account, scope) from POSTED JE lines inside
    `fiscal_year`, then post one CLOSING JE per scope that zeroes the
    P&L into `re_account`. Anchors each scope's JE on the appropriate
    fiscal_year FK for the audit trail. Mutates `preview` in dry_run
    mode to surface what would have been written.
    """
    from apps.finance.models import JournalEntryLine
    from apps.finance.services.ledger_core import LedgerCoreMixin
    from django.db.models import Sum, Q

    # Compute per-account, per-scope P&L from authoritative JE lines.
    # Sweep set = INCOME + EXPENSE (the P&L) + any contra-equity
    # account flagged clears_at_close=True (Owner Draws, Dividends
    # Declared, Treasury Stock). The flag is the ONLY safe signal —
    # using type=EQUITY alone would wrongly include Capital and
    # Retained Earnings themselves, zeroing real equity every year.
    pnl_lines = JournalEntryLine.objects.filter(
        journal_entry__organization=organization,
        journal_entry__status='POSTED',
        journal_entry__is_superseded=False,
    ).filter(
        Q(account__type__in=['INCOME', 'EXPENSE'])
        | Q(account__clears_at_close=True)
    ).filter(
        Q(journal_entry__fiscal_year=fiscal_year) |
        Q(journal_entry__fiscal_year__isnull=True,
          journal_entry__transaction_date__date__gte=fiscal_year.start_date,
          journal_entry__transaction_date__date__lte=fiscal_year.end_date)
    ).values(
        'account_id', 'account__code', 'account__name',
        'journal_entry__scope'
    ).annotate(
        total_debit=Sum('debit'),
        total_credit=Sum('credit'),
    )

    # Build a lookup: {account_id: {scope: net_amount}}
    pnl_by_account = {}
    for row in pnl_lines:
        acc_id = row['account_id']
        scope_val = row['journal_entry__scope']
        net = (row['total_debit'] or Decimal('0.00')) - (row['total_credit'] or Decimal('0.00'))
        if acc_id not in pnl_by_account:
            pnl_by_account[acc_id] = {
                'code': row['account__code'],
                'name': row['account__name'],
                'OFFICIAL': Decimal('0.00'),
                'INTERNAL': Decimal('0.00'),
            }
        pnl_by_account[acc_id][scope_val] = \
            pnl_by_account[acc_id].get(scope_val, Decimal('0.00')) + net

    # Option A — OFFICIAL ⊂ INTERNAL:
    #   - OFFICIAL closing JE (scope='OFFICIAL') zeros the official portion.
    #   - INTERNAL closing JE (scope='INTERNAL') zeros ONLY the
    #     internal-only delta, avoiding double-close.
    scope_amount_fn = (
        ('OFFICIAL', lambda d: d.get('OFFICIAL', Decimal('0.00'))),
        ('INTERNAL', lambda d: d.get('INTERNAL', Decimal('0.00'))),
    )

    for scope, amount_fn in scope_amount_fn:
        closing_lines = []
        total_pnl = Decimal('0.00')

        for acc_id, data in pnl_by_account.items():
            bal = amount_fn(data)
            if bal == Decimal('0.00'):
                continue
            if bal > Decimal('0.00'):
                closing_lines.append({
                    'account_id': acc_id,
                    'debit': Decimal('0.00'),
                    'credit': bal,
                    'description': f"Year-end close ({scope}): {data['code']} - {data['name']}",
                })
            else:
                closing_lines.append({
                    'account_id': acc_id,
                    'debit': abs(bal),
                    'credit': Decimal('0.00'),
                    'description': f"Year-end close ({scope}): {data['code']} - {data['name']}",
                })
            total_pnl += bal

        if not closing_lines:
            logger.info(
                f"ClosingService: No {scope} P&L balances to close for {fiscal_year.name}"
            )
            continue

        if total_pnl > Decimal('0.00'):
            closing_lines.append({
                'account_id': re_account.id,
                'debit': total_pnl,
                'credit': Decimal('0.00'),
                'description': f"Year-end close ({scope}): Net income to {re_account.code}",
            })
        elif total_pnl < Decimal('0.00'):
            closing_lines.append({
                'account_id': re_account.id,
                'debit': Decimal('0.00'),
                'credit': abs(total_pnl),
                'description': f"Year-end close ({scope}): Net loss to {re_account.code}",
            })

        closing_entry = LedgerCoreMixin.create_journal_entry(
            organization=organization,
            transaction_date=fiscal_year.end_date,
            description=f"Year-End Close ({scope}): {fiscal_year.name}",
            lines=closing_lines,
            status='POSTED',
            scope=scope,
            user=user,
            journal_type='CLOSING',
            journal_role='SYSTEM_CLOSING',
            source_module='finance',
            source_model='FiscalYear',
            source_id=fiscal_year.id,
            internal_bypass=True,
        )

        # Anchor each scope's closing JE on its own FK for the audit trail.
        if scope == 'OFFICIAL':
            fiscal_year.closing_journal_entry = closing_entry
        elif scope == 'INTERNAL':
            fiscal_year.internal_closing_journal_entry = closing_entry

        # Preview capture — row is already in the DB but will
        # roll back at the end if dry_run; we snapshot here so
        # the preview reflects what the operator would see.
        if dry_run:
            total_d = sum((Decimal(str(l['debit'])) for l in closing_lines), Decimal('0'))
            total_c = sum((Decimal(str(l['credit'])) for l in closing_lines), Decimal('0'))
            preview['closing_jes'].append({
                'scope': scope,
                'lines': len(closing_lines),
                'total_debit': str(total_d),
                'total_credit': str(total_c),
                'pnl_net': str(total_pnl),
            })
