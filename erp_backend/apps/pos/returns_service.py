"""
Returns Service
===============
Business logic for sales returns, credit notes, and purchase returns.
Handles restocking, GL reversals, and credit note generation.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


def _safe_import(module_path, names):
    try:
        mod = __import__(module_path, fromlist=names)
        return tuple(getattr(mod, n) for n in names)
    except ImportError:
        logger.warning(f"Module '{module_path}' not installed — import skipped")
        return tuple(None for _ in names)


class ReturnsService:
    """Service for managing sales and purchase returns."""

    # ── Sales Returns ────────────────────────────────────────────────

    @staticmethod
    def create_sales_return(organization, order_id, return_date, lines, reason=None, user=None):
        """
        Create a sales return request.

        Args:
            organization: Organization instance
            order_id: ID of the original sale order
            return_date: Date of the return
            lines: list of {'original_line_id', 'quantity_returned', 'reason'}
            reason: Overall return reason
            user: User processing the return
        """
        from apps.pos.models import Order, OrderLine
        from apps.pos.returns_models import SalesReturn, SalesReturnLine

        with transaction.atomic():
            order = Order.objects.get(
                id=order_id, organization=organization, type='SALE'
            )
            if order.status not in ['COMPLETED', 'INVOICED']:
                raise ValidationError(
                    f"Cannot create return for order in status '{order.status}'. Must be COMPLETED or INVOICED."
                )

            # Generate return reference
            (SequenceService,) = _safe_import('apps.finance.services', ['SequenceService'])
            ref = None
            if SequenceService:
                ref = SequenceService.get_next_number(organization, 'SALES_RETURN')

            sales_return = SalesReturn.objects.create(
                organization=organization,
                original_order=order,
                return_date=return_date,
                reason=reason,
                reference=ref,
                processed_by=user,
                status='PENDING'
            )

            for line_data in lines:
                original_line = OrderLine.objects.get(
                    id=line_data['original_line_id'],
                    order=order,
                    organization=organization
                )
                qty = Decimal(str(line_data['quantity_returned']))
                unit_price = original_line.unit_price
                tax_rate = original_line.tax_rate or Decimal('0')
                refund = (qty * unit_price).quantize(Decimal('0.01'))
                tax = (refund * tax_rate).quantize(Decimal('0.01'))

                return_line = SalesReturnLine(
                    organization=organization,
                    return_order=sales_return,
                    original_line=original_line,
                    product=original_line.product,
                    quantity_returned=qty,
                    unit_price=unit_price,
                    refund_amount=refund,
                    tax_amount=tax,
                    reason=line_data.get('reason')
                )
                return_line.full_clean()
                return_line.save()

            return sales_return

    @staticmethod
    def approve_sales_return(organization, return_id, user=None):
        """
        Approve a sales return:
        1. Restock items to the original warehouse
        2. Create a CreditNote
        3. Post reversing GL entry
        """
        from apps.pos.returns_models import SalesReturn, CreditNote
        from erp.services import ConfigurationService

        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        (LedgerService, SequenceService) = _safe_import(
            'apps.finance.services', ['LedgerService', 'SequenceService']
        )

        with transaction.atomic():
            sales_return = SalesReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if sales_return.status != 'PENDING':
                raise ValidationError(
                    f"Cannot approve return in status '{sales_return.status}'"
                )

            order = sales_return.original_order
            total_refund = Decimal('0')
            total_tax = Decimal('0')

            # 1. Restock items
            for line in sales_return.lines.all():
                if InventoryService and order.site:
                    from erp.connector_registry import connector
                    Warehouse = connector.require('inventory.warehouses.get_model', org_id=organization.id)
                    if Warehouse is None:
                        continue
                    warehouse = Warehouse.objects.filter(
                        site=order.site, organization=organization, is_active=True
                    ).first()
                    if warehouse:
                        InventoryService.receive_stock(
                            organization=organization,
                            product=line.product,
                            warehouse=warehouse,
                            quantity=line.quantity_returned,
                            cost_price_ht=line.unit_price,
                            reference=f"RET-{sales_return.id}",
                            scope=order.scope or 'OFFICIAL'
                        )
                        line.restocked = True
                        line.save()

                total_refund += line.refund_amount
                total_tax += line.tax_amount

            # 2. Create Credit Note
            cn_number = 'CN-MANUAL'
            if SequenceService:
                cn_number = SequenceService.get_next_number(organization, 'CREDIT_NOTE')

            credit_note = CreditNote.objects.create(
                organization=organization,
                credit_number=cn_number,
                customer=order.contact,
                date=sales_return.return_date,
                amount=total_refund,
                tax_amount=total_tax,
                total_amount=total_refund + total_tax,
                status='ISSUED'
            )

            # 3. Post reversing GL entry
            journal_entry = None
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                rev_acc = rules.get('sales', {}).get('revenue')
                inv_acc = rules.get('sales', {}).get('inventory')
                cogs_acc = rules.get('sales', {}).get('cogs')
                tax_acc = rules.get('purchases', {}).get('tax')
                ar_acc = rules.get('sales', {}).get('receivable')

                # Calculate COGS reversal (use effective cost from original lines)
                total_cogs = Decimal('0')
                for line in sales_return.lines.all():
                    ol = line.original_line
                    total_cogs += (line.quantity_returned * (ol.effective_cost or ol.unit_cost_ht or Decimal('0'))).quantize(Decimal('0.01'))

                posting_lines = [
                    # Reverse revenue: Dr. Revenue
                    {"account_id": rev_acc, "debit": total_refund, "credit": Decimal('0'),
                     "description": "Sales return — revenue reversal"},
                    # Reverse AR/Cash: Cr. AR
                    {"account_id": ar_acc or rev_acc, "debit": Decimal('0'), "credit": total_refund + total_tax,
                     "description": "Sales return — refund to customer"},
                ]

                if total_tax > 0 and tax_acc:
                    # Reverse tax: Dr. VAT Payable
                    posting_lines.append({
                        "account_id": tax_acc, "debit": total_tax, "credit": Decimal('0'),
                        "description": "Sales return — VAT reversal"
                    })

                if total_cogs > 0 and cogs_acc and inv_acc:
                    # Reverse COGS: Cr. COGS, Dr. Inventory
                    posting_lines.extend([
                        {"account_id": inv_acc, "debit": total_cogs, "credit": Decimal('0'),
                         "description": "Sales return — inventory restored"},
                        {"account_id": cogs_acc, "debit": Decimal('0'), "credit": total_cogs,
                         "description": "Sales return — COGS reversal"},
                    ])

                journal_entry = LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Sales Return {sales_return.reference or sales_return.id} — Credit Note {cn_number}",
                    reference=f"RET-{sales_return.id}",
                    status='POSTED',
                    scope=order.scope or 'OFFICIAL',
                    site_id=order.site_id,
                    lines=posting_lines
                )
                credit_note.journal_entry = journal_entry
                credit_note.save()

            # 4. Update return status
            sales_return.credit_note = credit_note
            sales_return.status = 'APPROVED'
            sales_return.processed_by = user
            sales_return.save()

            return sales_return

    @staticmethod
    def cancel_sales_return(organization, return_id):
        """Cancel a pending sales return."""
        from apps.pos.returns_models import SalesReturn

        with transaction.atomic():
            sales_return = SalesReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if sales_return.status != 'PENDING':
                raise ValidationError("Only PENDING returns can be cancelled")
            sales_return.status = 'CANCELLED'
            sales_return.save()
            return sales_return

    # ── Purchase Returns ─────────────────────────────────────────────

    @staticmethod
    def create_purchase_return(organization, order_id, return_date, lines, reason=None, user=None):
        """
        Create a purchase return to a supplier.

        Args:
            organization: Organization instance
            order_id: ID of the original purchase order
            return_date: Date of the return
            lines: list of {'original_line_id', 'quantity_returned'}
            reason: Return reason
        """
        from apps.pos.models import Order, OrderLine
        from apps.pos.returns_models import PurchaseReturn, PurchaseReturnLine

        with transaction.atomic():
            order = Order.objects.get(
                id=order_id, organization=organization, type='PURCHASE'
            )
            if order.status not in ['COMPLETED', 'RECEIVED', 'INVOICED']:
                raise ValidationError(
                    f"Cannot create return for order in status '{order.status}'"
                )

            (SequenceService,) = _safe_import('apps.finance.services', ['SequenceService'])
            ref = None
            if SequenceService:
                ref = SequenceService.get_next_number(organization, 'PURCHASE_RETURN')

            purchase_return = PurchaseReturn.objects.create(
                organization=organization,
                original_order=order,
                supplier=order.contact,
                return_date=return_date,
                reason=reason,
                reference=ref,
                processed_by=user,
                status='PENDING'
            )

            for line_data in lines:
                original_line = OrderLine.objects.get(
                    id=line_data['original_line_id'],
                    order=order,
                    organization=organization
                )
                qty = Decimal(str(line_data['quantity_returned']))
                unit_cost = original_line.effective_cost or original_line.unit_cost_ht
                total = (qty * unit_cost).quantize(Decimal('0.01'))
                tax = (qty * (original_line.vat_amount or Decimal('0'))).quantize(Decimal('0.01'))

                return_line = PurchaseReturnLine(
                    organization=organization,
                    return_order=purchase_return,
                    original_line=original_line,
                    product=original_line.product,
                    quantity_returned=qty,
                    unit_cost=unit_cost,
                    total_amount=total,
                    tax_amount=tax
                )
                return_line.full_clean()
                return_line.save()

            return purchase_return

    @staticmethod
    def complete_purchase_return(organization, return_id, warehouse_id=None, user=None):
        """
        Complete a purchase return:
        1. Remove items from inventory
        2. Post reversing GL entry (Dr. AP → Cr. Inventory + Cr. VAT Input)
        """
        from apps.pos.returns_models import PurchaseReturn
        from erp.services import ConfigurationService

        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if purchase_return.status != 'PENDING':
                raise ValidationError(
                    f"Cannot complete return in status '{purchase_return.status}'"
                )

            order = purchase_return.original_order
            total_cost = Decimal('0')
            total_tax = Decimal('0')

            # 1. Remove from inventory
            for line in purchase_return.lines.all():
                if InventoryService:
                    from erp.connector_registry import connector
                    Warehouse = connector.require('inventory.warehouses.get_model', org_id=organization.id)
                    if Warehouse is None:
                        continue
                    warehouse = None
                    if warehouse_id:
                        warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
                    elif order.site:
                        warehouse = Warehouse.objects.filter(
                            site=order.site, organization=organization, is_active=True
                        ).first()

                    if warehouse:
                        InventoryService.reduce_stock(
                            organization=organization,
                            product=line.product,
                            warehouse=warehouse,
                            quantity=line.quantity_returned,
                            reference=f"PRET-{purchase_return.id}"
                        )
                        line.destocked = True
                        line.save()

                total_cost += line.total_amount
                total_tax += line.tax_amount

            # 2. Post reversing GL entry
            journal_entry = None
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                ap_acc = rules.get('purchases', {}).get('payable')
                inv_acc = rules.get('purchases', {}).get('inventory')
                tax_acc = rules.get('purchases', {}).get('tax')

                posting_lines = [
                    # Dr. AP — reduce what we owe
                    {"account_id": ap_acc, "debit": total_cost + total_tax, "credit": Decimal('0'),
                     "description": f"Purchase return to {purchase_return.supplier}"},
                    # Cr. Inventory — reduce stock value
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cost,
                     "description": "Purchase return — inventory reduction"},
                ]

                if total_tax > 0 and tax_acc and order.vat_recoverable:
                    # Cr. VAT Input — reverse the VAT we claimed
                    posting_lines.append({
                        "account_id": tax_acc, "debit": Decimal('0'), "credit": total_tax,
                        "description": "Purchase return — VAT reversal"
                    })
                elif total_tax > 0 and not order.vat_recoverable:
                    # Tax was capitalized into inventory, already reversed above
                    pass

                journal_entry = LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Purchase Return {purchase_return.reference or purchase_return.id}",
                    reference=f"PRET-{purchase_return.id}",
                    status='POSTED',
                    scope=order.scope or 'OFFICIAL',
                    site_id=order.site_id,
                    lines=posting_lines
                )

            purchase_return.journal_entry = journal_entry
            purchase_return.status = 'COMPLETED'
            purchase_return.processed_by = user
            purchase_return.save()

            return purchase_return
