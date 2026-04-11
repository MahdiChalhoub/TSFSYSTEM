"""
Migration Ledger Integrator
============================
Posts migrated Orders and Purchases to the Financial Ledger.

Uses PostingResolver + PostingEvents for centralized COA resolution.
Ensures historical data from UltimatePOS or other systems is correctly
reflected in TSF Trial Balance and Account Statements.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.pos.models import Order
from apps.finance.services.posting_resolver import PostingResolver, PostingEvents

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


class MigrationLedgerIntegrator:
    """
    Handles posting of migrated Orders and Purchases to the Financial Ledger.
    This ensures that historical data migrated from Third Party modules
    is correctly reflected in TSF Trial Balance and Account Statements.
    """

    @staticmethod
    def post_order_to_ledger(order: Order, user=None):
        """
        Calculates and creates a JournalEntry for a migrated Order.
        Resolves all accounts via PostingResolver — fails loudly on missing config.
        """
        from apps.finance.services import LedgerService

        organization = order.organization

        # ── Resolve ALL required accounts in one batch ────────────────
        required_events = [
            PostingEvents.SALES_REVENUE,
            PostingEvents.SALES_INVENTORY,
            PostingEvents.SALES_COGS,
            PostingEvents.SALES_RECEIVABLE,
        ]
        resolved = PostingResolver.resolve_required(organization, required_events)

        rev_acc = resolved[PostingEvents.SALES_REVENUE]
        inv_acc = resolved[PostingEvents.SALES_INVENTORY]
        cogs_acc = resolved[PostingEvents.SALES_COGS]
        receivable_acc = resolved[PostingEvents.SALES_RECEIVABLE]

        # Tax account is optional (some migrated sales may be tax-exempt)
        tax_acc = PostingResolver.resolve(
            organization, PostingEvents.SALES_VAT_COLLECTED, required=False
        )

        # ── Sum up Line Items ─────────────────────────────────────────
        lines = order.lines.all()
        total_tax = order.tax_amount or ZERO
        total_amount = order.total_amount or ZERO
        total_cogs = sum(
            line.quantity * (line.unit_cost_ht or ZERO) for line in lines
        )
        revenue_credit = max(ZERO, total_amount - total_tax)

        # ── Build Journal Entry Lines ─────────────────────────────────
        je_lines = [
            {"account_id": rev_acc, "debit": ZERO, "credit": revenue_credit,
             "description": "Sales Revenue (migrated)"},
        ]

        # Tax line only if there's actual tax
        if total_tax > ZERO and tax_acc:
            je_lines.append({
                "account_id": tax_acc, "debit": ZERO, "credit": total_tax,
                "description": "VAT Output (migrated)",
            })
        elif total_tax > ZERO and not tax_acc:
            # No tax account configured — include tax in revenue
            logger.warning(
                "Migration: No VAT account configured, tax %.2f for Order %s "
                "included in revenue line.", total_tax, order.id,
            )
            je_lines[0]["credit"] = total_amount  # full amount to revenue

        # COGS + Inventory reduction (only if there's cost data)
        if total_cogs > ZERO:
            je_lines.extend([
                {"account_id": cogs_acc, "debit": total_cogs, "credit": ZERO,
                 "description": "Cost of Goods Sold (migrated)"},
                {"account_id": inv_acc, "debit": ZERO, "credit": total_cogs,
                 "description": "Inventory Reduction (migrated)"},
            ])

        # ── Payment / Receivable side ─────────────────────────────────
        payment_acc_id = receivable_acc
        if order.payment_method != 'CREDIT':
            from apps.finance.models import FinancialAccount
            fa = FinancialAccount.objects.filter(
                organization=organization, type='CASH'
            ).first()
            if fa and fa.ledger_account_id:
                payment_acc_id = fa.ledger_account_id

        je_lines.append({
            "account_id": payment_acc_id, "debit": total_amount, "credit": ZERO,
            "description": f"{'Cash Receipt' if payment_acc_id != receivable_acc else 'AR'} (migrated)",
        })

        # ── Capture posting snapshot ──────────────────────────────────
        snapshot_codes = required_events[:]
        if tax_acc:
            snapshot_codes.append(PostingEvents.SALES_VAT_COLLECTED)
        posting_snapshot = PostingResolver.capture_snapshot(organization, snapshot_codes)

        # ── Create Journal Entry ──────────────────────────────────────
        with transaction.atomic():
            je = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=order.created_at or timezone.now(),
                description=f"Migrated Sale {order.invoice_number or order.ref_code}",
                reference=f"MIG-POS-{order.id}",
                status='POSTED',
                scope=order.scope or 'INTERNAL',
                site_id=order.site_id,
                user=user,
                lines=je_lines,
            )

            # Store snapshot if field exists
            if hasattr(je, 'posting_snapshot'):
                je.posting_snapshot = posting_snapshot
                je.save(update_fields=['posting_snapshot'])

            logger.info(
                "Migration posted Order %s (%.2f) → JE %s with %d lines",
                order.id, total_amount, je.id, len(je_lines),
            )
            return je

    @staticmethod
    def bulk_post_migration(job_id, entity_type='TRANSACTION', user=None):
        """Perform bulk ledger integration for a migration job."""
        from apps.migration.models import MigrationMapping

        mappings = MigrationMapping.objects.filter(
            job_id=job_id,
            entity_type=entity_type,
            audit_status='PENDING',
        )

        count = 0
        errors = 0

        for m in mappings:
            try:
                order = Order.objects.get(id=m.target_id)
                MigrationLedgerIntegrator.post_order_to_ledger(order, user=user)
                m.audit_status = 'VERIFIED'
                m.audit_at = timezone.now()
                if user:
                    m.audited_by = user
                m.save()
                count += 1
            except Exception as e:
                logger.error(
                    "Bulk post failed for Order %s: %s", m.target_id, str(e),
                )
                m.audit_status = 'FLAGGED'
                m.audit_notes = f"Ledger Integration Error: {str(e)}"
                m.save()
                errors += 1

        logger.info(
            "Bulk migration posting complete: %d succeeded, %d errors", count, errors,
        )
        return count, errors
