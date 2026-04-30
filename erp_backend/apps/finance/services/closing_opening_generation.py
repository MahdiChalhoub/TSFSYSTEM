"""
Closing — Opening Balance generation (year-end carry-forward).

Generates `OpeningBalance` rows AND the immutable SYSTEM_OPENING journal
entry per scope when closing a fiscal year. Extracted from
`closing_service.py` for the 300-line maintainability ceiling.
Re-attached to `ClosingService` as static methods by the facade.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_opening_balances(organization, from_year, to_year, user=None):
    """
    Generate OpeningBalance records for the new year from the closing
    balances of the old year. Only for Balance Sheet accounts (ASSET,
    LIABILITY, EQUITY). P&L accounts start at zero.

    Generates opening balances for BOTH scopes (Option A — OFFICIAL ⊂ INTERNAL):
      - OFFICIAL OB amount = `balance_official` (the declared / regulatory subset)
      - INTERNAL OB amount = `balance - balance_official` (the internal-only delta)

    At read time, the INTERNAL view sums BOTH rows (because INTERNAL includes
    all scopes, mirroring `balance_service._refresh_period`). Storing the
    delta on the INTERNAL row prevents double-counting the official portion.

    DUAL-WRITE (Phase 2 of OB → JE unification):
      In addition to the OpeningBalance table, we now also create an
      immutable OPENING journal entry per scope, dated `to_year.start_date`.
      This prepares the system for Phase 3 where read paths flip to
      JE-only and the OpeningBalance table becomes read-only. Dual-write
      keeps both in sync during the transition.
    """
    from apps.finance.models import ChartOfAccount, OpeningBalance, JournalEntryLine
    from django.db.models import Sum, Q

    # Opening balances carry forward only LEAF accounts. Parent /
    # header accounts are pure aggregations of their descendants and
    # must never hold their own opening balance — including them
    # would either double-count (if a child also carries the same
    # amount) or invent balance out of thin air. The `allow_posting`
    # flag is the canonical signal (auto-flipped to False when an
    # account gains children); we also annotate and filter on the
    # live tree shape to survive any stale-flag edge case.
    from django.db.models import Count as _Count, Q as _Q
    # Count only ACTIVE children — inactive/archived children are
    # ghosts from template imports (e.g. USA_GAAP accounts on an
    # IFRS-primary deployment) and shouldn't make their parent
    # be treated as a header.
    bs_accounts = ChartOfAccount.objects.annotate(
        _n_active_children=_Count('children', filter=_Q(children__is_active=True)),
    ).filter(
        organization=organization,
        type__in=['ASSET', 'LIABILITY', 'EQUITY'],
        is_active=True,
        allow_posting=True,
        _n_active_children=0,
    )

    # Per-scope amounts we'll both write to OB rows AND use to build
    # the opening JE. Collecting once avoids a second pass.
    by_scope: dict[str, list[dict]] = {'OFFICIAL': [], 'INTERNAL': []}

    # Compute post-close balance per (account, scope) by aggregating
    # POSTED, non-superseded JE lines up to and including
    # from_year.end_date. The denormalized `balance` / `balance_official`
    # fields on ChartOfAccount can drift (observed 1.86M drift on
    # live data) — we've already learned the hard way they aren't
    # safe to trust here. This mirrors the closing-JE computation
    # which likewise reads JE lines directly.
    def _authoritative(acc, scope):
        # Sum only the lines INSIDE from_year (or orphan-without-FY whose
        # date falls in the year). Summing globally up to from_year.end_date
        # double-counts when from_year already has its own SYSTEM_OPENING
        # JE: the prior year's closing JE AND from_year's opening JE both
        # carry the same balance, so adding them produces 2x the carry-in.
        # This matches the close-integrity gate's `close_rows` filter so
        # the two queries reconcile.
        agg = JournalEntryLine.objects.filter(
            journal_entry__organization=organization,
            journal_entry__status='POSTED',
            journal_entry__is_superseded=False,
            journal_entry__scope=scope,
            account=acc,
        ).filter(
            Q(journal_entry__fiscal_year=from_year) |
            Q(journal_entry__fiscal_year__isnull=True,
              journal_entry__transaction_date__date__gte=from_year.start_date,
              journal_entry__transaction_date__date__lte=from_year.end_date)
        ).aggregate(d=Sum('debit'), c=Sum('credit'))
        return (agg['d'] or Decimal('0.00')) - (agg['c'] or Decimal('0.00'))

    created = 0
    with transaction.atomic():
        # Full rebuild semantics — wipe existing OB rows for this
        # target year first, then write fresh from authoritative JE
        # lines. Otherwise `update_or_create` leaves stale rows
        # behind for accounts whose new net is 0 (observed on live
        # data: accounts 2100 and 3000 retained pre-close values of
        # 680k and 780k respectively, blocking every downstream gate).
        OpeningBalance.objects.filter(
            organization=organization, fiscal_year=to_year,
        ).delete()

        for acc in bs_accounts:
            # OFFICIAL and INTERNAL are disjoint scopes — each JE
            # belongs to exactly one. Each scope's OB is the direct
            # sum of that scope's POSTED JE lines on this account
            # up to year-end. No cumulative subtraction.
            amounts_by_scope = (
                ('OFFICIAL', _authoritative(acc, 'OFFICIAL')),
                ('INTERNAL', _authoritative(acc, 'INTERNAL')),
            )
            for scope, net in amounts_by_scope:
                if net == Decimal('0.00'):
                    continue
                if net > Decimal('0.00'):
                    debit_amt, credit_amt = net, Decimal('0.00')
                else:
                    debit_amt, credit_amt = Decimal('0.00'), abs(net)

                OpeningBalance.objects.update_or_create(
                    organization=organization,
                    account=acc,
                    fiscal_year=to_year,
                    scope=scope,
                    defaults={
                        'debit_amount': debit_amt,
                        'credit_amount': credit_amt,
                        'source': 'TRANSFER',
                        'created_by': user,
                        'notes': f"Carried forward from {from_year.name} ({scope})",
                    }
                )
                created += 1
                by_scope[scope].append({
                    'account_id': acc.id,
                    'account_code': acc.code,
                    'account_name': acc.name,
                    'debit': debit_amt,
                    'credit': credit_amt,
                })

        # ── Dual-write: OPENING journal entries ──
        # One JE per scope. Self-balanced (Assets = Liabilities + Equity
        # at year-end, so the carry-forward set is already balanced
        # without a clearing account). Retained Earnings is included
        # automatically because it's an EQUITY account with the net
        # income baked in by the upstream closing JE.
        for scope in ('OFFICIAL', 'INTERNAL'):
            _create_opening_journal_entry(
                organization=organization,
                fiscal_year=to_year,
                scope=scope,
                lines=by_scope[scope],
                source_year_name=from_year.name,
                user=user,
            )

    logger.info(
        f"ClosingService: Generated {created} opening balances "
        f"(both scopes) for {to_year.name} from {from_year.name}"
    )
    return created


def _create_opening_journal_entry(organization, fiscal_year, scope, lines,
                                  source_year_name='prior year', user=None):
    """
    Create or replace the immutable OPENING journal entry for a fiscal
    year + scope. Used by:
      - `generate_opening_balances` (dual-write during Phase 2)
      - `backfill_opening_journal_entries` (retroactive creation from
        existing OpeningBalance rows)

    Idempotent: if an OPENING JE already exists for this (fiscal_year,
    scope), we delete it first and rebuild. This is safe because the
    entry is system-owned (`source_model='FiscalYear'`, `source_id=fy.id`,
    `journal_type='OPENING'`) and cannot be touched by users.

    Self-balanced by construction — no clearing account. If debits ≠
    credits (which would indicate corrupt source data), we log and
    skip rather than create an invalid JE.
    """
    from apps.finance.models import JournalEntry, FiscalYear
    from apps.finance.services.ledger_core import LedgerCoreMixin

    if not lines:
        return None  # Nothing to write for this scope.

    total_d = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
    total_c = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
    if (total_d - total_c).copy_abs() > Decimal('0.01'):
        logger.error(
            f"ClosingService: OPENING JE for {fiscal_year.name} ({scope}) "
            f"would be out of balance (D={total_d}, C={total_c}). "
            f"Skipping JE creation — OB rows are still written. Check "
            f"the source year's closing JE for missing lines."
        )
        return None

    # Race guard — serialize concurrent writers for this (fiscal_year,
    # scope) pair. Without the row lock, two workers racing on the
    # same year can both read "no active OPENING JE", both soft-
    # supersede nothing, and both create fresh POSTED rows → duplicate
    # active openings. select_for_update() on the FiscalYear row
    # forces them into sequence. Cheap (single row), effective, and
    # the transaction context from the caller is reused (atomic
    # propagation).
    FiscalYear.objects.select_for_update().get(pk=fiscal_year.pk)

    # Soft-supersede any prior active SYSTEM_OPENING JE for this
    # (year, scope) — we keep the row POSTED, keep the is_locked
    # audit flag, and just flip is_superseded=True. Balance services
    # filter is_superseded=False so superseded rows stop contributing
    # immediately. The superseded_by FK is stamped below after the
    # new JE is created so the chain is traceable both directions.
    now = timezone.now()
    JournalEntry.objects.filter(
        organization=organization,
        fiscal_year=fiscal_year,
        journal_type='OPENING',
        scope=scope,
        journal_role='SYSTEM_OPENING',
        status='POSTED',
        is_superseded=False,
    ).update(
        is_superseded=True,
        superseded_at=now,
    )

    # Build line dicts for create_journal_entry — needs the
    # `description` key per line which OpeningBalance doesn't have.
    je_lines = [
        {
            'account_id': l['account_id'],
            'debit': l['debit'],
            'credit': l['credit'],
            'description': f"Opening balance ({scope}): {l['account_code']} - {l['account_name']}",
        }
        for l in lines
    ]

    je = LedgerCoreMixin.create_journal_entry(
        organization=organization,
        transaction_date=fiscal_year.start_date,
        description=f"Year-Opening ({scope}): {fiscal_year.name} — carried forward from {source_year_name}",
        lines=je_lines,
        status='POSTED',
        scope=scope,
        user=user,
        journal_type='OPENING',
        journal_role='SYSTEM_OPENING',
        source_module='finance',
        source_model='FiscalYear',
        source_id=fiscal_year.id,
        internal_bypass=True,
    )

    # Immutability — opening JEs are system-owned and must not be
    # editable via the normal JE editor. is_locked + journal_role=
    # 'SYSTEM_OPENING' makes them trivially distinguishable.
    JournalEntry.objects.filter(pk=je.pk).update(is_locked=True)

    # Link superseded rows to the new JE for bidirectional traceability.
    # This has to happen AFTER the new JE exists.
    JournalEntry.objects.filter(
        organization=organization,
        fiscal_year=fiscal_year,
        journal_type='OPENING',
        scope=scope,
        journal_role='SYSTEM_OPENING',
        is_superseded=True,
        superseded_by__isnull=True,
    ).exclude(pk=je.pk).update(superseded_by=je)

    logger.info(
        f"ClosingService: OPENING JE created for {fiscal_year.name} ({scope}) "
        f"with {len(lines)} lines, total D/C = {total_d}"
    )
    return je
