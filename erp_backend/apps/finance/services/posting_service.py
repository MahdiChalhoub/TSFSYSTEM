"""
Payment Posting Service
=======================
Enterprise-grade GL posting for Payment documents.

Uses PostingResolver + PostingEvents for centralized COA resolution.
Supports: Supplier Payments, Customer Receipts, scope propagation,
and audit-grade posting snapshots.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

from apps.finance.services.posting_resolver import PostingResolver, PostingEvents

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


class PaymentPostingService:
    """Manages the lifecycle of posting a Payment to the General Ledger."""

    @staticmethod
    @transaction.atomic
    def post_payment(payment, user=None):
        """
        Takes a DRAFT payment, validates its scope against linked documents,
        creates the corresponding POSTED JournalEntry, and marks the payment POSTED.
        """
        if payment.status == 'POSTED':
            return payment

        from apps.finance.services import LedgerService
        from apps.finance.models import FinancialAccount

        organization = payment.organization

        # ── Enforce scope propagation ─────────────────────────────────
        if payment.invoice and payment.scope != payment.invoice.scope:
            raise ValidationError(
                f"Scope mismatch: Payment scope ({payment.scope}) must match "
                f"Invoice scope ({payment.invoice.scope})."
            )

        # ── Resolve cash/bank account from FinancialAccount ──────────
        fin_acc = FinancialAccount.objects.filter(
            id=payment.payment_account_id, organization=organization
        ).first()
        cash_acc = fin_acc.ledger_account_id if fin_acc else None

        if not cash_acc:
            raise ValidationError(
                "Cannot post payment: Cash/Bank account not configured or linked. "
                "Go to Finance → Settings → Payment Methods."
            )

        # ── Resolve counter-party account via PostingResolver ────────
        lines = []

        if payment.type == 'SUPPLIER_PAYMENT':
            event_code = PostingEvents.PURCHASES_PAYABLE
            resolved = PostingResolver.resolve_required(organization, [event_code])
            ap_acc = resolved[event_code]

            lines = [
                {"account_id": ap_acc, "debit": payment.amount, "credit": ZERO,
                 "description": "AP reduction"},
                {"account_id": cash_acc, "debit": ZERO, "credit": payment.amount,
                 "description": "Cash/Bank outflow"},
            ]
            desc_prefix = "Supplier Payment"

        elif payment.type == 'CUSTOMER_RECEIPT':
            event_code = PostingEvents.SALES_RECEIVABLE
            resolved = PostingResolver.resolve_required(organization, [event_code])
            ar_acc = resolved[event_code]

            lines = [
                {"account_id": cash_acc, "debit": payment.amount, "credit": ZERO,
                 "description": "Cash/Bank inflow"},
                {"account_id": ar_acc, "debit": ZERO, "credit": payment.amount,
                 "description": "AR reduction"},
            ]
            desc_prefix = "Customer Receipt"
        else:
            raise ValidationError(
                f"Unknown payment type: {payment.type} cannot be posted. "
                f"Supported types: SUPPLIER_PAYMENT, CUSTOMER_RECEIPT."
            )

        # ── Capture posting snapshot ──────────────────────────────────
        snapshot_codes = [event_code]
        posting_snapshot = PostingResolver.capture_snapshot(organization, snapshot_codes)

        # ── Create Journal Entry ──────────────────────────────────────
        description = payment.description or payment.reference or f"Payment {payment.id}"

        journal_entry = LedgerService.create_journal_entry(
            organization=organization,
            transaction_date=payment.payment_date,
            description=f"{desc_prefix}: {description}",
            reference=f"PAY-{payment.id}",
            status='POSTED',
            scope=payment.scope,
            user=user,
            lines=lines,
        )

        # Store snapshot on JE if the field exists
        if hasattr(journal_entry, 'posting_snapshot'):
            journal_entry.posting_snapshot = posting_snapshot
            journal_entry.save(update_fields=['posting_snapshot'])

        # ── Update payment ────────────────────────────────────────────
        payment.journal_entry = journal_entry
        payment.status = 'POSTED'
        payment.save(update_fields=['journal_entry', 'status'])

        logger.info(
            "Posted %s %s (%.2f) → JE %s with %d lines",
            desc_prefix, payment.id,
            payment.amount, journal_entry.id, len(lines),
        )

        return payment
