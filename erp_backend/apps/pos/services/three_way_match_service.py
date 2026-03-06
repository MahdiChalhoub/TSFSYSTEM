"""
ThreeWayMatchService — 3-Way Matching Engine

Validates supplier invoices against Purchase Orders and Goods Receipt Notes.

Core Rule:
    invoice_qty ≤ received_qty - already_invoiced_qty

If violated:
    Invoice.status = 'DISPUTED'
    Invoice.payment_blocked = True

Concurrency Protection:
    Uses select_for_update() on PO lines within an atomic transaction
    to prevent double-invoicing of the same received quantity.
"""
from decimal import Decimal
from django.db import transaction
import logging

logger = logging.getLogger(__name__)


class ThreeWayMatchService:
    """Validates supplier invoices against PO and GRN (3-way match)."""

    @staticmethod
    def validate_invoice(invoice):
        """
        For each invoice line linked to a PO line, verify:
          invoice_qty ≤ allowed_qty

        Where allowed_qty depends on the PO's invoice_policy:
          RECEIVED_QTY (default): allowed = received_qty - already_invoiced_qty
          ORDERED_QTY:            allowed = ordered_qty - already_invoiced_qty

        Uses select_for_update() for concurrency safety — prevents
        two simultaneous invoices from double-claiming the same qty.

        Returns: (is_valid: bool, violations: list[dict])
        """
        violations = []
        disputed_amount_delta = Decimal('0')

        with transaction.atomic():
            for inv_line in invoice.lines.all():
                po_line = getattr(inv_line, 'purchase_order_line', None)
                if not po_line:
                    continue

                # Lock the PO line row to prevent concurrent validation
                from apps.pos.models import PurchaseOrderLine
                locked_line = PurchaseOrderLine.objects.select_for_update().get(pk=po_line.pk)

                # Determine allowed qty based on invoice_policy
                policy = getattr(locked_line.order, 'invoice_policy', 'RECEIVED_QTY')
                if policy == 'ORDERED_QTY':
                    base_qty = locked_line.quantity
                else:
                    base_qty = locked_line.qty_received

                allowed_qty = base_qty - locked_line.qty_invoiced

                if inv_line.quantity > allowed_qty:
                    excess = inv_line.quantity - allowed_qty
                    violations.append({
                        'line_id': inv_line.id,
                        'product': str(locked_line.product),
                        'invoice_qty': float(inv_line.quantity),
                        'allowed_qty': float(allowed_qty),
                        'excess': float(excess),
                        'excess_amount': float(excess * locked_line.unit_price),
                    })
                    disputed_amount_delta += excess * locked_line.unit_price

            if violations:
                invoice.status = 'DISPUTED'
                invoice.payment_blocked = True
                invoice.disputed_lines_count = len(violations)
                invoice.disputed_amount_delta = disputed_amount_delta
                invoice.dispute_reason = (
                    f"3-way match failed: {len(violations)} line(s) exceed "
                    f"{'received' if policy == 'RECEIVED_QTY' else 'ordered'} qty. "
                    f"Total excess amount: {disputed_amount_delta:,.2f}"
                )
                invoice.save(update_fields=[
                    'status', 'payment_blocked', 'dispute_reason',
                    'disputed_lines_count', 'disputed_amount_delta'
                ])
                logger.warning(
                    f"Invoice {invoice.invoice_number} DISPUTED: "
                    f"{len(violations)} violations, delta={disputed_amount_delta:,.2f}"
                )
                return False, violations

        return True, []

    @staticmethod
    def clear_dispute(invoice):
        """Clear a dispute after manual resolution (e.g. qty adjustment, credit note)."""
        invoice.status = 'POSTED'
        invoice.payment_blocked = False
        invoice.dispute_reason = None
        invoice.save(update_fields=['status', 'payment_blocked', 'dispute_reason'])
        logger.info(f"Invoice {invoice.invoice_number} dispute cleared, payment unblocked")
