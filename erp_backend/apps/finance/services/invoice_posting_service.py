"""
Invoice Posting Service
=======================
Enterprise-grade GL posting for Invoice documents.

Uses PostingResolver + PostingEvents for centralized COA resolution.
Supports: Sales, Purchase, Credit Notes, Debit Notes, discounts, 
reverse charge, and audit-grade posting snapshots.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError

from apps.finance.services.posting_resolver import PostingResolver, PostingEvents

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


class InvoicePostingService:
    """Manages GL posting for Invoice documents."""

    # ── Event code mapping per invoice type ──────────────────────────────
    SALES_EVENTS = {
        'receivable': PostingEvents.SALES_RECEIVABLE,
        'revenue': PostingEvents.SALES_REVENUE,
        'tax': PostingEvents.SALES_VAT_COLLECTED,
        'discount': PostingEvents.SALES_DISCOUNT,
    }
    PURCHASE_EVENTS = {
        'payable': PostingEvents.PURCHASES_PAYABLE,
        'expense': PostingEvents.PURCHASES_EXPENSE,
        'tax': PostingEvents.PURCHASES_VAT_RECOVERABLE,
        'discount': PostingEvents.PURCHASES_DISCOUNT_EARNED,
        'airsi': PostingEvents.PURCHASES_AIRSI_PAYABLE,
        'reverse_charge': PostingEvents.PURCHASES_REVERSE_CHARGE,
    }

    @staticmethod
    @transaction.atomic
    def post_invoice(invoice, user=None):
        """
        Generates a balanced JournalEntry for an invoice document.

        Handles:
          - SALES / PURCHASE invoices (standard double-entry)
          - CREDIT_NOTE (reversed debit/credit)
          - DEBIT_NOTE (same as invoice of matching direction)
          - Global discount lines
          - Reverse charge VAT (purchase only)
          - Posting audit snapshot
        """
        if invoice.status == 'POSTED':
            return invoice

        # PROFORMA invoices are non-financial documents — no GL posting
        if invoice.type == 'PROFORMA':
            raise ValidationError(
                "Pro Forma invoices are non-financial documents and cannot be posted to the GL. "
                "Convert to a Sales Invoice first."
            )

        from apps.finance.services import LedgerService

        organization = invoice.organization
        inv_type = invoice.type

        # ── Determine direction and event codes ────────────────────────
        is_credit_note = inv_type == 'CREDIT_NOTE'
        is_debit_note = inv_type == 'DEBIT_NOTE'
        is_sales_direction = inv_type in ('SALES', 'PROFORMA') or (
            is_credit_note and getattr(invoice, 'source_order', None)
            and getattr(invoice.source_order, 'order_type', '') == 'SALES'
        )
        # Credit notes on purchase = supplier credit
        is_purchase_direction = inv_type == 'PURCHASE' or (
            is_credit_note and not is_sales_direction
        )

        if is_sales_direction:
            events = InvoicePostingService.SALES_EVENTS
            desc_prefix = 'Credit Note (Sales)' if is_credit_note else (
                'Debit Note (Sales)' if is_debit_note else 'Sales Invoice'
            )
        elif is_purchase_direction:
            events = InvoicePostingService.PURCHASE_EVENTS
            desc_prefix = 'Credit Note (Purchase)' if is_credit_note else (
                'Debit Note (Purchase)' if is_debit_note else 'Purchase Invoice'
            )
        else:
            raise ValidationError(
                f"Posting for invoice type '{inv_type}' is not yet implemented."
            )

        # ── Resolve required accounts ─────────────────────────────────
        # Determine which accounts are needed
        required_codes = [events['receivable' if is_sales_direction else 'payable']]
        required_codes.append(events['revenue' if is_sales_direction else 'expense'])
        optional_codes = []

        if invoice.tax_amount > ZERO:
            required_codes.append(events['tax'])
        if invoice.discount_amount > ZERO:
            optional_codes.append(events['discount'])
        if is_purchase_direction and getattr(invoice, 'is_reverse_charge', False):
            required_codes.append(events['reverse_charge'])

        # Batch-resolve all required accounts (raises single error listing all missing)
        resolved = PostingResolver.resolve_required(organization, required_codes)

        # Optional accounts (soft resolve)
        for code in optional_codes:
            acc = PostingResolver.resolve(organization, code, required=False)
            if acc:
                resolved[code] = acc

        # ── Build journal lines ───────────────────────────────────────
        # For credit notes, flip debit/credit
        flip = is_credit_note
        lines = []

        if is_sales_direction:
            ar_acc = resolved[events['receivable' if is_sales_direction else 'payable']]
            rev_acc = resolved[events['revenue' if is_sales_direction else 'expense']]

            # Line 1: AR (Debit) — flipped for credit notes
            lines.append({
                "account_id": ar_acc,
                "debit": ZERO if flip else invoice.total_amount,
                "credit": invoice.total_amount if flip else ZERO,
                "description": f"{'CR' if flip else 'AR'}: {invoice.contact_name or 'Customer'}",
            })

            # Line 2: Revenue (Credit)
            lines.append({
                "account_id": rev_acc,
                "debit": invoice.subtotal_ht if flip else ZERO,
                "credit": ZERO if flip else invoice.subtotal_ht,
                "description": f"{'Revenue Reversal' if flip else 'Sales Revenue'}",
            })

            # Line 3: VAT output (Credit)
            if invoice.tax_amount > ZERO:
                tax_acc = resolved[events['tax']]
                lines.append({
                    "account_id": tax_acc,
                    "debit": invoice.tax_amount if flip else ZERO,
                    "credit": ZERO if flip else invoice.tax_amount,
                    "description": f"{'VAT Output Reversal' if flip else 'VAT Output'}",
                })

            # Line 4: Discount (Debit for sales = contra-revenue)
            if invoice.discount_amount > ZERO and events['discount'] in resolved:
                disc_acc = resolved[events['discount']]
                lines.append({
                    "account_id": disc_acc,
                    "debit": ZERO if flip else invoice.discount_amount,
                    "credit": invoice.discount_amount if flip else ZERO,
                    "description": "Sales Discount",
                })

        elif is_purchase_direction:
            ap_acc = resolved[events['payable']]
            exp_acc = resolved[events['expense']]

            # Line 1: Expense (Debit)
            lines.append({
                "account_id": exp_acc,
                "debit": ZERO if flip else invoice.subtotal_ht,
                "credit": invoice.subtotal_ht if flip else ZERO,
                "description": f"{'Expense Reversal' if flip else 'Purchase Expense'}",
            })

            # Line 2: VAT Input (Debit)
            if invoice.tax_amount > ZERO:
                tax_acc = resolved[events['tax']]
                lines.append({
                    "account_id": tax_acc,
                    "debit": ZERO if flip else invoice.tax_amount,
                    "credit": invoice.tax_amount if flip else ZERO,
                    "description": f"{'VAT Input Reversal' if flip else 'VAT Input (Recoverable)'}",
                })

            # Line 3: Reverse Charge VAT (if applicable)
            if getattr(invoice, 'is_reverse_charge', False) and events.get('reverse_charge') in resolved:
                rc_acc = resolved[events['reverse_charge']]
                lines.append({
                    "account_id": rc_acc,
                    "debit": ZERO,
                    "credit": invoice.tax_amount,
                    "description": "Reverse Charge VAT",
                })
                # Offset: record as VAT payable too (self-assessment)
                lines.append({
                    "account_id": rc_acc,
                    "debit": invoice.tax_amount,
                    "credit": ZERO,
                    "description": "Reverse Charge VAT (Self-Assessed)",
                })

            # Line 4: Discount earned (Credit for purchases = income)
            if invoice.discount_amount > ZERO and events.get('discount') in resolved:
                disc_acc = resolved[events['discount']]
                lines.append({
                    "account_id": disc_acc,
                    "debit": invoice.discount_amount if flip else ZERO,
                    "credit": ZERO if flip else invoice.discount_amount,
                    "description": "Purchase Discount Earned",
                })

            # Line N: AP (Credit)
            lines.append({
                "account_id": ap_acc,
                "debit": invoice.total_amount if flip else ZERO,
                "credit": ZERO if flip else invoice.total_amount,
                "description": f"{'AP Reversal' if flip else 'AP'}: {invoice.contact_name or 'Supplier'}",
            })

        # ── Capture posting snapshot for audit trail ──────────────────
        snapshot_codes = list(set(required_codes + optional_codes))
        posting_snapshot = PostingResolver.capture_snapshot(organization, snapshot_codes)

        # ── Balance assertion — debits MUST equal credits ──────────────
        ref_number = invoice.invoice_number or f"INV-{invoice.id}"
        total_debit = sum(l.get('debit', ZERO) for l in lines)
        total_credit = sum(l.get('credit', ZERO) for l in lines)
        if total_debit != total_credit:
            raise ValidationError(
                f"Posting assertion failed: debits ({total_debit}) != credits ({total_credit}) "
                f"for invoice {ref_number}. This is a system error — please report it."
            )

        # ── Create Journal Entry ──────────────────────────────────────
        journal_entry = LedgerService.create_journal_entry(
            organization=organization,
            transaction_date=invoice.issue_date,
            description=f"{desc_prefix}: {ref_number}",
            reference=f"INV-{invoice.id}",
            status='POSTED',
            scope=invoice.scope,
            user=user,
            lines=lines,
        )

        # Store snapshot on JE if the field exists
        if hasattr(journal_entry, 'posting_snapshot'):
            journal_entry.posting_snapshot = posting_snapshot
            journal_entry.save(update_fields=['posting_snapshot'])

        # ── Update invoice ────────────────────────────────────────────
        invoice.journal_entry = journal_entry
        invoice.status = 'POSTED'
        invoice.save(update_fields=['journal_entry', 'status'])

        logger.info(
            "Posted %s %s (%.2f %s) → JE %s with %d lines",
            desc_prefix, ref_number,
            invoice.total_amount, invoice.currency,
            journal_entry.id, len(lines),
        )

        return journal_entry
