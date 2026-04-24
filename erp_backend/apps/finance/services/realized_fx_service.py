"""
Realized FX service — posts the exchange-rate variance JE when a
foreign-currency invoice is settled at a rate that differs from its
booking rate.

Accounting treatment:
    AR invoice booked at rate 1.10 → functional 1,100 on 1,000 foreign
    Payment received at rate 1.12 → functional 1,120 on 1,000 foreign
    Realized FX gain = 20 (functional)
        Dr Cash (or clearing)   20
        Cr FX_GAIN              20

For AP the direction flips. Loss is the reverse posting to FX_LOSS.

The function is the SINGLE correct place to compute realized variance;
integrating callers (payment viewset, bank-feed matcher, manual payment
posting) all invoke `post_realized_variance` rather than each writing
their own variance JE.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class RealizedFXService:
    """One entry-point for invoice-settlement FX variance posting."""

    TOLERANCE = Decimal('0.01')  # below 1¢ of variance → skip (rounding)

    @staticmethod
    def post_realized_variance(
        *,
        invoice,
        payment_amount_foreign,
        payment_rate,
        payment_date=None,
        user=None,
    ):
        """Compute and post the realized FX variance JE for one
        payment event against one invoice.

        Args:
            invoice: Invoice row (must have `currency`, `exchange_rate`
                fields populated at booking time).
            payment_amount_foreign: Decimal — amount paid in the invoice's
                foreign currency (not functional).
            payment_rate: Decimal — foreign→functional conversion rate at
                payment time.
            payment_date: optional datetime (default: now).
            user: optional — stamped on the JE.

        Returns the created JournalEntry, or None if variance is below
        tolerance (no JE written).

        Idempotency is the CALLER's responsibility: wire this into your
        payment-posting flow exactly once per payment event.
        """
        from apps.finance.services.ledger_core import LedgerCoreMixin
        from apps.finance.models import (
            PostingRule, ChartOfAccount,
        )

        org = invoice.organization
        if not org:
            raise ValidationError("Invoice has no organization context")

        booking_rate = invoice.exchange_rate or Decimal('1')
        amount_foreign = Decimal(str(payment_amount_foreign))
        pay_rate = Decimal(str(payment_rate))

        # Variance = change in functional-currency value of the same
        # foreign amount due to rate movement between booking and payment
        variance = (pay_rate - booking_rate) * amount_foreign
        if variance.copy_abs() <= RealizedFXService.TOLERANCE:
            return None  # rounding — skip

        # Resolve FX_GAIN / FX_LOSS accounts via posting rules
        gain_acc = ChartOfAccount.objects.filter(
            organization=org, system_role='FX_GAIN', is_active=True,
        ).first()
        loss_acc = ChartOfAccount.objects.filter(
            organization=org, system_role='FX_LOSS', is_active=True,
        ).first()
        if not gain_acc or not loss_acc:
            raise ValidationError(
                "FX_GAIN / FX_LOSS accounts not configured — cannot post "
                "realized variance. Set system_role='FX_GAIN' on the gain "
                "account and 'FX_LOSS' on the loss account."
            )

        # Resolve counterparty anchor — AR for customer invoice,
        # AP for supplier invoice. Detection via invoice.partner_type
        # if present, falling back on invoice.organization's posting-rule
        # configuration.
        is_receivable = RealizedFXService._detect_is_receivable(invoice)
        if is_receivable:
            counter_acc = ChartOfAccount.objects.filter(
                organization=org, system_role='RECEIVABLE', is_active=True,
            ).first()
        else:
            counter_acc = ChartOfAccount.objects.filter(
                organization=org, system_role='PAYABLE', is_active=True,
            ).first()
        if not counter_acc:
            raise ValidationError(
                f"No {'RECEIVABLE' if is_receivable else 'PAYABLE'} "
                f"control account set on this organisation"
            )

        # Build the JE. Sign conventions:
        #   AR, positive variance (rate up)  → unrealized gain realised:
        #      Dr AR variance / Cr FX_GAIN   (AR carrying amount bumps up)
        #   AR, negative variance (rate down) → realised loss:
        #      Dr FX_LOSS / Cr AR
        #   AP flips both: carrying amount on AP is a credit balance, so
        #      positive variance = larger payable in functional = LOSS.
        abs_var = variance.copy_abs()
        if is_receivable:
            is_gain = variance > 0
        else:
            is_gain = variance < 0  # AP: rate up means we owe more → loss

        if is_gain:
            lines = [
                {'account_id': counter_acc.id, 'debit': abs_var, 'credit': Decimal('0'),
                 'description': f"Realized FX gain on invoice {invoice.id}"},
                {'account_id': gain_acc.id, 'debit': Decimal('0'), 'credit': abs_var,
                 'description': f"Realized FX gain (rate {booking_rate}→{pay_rate})"},
            ]
        else:
            lines = [
                {'account_id': loss_acc.id, 'debit': abs_var, 'credit': Decimal('0'),
                 'description': f"Realized FX loss (rate {booking_rate}→{pay_rate})"},
                {'account_id': counter_acc.id, 'debit': Decimal('0'), 'credit': abs_var,
                 'description': f"Realized FX loss on invoice {invoice.id}"},
            ]

        # Post
        when = payment_date or timezone.now()
        je = LedgerCoreMixin.create_journal_entry(
            organization=org,
            transaction_date=when,
            description=(
                f"Realized FX {'gain' if is_gain else 'loss'} — "
                f"Invoice #{invoice.id} ({invoice.currency} {amount_foreign} "
                f"@ {pay_rate} vs booked {booking_rate})"
            ),
            lines=lines,
            status='POSTED',
            scope='OFFICIAL',
            user=user,
            journal_type='ADJUSTMENT',
            journal_role='SYSTEM_ADJUSTMENT',
            source_module='finance',
            source_model='Invoice',
            source_id=invoice.id,
            internal_bypass=True,
        )
        logger.info(
            "RealizedFX: invoice=%s variance=%s %s JE=%s",
            invoice.id, variance, 'gain' if is_gain else 'loss', je.id,
        )
        return je

    @staticmethod
    def _detect_is_receivable(invoice):
        """Best-effort detection: sales invoice → AR, purchase → AP.
        Falls back to AR if ambiguous (more common case)."""
        itype = getattr(invoice, 'invoice_type', None)
        if itype in ('PURCHASE', 'SUPPLIER', 'AP', 'BILL'):
            return False
        if itype in ('SALES', 'CUSTOMER', 'AR'):
            return True
        # Fall back on the counterparty relation
        if getattr(invoice, 'supplier_id', None):
            return False
        return True

    # ── Canary signal ──────────────────────────────────────
    @staticmethod
    def check_realized_fx_integrity(organization):
        """Detect foreign-currency invoices fully settled but with no
        corresponding realized-FX ADJUSTMENT JE.

        Heuristic: for each PAID Invoice whose currency differs from
        the org's base currency AND whose paid_amount > 0, look for a
        JournalEntry with source_model='Invoice' and source_id=invoice.id
        in journal_type='ADJUSTMENT' + journal_role='SYSTEM_ADJUSTMENT'
        with an FX_GAIN or FX_LOSS account line. Missing → flag.

        Skipped silently when no base currency is configured (org
        doesn't use multi-currency).
        """
        from apps.finance.models import (
            ChartOfAccount, JournalEntryLine,
        )
        report = {
            'organization_id': organization.id,
            'organization_slug': getattr(organization, 'slug', None),
            'clean': True,
            'missing_realized_fx': [],
        }

        try:
            from apps.finance.models import Currency
            base = Currency.objects.filter(organization=organization, is_base=True).first()
            from apps.finance.invoice_models import Invoice
        except Exception:
            return report  # multi-currency not installed
        if not base:
            return report

        # FX accounts used to identify a "realized FX" JE
        fx_account_ids = set(
            ChartOfAccount.objects.filter(
                organization=organization,
                system_role__in=('FX_GAIN', 'FX_LOSS'),
                is_active=True,
            ).values_list('id', flat=True)
        )
        if not fx_account_ids:
            return report  # FX accounts not configured → nothing to check

        # Foreign-currency PAID invoices
        foreign_paid = Invoice.objects.filter(
            organization=organization, status='PAID',
        ).exclude(currency=base.code).exclude(currency__isnull=True).exclude(currency='')

        for inv in foreign_paid:
            # Did we post a realized-FX JE for this invoice?
            has_fx_je = JournalEntryLine.objects.filter(
                organization=organization,
                account_id__in=fx_account_ids,
                journal_entry__status='POSTED',
                journal_entry__is_superseded=False,
                journal_entry__source_model='Invoice',
                journal_entry__source_id=inv.id,
            ).exists()
            if not has_fx_je:
                report['missing_realized_fx'].append({
                    'invoice_id': inv.id,
                    'currency': inv.currency,
                    'amount': str(inv.total_amount),
                    'booking_rate': str(inv.exchange_rate or 0),
                })
                report['clean'] = False

        return report
