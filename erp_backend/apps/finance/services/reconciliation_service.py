"""
Reconciliation Service — Unified engine for AR/AP/Bank matching.

Used for:
  - Invoice vs. payment matching (AR)
  - Supplier bill vs. payment matching (AP)
  - Bank statement line matching
  - Advance payment settlement
  - Customer credit settlement

Status flow: UNRECONCILED → PARTIALLY_RECONCILED → FULLY_RECONCILED
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class ReconciliationService:
    """Unified reconciliation engine for AR/AP/Bank accounts."""

    @staticmethod
    def create_match(
        organization, account_id, journal_line_ids,
        match_type='MANUAL', reference=None, notes=None,
        partner_type=None, partner_id=None, user=None
    ):
        """
        Create a reconciliation match from a set of journal entry lines.

        Rules:
          - All lines must belong to the same account
          - Net of matched amounts should be zero for MATCHED status
          - If net is non-zero, status is PARTIAL
        """
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine,
            ReconciliationMatch, ReconciliationLine
        )

        account = ChartOfAccount.objects.get(id=account_id, organization=organization)

        # Validate account is reconcilable
        if not account.allow_reconciliation:
            raise ValidationError(
                f"Account '{account.code} - {account.name}' does not support reconciliation."
            )

        # Fetch the lines
        lines = JournalEntryLine.objects.filter(
            id__in=journal_line_ids,
            organization=organization,
            account=account,
            journal_entry__status='POSTED',
        )

        if lines.count() < 2:
            raise ValidationError(
                "At least 2 posted journal entry lines are required for reconciliation."
            )

        # Calculate net
        total_debit = sum(l.debit for l in lines)
        total_credit = sum(l.credit for l in lines)
        net = total_debit - total_credit
        matched_amount = min(total_debit, total_credit)

        # Determine status
        if abs(net) <= Decimal('0.01'):
            status = 'MATCHED'
        else:
            status = 'PARTIAL'

        with transaction.atomic():
            match = ReconciliationMatch.objects.create(
                organization=organization,
                account=account,
                match_type=match_type,
                status=status,
                reference=reference,
                notes=notes,
                partner_type=partner_type or (lines.first().partner_type if lines.first() else None),
                partner_id=partner_id or (lines.first().partner_id if lines.first() else None),
                matched_amount=matched_amount,
                write_off_amount=abs(net) if abs(net) > Decimal('0.01') else Decimal('0.00'),
                matched_by=user,
            )

            for line in lines:
                is_debit = line.debit > Decimal('0')
                amount = line.debit if is_debit else line.credit

                ReconciliationLine.objects.create(
                    organization=organization,
                    reconciliation=match,
                    journal_entry_line=line,
                    matched_amount=amount,
                    is_debit_side=is_debit,
                )

                # Update JEL reconciliation status
                line.reconciled_amount += amount
                total_line_amount = line.debit + line.credit  # Total absolute amount
                if total_line_amount > Decimal('0') and line.reconciled_amount >= total_line_amount:
                    line.is_reconciled = True
                line.save()

            logger.info(
                f"ReconciliationService: Created {status} match for "
                f"account {account.code} with {lines.count()} lines. "
                f"Matched: {matched_amount}, Remaining: {abs(net)}"
            )
            return match

    @staticmethod
    def unmatch(organization, match_id, user=None):
        """
        Unmatch a reconciliation — reverses the reconciled status on all lines.
        """
        from apps.finance.models import ReconciliationMatch

        match = ReconciliationMatch.objects.get(id=match_id, organization=organization)

        with transaction.atomic():
            for recon_line in match.lines.all():
                jel = recon_line.journal_entry_line
                jel.reconciled_amount -= recon_line.matched_amount
                if jel.reconciled_amount < Decimal('0'):
                    jel.reconciled_amount = Decimal('0.00')
                jel.is_reconciled = False
                jel.save()

            match.status = 'BROKEN'
            match.unmatched_at = timezone.now()
            match.unmatched_by = user
            match.save()

            logger.info(
                f"ReconciliationService: Unmatched recon-{match_id} "
                f"for account {match.account.code}"
            )
            return match

    @staticmethod
    def auto_match(organization, account_id, user=None):
        """
        Automatic reconciliation: find offsetting debits and credits
        for the same partner and try to match them.

        Algorithm:
          1. Group unreconciled lines by partner
          2. For each partner, try to match debits to credits
          3. Create ReconciliationMatch for each matched set
        """
        from apps.finance.models import ChartOfAccount, JournalEntryLine

        account = ChartOfAccount.objects.get(id=account_id, organization=organization)

        # Get all unreconciled lines for this account
        unreconciled = JournalEntryLine.objects.filter(
            organization=organization,
            account=account,
            is_reconciled=False,
            journal_entry__status='POSTED',
        ).order_by('journal_entry__transaction_date')

        # Group by partner
        partner_groups = {}
        for line in unreconciled:
            key = (line.partner_type, line.partner_id) if line.partner_type else ('_none_', line.contact_id)
            if key not in partner_groups:
                partner_groups[key] = {'debits': [], 'credits': []}
            if line.debit > Decimal('0'):
                partner_groups[key]['debits'].append(line)
            elif line.credit > Decimal('0'):
                partner_groups[key]['credits'].append(line)

        matched_count = 0
        for (ptype, pid), group in partner_groups.items():
            debits = group['debits']
            credits = group['credits']

            # Simple exact match: find debit-credit pairs with same amount
            for d in list(debits):
                for c in list(credits):
                    if d.debit == c.credit:
                        try:
                            ReconciliationService.create_match(
                                organization=organization,
                                account_id=account_id,
                                journal_line_ids=[d.id, c.id],
                                match_type='AUTO',
                                partner_type=ptype if ptype != '_none_' else None,
                                partner_id=pid,
                                user=user,
                            )
                            debits.remove(d)
                            credits.remove(c)
                            matched_count += 1
                            break
                        except ValidationError:
                            continue

        logger.info(
            f"ReconciliationService: Auto-matched {matched_count} pairs "
            f"for account {account.code}"
        )
        return matched_count

    @staticmethod
    def get_unreconciled_lines(organization, account_id, partner_type=None, partner_id=None):
        """Get all unreconciled lines for an account, optionally filtered by partner."""
        from apps.finance.models import JournalEntryLine

        qs = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=account_id,
            is_reconciled=False,
            journal_entry__status='POSTED',
        ).select_related('journal_entry').order_by('journal_entry__transaction_date')

        if partner_type:
            qs = qs.filter(partner_type=partner_type)
        if partner_id:
            qs = qs.filter(partner_id=partner_id)

        return qs

    @staticmethod
    def get_reconciliation_status(organization, account_id):
        """Summary statistics for an account's reconciliation state."""
        from apps.finance.models import JournalEntryLine
        from django.db.models import Sum, Count, Q

        stats = JournalEntryLine.objects.filter(
            organization=organization,
            account_id=account_id,
            journal_entry__status='POSTED',
        ).aggregate(
            total_lines=Count('id'),
            reconciled_lines=Count('id', filter=Q(is_reconciled=True)),
            unreconciled_lines=Count('id', filter=Q(is_reconciled=False)),
            total_debit=Sum('debit'),
            total_credit=Sum('credit'),
            unreconciled_debit=Sum('debit', filter=Q(is_reconciled=False)),
            unreconciled_credit=Sum('credit', filter=Q(is_reconciled=False)),
        )

        return {
            'total_lines': stats['total_lines'] or 0,
            'reconciled_lines': stats['reconciled_lines'] or 0,
            'unreconciled_lines': stats['unreconciled_lines'] or 0,
            'total_debit': stats['total_debit'] or Decimal('0.00'),
            'total_credit': stats['total_credit'] or Decimal('0.00'),
            'unreconciled_debit': stats['unreconciled_debit'] or Decimal('0.00'),
            'unreconciled_credit': stats['unreconciled_credit'] or Decimal('0.00'),
            'unreconciled_net': (stats['unreconciled_debit'] or Decimal('0.00')) - (stats['unreconciled_credit'] or Decimal('0.00')),
        }
