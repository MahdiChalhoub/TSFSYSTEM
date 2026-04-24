"""
Prior Period Adjustment (PPA) service.

Accounting principle
--------------------
Once a fiscal year is CLOSED or FINALIZED, its books are immutable.
When an error is discovered AFTER close, the correct treatment is:

  • Post the adjustment in the CURRENT open period (not the closed one)
  • Replace any P&L impact with a direct posting to Retained Earnings,
    so the current-year P&L stays clean
  • Preserve a forensic record: WHO made the adjustment, WHY, which
    closed year it references, and what the original mis-statement was

This service enforces those rules. The output is a POSTED
JournalEntry tagged `journal_type='ADJUSTMENT'` + `journal_role=
'SYSTEM_ADJUSTMENT'` carrying `source_model='FiscalYearPPA'` and
source_id=target_fiscal_year.id so the audit trail is queryable.

The closed year is NEVER reopened. If a proper restatement with full
disclosure is needed, a separate workflow should reverse the year's
closing JE under superuser control — the PPA path is the
day-to-day correction mechanism.
"""
import logging
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class PriorPeriodAdjustmentService:
    """Post a correcting JE for an error found in a closed fiscal year."""

    @staticmethod
    def post_adjustment(
        *,
        organization,
        target_fiscal_year,
        current_fiscal_period,
        lines,
        reason,
        user=None,
        dry_run=False,
    ):
        """Post a PPA JE to the current open period.

        Args:
            organization: Organization instance.
            target_fiscal_year: the CLOSED/FINALIZED year being corrected.
                Cannot be OPEN — use a normal JE for open years.
            current_fiscal_period: the OPEN period where the PPA JE lives.
                Cannot be CLOSED/LOCKED.
            lines: list of dicts — {account_id, debit, credit, description}.
                P&L-type accounts (INCOME/EXPENSE) are AUTOMATICALLY
                redirected to Retained Earnings so current-year P&L
                stays clean. BS accounts pass through as-is.
            reason: required free-text explaining the reason for
                adjustment. Gets stamped into the JE description AND
                into a ForensicAuditLog entry. No reason → refused.
            user: optional — stamped on the JE.
            dry_run: if True, build the JE structure and return it without
                posting. Useful for preview.

        Returns:
            {'journal_entry_id': int | None, 'lines': [...], 'redirected_count': int}
        """
        from apps.finance.models import (
            ChartOfAccount, FiscalYear, FiscalPeriod, PostingRule,
        )

        # ── Pre-flight gates ──────────────────────────────
        if not reason or not reason.strip():
            raise ValidationError(
                "PPA requires a non-empty `reason` — this becomes the "
                "only forensic breadcrumb for why the adjustment was made."
            )

        if target_fiscal_year.status not in ('CLOSED', 'FINALIZED'):
            raise ValidationError(
                f"Target year {target_fiscal_year.name} is "
                f"{target_fiscal_year.status} — PPA only applies to "
                f"CLOSED or FINALIZED years. For open years, post a "
                f"normal JE."
            )

        if current_fiscal_period.status != 'OPEN':
            raise ValidationError(
                f"Current period {current_fiscal_period.name} is "
                f"{current_fiscal_period.status} — the PPA JE must land "
                f"in an OPEN period so it can be audited and posted."
            )

        if not lines:
            raise ValidationError("PPA requires at least one line")

        # ── Resolve Retained Earnings account ──
        re_account = PriorPeriodAdjustmentService._resolve_re_account(organization)

        # ── Normalize lines: redirect P&L → RE ──
        account_ids = [
            int(l['account_id']) for l in lines
            if l.get('account_id') is not None
        ]
        accounts_by_id = {
            a.id: a for a in ChartOfAccount.objects.filter(
                organization=organization, id__in=account_ids,
            )
        }
        missing = set(account_ids) - set(accounts_by_id)
        if missing:
            raise ValidationError(
                f"Unknown account IDs in PPA lines: {sorted(missing)}"
            )

        normalized = []
        redirected_count = 0
        re_pool = Decimal('0.00')
        for idx, raw in enumerate(lines):
            acc_id = int(raw.get('account_id'))
            acc = accounts_by_id[acc_id]
            debit = Decimal(str(raw.get('debit') or 0))
            credit = Decimal(str(raw.get('credit') or 0))
            desc = raw.get('description') or f"PPA adjustment line {idx+1}"

            if acc.type in ('INCOME', 'EXPENSE'):
                # Redirect P&L impact to RE. Net P&L effect = credit-debit
                # for revenue normal-credit, but we preserve sign by
                # directly adding to re_pool with the same direction.
                net = debit - credit
                re_pool += net
                redirected_count += 1
                # Don't add the original P&L line; RE replaces it below.
                continue

            # Balance-sheet account: pass through as-is
            normalized.append({
                'account_id': acc_id,
                'debit': debit,
                'credit': credit,
                'description': (
                    f"PPA ({target_fiscal_year.name}): {desc}"
                ),
            })

        # If any P&L lines were redirected, emit a single RE offsetting line
        if re_pool != Decimal('0.00'):
            if re_pool > 0:
                # Net was a debit → RE gets debited (equity down)
                normalized.append({
                    'account_id': re_account.id,
                    'debit': re_pool,
                    'credit': Decimal('0.00'),
                    'description': (
                        f"PPA ({target_fiscal_year.name}) — "
                        f"P&L impact routed to Retained Earnings"
                    ),
                })
            else:
                # Net was a credit → RE gets credited (equity up)
                normalized.append({
                    'account_id': re_account.id,
                    'debit': Decimal('0.00'),
                    'credit': -re_pool,
                    'description': (
                        f"PPA ({target_fiscal_year.name}) — "
                        f"P&L impact routed to Retained Earnings"
                    ),
                })

        # ── Validate lines balance ──────────────────────
        total_d = sum((l['debit'] for l in normalized), Decimal('0.00'))
        total_c = sum((l['credit'] for l in normalized), Decimal('0.00'))
        if (total_d - total_c).copy_abs() > Decimal('0.01'):
            raise ValidationError(
                f"PPA lines out of balance: ΣDr={total_d}, ΣCr={total_c}, "
                f"diff={total_d - total_c}. Every adjustment must be "
                f"double-entry balanced."
            )

        description = (
            f"Prior Period Adjustment → {target_fiscal_year.name} | "
            f"Reason: {reason.strip()[:180]}"
        )

        if dry_run:
            return {
                'journal_entry_id': None,
                'lines': [
                    {**l, 'debit': str(l['debit']), 'credit': str(l['credit'])}
                    for l in normalized
                ],
                'redirected_count': redirected_count,
                'target_fiscal_year': target_fiscal_year.name,
                'total_debit': str(total_d),
                'total_credit': str(total_c),
                'description': description,
                'dry_run': True,
            }

        # ── Post the JE + forensic audit ──────────────
        from apps.finance.services.ledger_core import LedgerCoreMixin
        with transaction.atomic():
            je = LedgerCoreMixin.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=description,
                lines=normalized,
                status='POSTED',
                scope='OFFICIAL',
                user=user,
                journal_type='ADJUSTMENT',
                journal_role='SYSTEM_ADJUSTMENT',
                source_module='finance',
                source_model='FiscalYearPPA',
                source_id=target_fiscal_year.id,
                internal_bypass=True,
            )

            # Forensic log — survives even if the JE is later reversed.
            try:
                from apps.finance.services.audit_service import ForensicAuditService
                ForensicAuditService.log_mutation(
                    organization=organization, user=user,
                    model_name='FiscalYearPPA',
                    object_id=target_fiscal_year.id,
                    change_type='PRIOR_PERIOD_ADJUSTMENT',
                    payload={
                        'target_year': target_fiscal_year.name,
                        'current_period': current_fiscal_period.name,
                        'reason': reason,
                        'redirected_pl_lines': redirected_count,
                        'total_debit': str(total_d),
                        'total_credit': str(total_c),
                        'journal_entry_id': je.id,
                        'journal_entry_reference': je.reference,
                    },
                )
            except Exception as exc:
                logger.warning("PPA audit log write failed: %s", exc)

        logger.info(
            "PPA: target=%s JE=%s (%s) reason=%s redirected=%s",
            target_fiscal_year.name, je.id, je.reference,
            reason[:60], redirected_count,
        )
        return {
            'journal_entry_id': je.id,
            'journal_entry_reference': je.reference,
            'lines': [
                {**l, 'debit': str(l['debit']), 'credit': str(l['credit'])}
                for l in normalized
            ],
            'redirected_count': redirected_count,
            'target_fiscal_year': target_fiscal_year.name,
            'total_debit': str(total_d),
            'total_credit': str(total_c),
            'dry_run': False,
        }

    @staticmethod
    def _resolve_re_account(organization):
        from apps.finance.models import ChartOfAccount, PostingRule

        # Try posting rule first
        rule = (
            PostingRule.objects
            .filter(
                organization=organization,
                event_code='equity.retained_earnings.transfer',
                is_active=True,
            )
            .select_related('account').first()
        )
        if rule and rule.account:
            return rule.account

        # Fall back to system_role
        acc = ChartOfAccount.objects.filter(
            organization=organization,
            system_role='RETAINED_EARNINGS',
            is_active=True,
        ).first()
        if not acc:
            raise ValidationError(
                "No Retained Earnings account configured. Either set "
                "`system_role='RETAINED_EARNINGS'` on the RE account, or "
                "configure the posting rule `equity.retained_earnings.transfer`."
            )
        return acc

    @staticmethod
    def list_adjustments(organization, target_fiscal_year=None):
        """List all PPA JEs, optionally filtered to a specific target year.

        Shape: [{id, reference, transaction_date, description,
                 total_debit, total_credit, target_year}]
        """
        from apps.finance.models import JournalEntry
        qs = JournalEntry.objects.filter(
            organization=organization,
            journal_type='ADJUSTMENT',
            journal_role='SYSTEM_ADJUSTMENT',
            source_model='FiscalYearPPA',
            status='POSTED',
            is_superseded=False,
        )
        if target_fiscal_year is not None:
            qs = qs.filter(source_id=target_fiscal_year.id)
        return qs.order_by('-transaction_date', '-id')
