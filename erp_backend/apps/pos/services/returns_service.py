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
        from apps.pos.models import SalesReturn, SalesReturnLine

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
        from apps.pos.models import SalesReturn, CreditNote
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
                    from apps.inventory.models import Warehouse
                    # order.site is now a Warehouse (BRANCH); find child warehouse or use itself
                    warehouse = Warehouse.objects.filter(
                        parent=order.site, organization=organization, is_active=True, location_type='WAREHOUSE'
                    ).first() or order.site
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
        from apps.pos.models import SalesReturn

        with transaction.atomic():
            sales_return = SalesReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if sales_return.status != 'PENDING':
                raise ValidationError("Only PENDING returns can be cancelled")
            sales_return.status = 'CANCELLED'
            sales_return.save()
            return sales_return

    # ── Purchase Returns (Enterprise) ──────────────────────────────────

    @staticmethod
    def create_purchase_return(organization, order_id, return_date, lines, reason=None, user=None):
        """
        Create a purchase return to a supplier (backward-compatible with legacy Order).

        Args:
            organization: Organization instance
            order_id: ID of the original purchase order (legacy Order)
            return_date: Date of the return
            lines: list of {'original_line_id', 'quantity_returned'}
            reason: Return reason
        """
        from apps.pos.models import Order, OrderLine
        from apps.pos.models import PurchaseReturn, PurchaseReturnLine

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
                return_number=ref,
                reason=reason,
                reference=ref,
                processed_by=user,
                status='DRAFT'
            )

            total_expected = Decimal('0')
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
                total_expected += total + tax

                return_line = PurchaseReturnLine(
                    organization=organization,
                    return_order=purchase_return,
                    original_line=original_line,
                    product=original_line.product,
                    quantity_returned=qty,
                    unit_cost=unit_cost,
                    total_amount=total,
                    tax_amount=tax,
                    return_reason=line_data.get('reason', ''),
                )
                return_line.full_clean()
                return_line.save()

            purchase_return.expected_credit_amount = total_expected
            purchase_return.save(update_fields=['expected_credit_amount'])

            return purchase_return

    @staticmethod
    def create_purchase_return_v2(organization, po_id, return_date, lines,
                                  reason=None, return_type='OTHER', user=None):
        """
        Create a purchase return linked to a formal PurchaseOrder.

        Args:
            organization: Organization instance
            po_id: ID of the formal PurchaseOrder
            return_date: Date of the return
            lines: list of {'po_line_id', 'quantity_returned', 'reason'}
            reason: Overall return reason
            return_type: DEFECTIVE | DAMAGED | WRONG_ITEM | OVERDELIVERY | QUALITY | EXPIRED | OTHER
            user: User creating the return
        """
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine
        from apps.pos.models import PurchaseReturn, PurchaseReturnLine

        with transaction.atomic():
            po = PurchaseOrder.objects.select_for_update().get(
                id=po_id, organization=organization
            )
            receivable_statuses = [
                'PARTIALLY_RECEIVED', 'RECEIVED',
                'PARTIALLY_INVOICED', 'INVOICED', 'COMPLETED',
            ]
            if po.status not in receivable_statuses:
                raise ValidationError(
                    f"Cannot create return for PO in status '{po.status}'. "
                    f"Must be: {', '.join(receivable_statuses)}"
                )

            (SequenceService,) = _safe_import('apps.finance.services', ['SequenceService'])
            ref = None
            if SequenceService:
                ref = SequenceService.get_next_number(organization, 'PURCHASE_RETURN')

            purchase_return = PurchaseReturn.objects.create(
                organization=organization,
                purchase_order=po,
                supplier=po.supplier,
                return_date=return_date,
                return_number=ref,
                reason=reason,
                return_type=return_type,
                reference=ref,
                processed_by=user,
                status='DRAFT'
            )

            total_expected = Decimal('0')
            for line_data in lines:
                po_line = PurchaseOrderLine.objects.get(
                    id=line_data['po_line_id'],
                    order=po,
                    organization=organization
                )
                qty = Decimal(str(line_data['quantity_returned']))
                unit_cost = po_line.unit_price
                total = (qty * unit_cost).quantize(Decimal('0.01'))
                tax_rate = po_line.tax_rate or Decimal('0')
                tax = (total * tax_rate).quantize(Decimal('0.01'))
                total_expected += total + tax

                return_line = PurchaseReturnLine(
                    organization=organization,
                    return_order=purchase_return,
                    po_line=po_line,
                    product=po_line.product,
                    quantity_returned=qty,
                    unit_cost=unit_cost,
                    total_amount=total,
                    tax_amount=tax,
                    return_reason=line_data.get('reason', ''),
                    batch_number=line_data.get('batch_number', ''),
                )
                return_line.full_clean()
                return_line.save()

            purchase_return.expected_credit_amount = total_expected
            purchase_return.save(update_fields=['expected_credit_amount'])

            # Emit event
            try:
                from apps.workspace.signals import trigger_purchasing_event
                trigger_purchasing_event(
                    organization, 'PURCHASE_RETURN_OPENED',
                    reference=ref or f'PRET-{purchase_return.pk}',
                    amount=float(total_expected),
                    user=user,
                )
            except Exception:
                pass

            return purchase_return

    @staticmethod
    def approve_purchase_return(organization, return_id, warehouse_id=None, user=None):
        """
        Approve a purchase return:
        1. Remove items from inventory (destock)
        2. Post reversing GL entry (Dr. AP → Cr. Inventory + Cr. VAT Input)
        3. Update PO qty_returned
        """
        from apps.pos.models import PurchaseReturn
        from erp.services import ConfigurationService

        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if purchase_return.status != 'DRAFT':
                raise ValidationError(
                    f"Cannot approve return in status '{purchase_return.status}'. Must be DRAFT."
                )

            order = purchase_return.original_order
            po = purchase_return.purchase_order
            source = po or order
            total_cost = Decimal('0')
            total_tax = Decimal('0')

            # 1. Destock + update PO lines
            for line in purchase_return.lines.all():
                if InventoryService:
                    from apps.inventory.models import Warehouse
                    warehouse = None
                    if warehouse_id:
                        warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
                    elif po and po.warehouse:
                        warehouse = po.warehouse
                    elif order and order.site:
                        warehouse = Warehouse.objects.filter(
                            parent=order.site, organization=organization,
                            is_active=True, location_type='WAREHOUSE'
                        ).first() or order.site

                    if warehouse:
                        InventoryService.reduce_stock(
                            organization=organization,
                            product=line.product,
                            warehouse=warehouse,
                            quantity=line.quantity_returned,
                            reference=f"PRET-{purchase_return.return_number or purchase_return.id}"
                        )
                        line.destocked = True
                        line.save()

                # Update PO line qty_returned
                if line.po_line:
                    line.po_line.qty_returned = (line.po_line.qty_returned or Decimal('0')) + line.quantity_returned
                    line.po_line.save(update_fields=['qty_returned'])

                total_cost += line.total_amount
                total_tax += line.tax_amount

            # Update PO header qty_returned
            if po:
                po.qty_returned = (po.qty_returned or Decimal('0')) + sum(
                    l.quantity_returned for l in purchase_return.lines.all()
                )
                po.save(update_fields=['qty_returned'])

            # 2. Post reversing GL entry
            journal_entry = None
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                ap_acc = rules.get('purchases', {}).get('payable')
                inv_acc = rules.get('purchases', {}).get('inventory')
                tax_acc = rules.get('purchases', {}).get('vat_recoverable') or rules.get('purchases', {}).get('tax')

                scope = 'OFFICIAL'
                if order:
                    scope = getattr(order, 'scope', 'OFFICIAL') or 'OFFICIAL'

                posting_lines = [
                    # Dr. AP — reduce what we owe
                    {"account_id": ap_acc, "debit": total_cost + total_tax, "credit": Decimal('0'),
                     "description": f"Purchase return to {purchase_return.supplier}"},
                    # Cr. Inventory — reduce stock value
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cost,
                     "description": "Purchase return — inventory reduction"},
                ]

                vat_recoverable = True
                if order:
                    vat_recoverable = getattr(order, 'vat_recoverable', True)

                if total_tax > 0 and tax_acc and vat_recoverable:
                    # Cr. VAT Input — reverse the VAT we claimed
                    posting_lines.append({
                        "account_id": tax_acc, "debit": Decimal('0'), "credit": total_tax,
                        "description": "Purchase return — VAT reversal"
                    })

                journal_entry = LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Purchase Return {purchase_return.return_number or purchase_return.id}",
                    reference=f"PRET-{purchase_return.return_number or purchase_return.id}",
                    status='POSTED',
                    scope=scope,
                    site_id=getattr(source, 'site_id', None),
                    lines=posting_lines
                )

            purchase_return.journal_entry = journal_entry
            purchase_return.status = 'APPROVED'
            purchase_return.approved_by = user
            purchase_return.approved_at = timezone.now()
            purchase_return.save()

            # Emit event
            try:
                from apps.workspace.signals import trigger_purchasing_event
                trigger_purchasing_event(
                    organization, 'PURCHASE_RETURN_APPROVED',
                    reference=purchase_return.return_number or f'PRET-{purchase_return.pk}',
                    amount=float(total_cost + total_tax),
                    user=user,
                )
            except Exception:
                pass

            return purchase_return

    @staticmethod
    def complete_purchase_return(organization, return_id, warehouse_id=None, user=None):
        """
        Legacy compatibility: complete_purchase_return calls approve for old-style returns.
        Maps PENDING → COMPLETED (actually goes through DRAFT → APPROVED internally).
        """
        from apps.pos.models import PurchaseReturn

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            # Handle legacy PENDING status → map to DRAFT for new flow
            if purchase_return.status == 'PENDING':
                purchase_return.status = 'DRAFT'
                purchase_return.save(update_fields=['status'])

            return ReturnsService.approve_purchase_return(
                organization, return_id, warehouse_id, user
            )

    @staticmethod
    def send_purchase_return(organization, return_id, user=None, tracking_ref=None):
        """
        Mark an approved return as sent to supplier.
        APPROVED → SENT
        """
        from apps.pos.models import PurchaseReturn

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            purchase_return.transition_to('SENT')
            purchase_return.sent_at = timezone.now()
            if tracking_ref:
                purchase_return.reference = tracking_ref
            purchase_return.save()

            try:
                from apps.workspace.signals import trigger_purchasing_event
                trigger_purchasing_event(
                    organization, 'PURCHASE_RETURN_SENT',
                    reference=purchase_return.return_number or f'PRET-{purchase_return.pk}',
                )
            except Exception:
                pass

            return purchase_return

    @staticmethod
    def receive_supplier_confirmation(organization, return_id, user=None):
        """
        Mark return as received by supplier.
        SENT → RECEIVED_BY_SUPPLIER → auto-transitions to CREDIT_PENDING
        """
        from apps.pos.models import PurchaseReturn

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            purchase_return.transition_to('RECEIVED_BY_SUPPLIER')
            purchase_return.received_by_supplier_at = timezone.now()
            purchase_return.save()

            # Auto-transition to CREDIT_PENDING
            purchase_return.transition_to('CREDIT_PENDING')
            purchase_return.save()

            return purchase_return

    @staticmethod
    def link_supplier_credit_note(organization, return_id, credit_data, user=None):
        """
        Link a supplier credit note to a purchase return and optionally close it.

        Args:
            credit_data: {
                'credit_number': str,
                'date_received': date,
                'amount': Decimal,
                'tax_amount': Decimal (optional),
                'notes': str (optional),
            }
        """
        from apps.pos.models import PurchaseReturn, SupplierCreditNote
        from erp.services import ConfigurationService

        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            if purchase_return.status not in ('CREDIT_PENDING', 'RECEIVED_BY_SUPPLIER', 'APPROVED', 'SENT'):
                raise ValidationError(
                    f"Cannot link credit note to return in status '{purchase_return.status}'"
                )

            amount = Decimal(str(credit_data['amount']))
            tax = Decimal(str(credit_data.get('tax_amount', 0)))

            credit_note = SupplierCreditNote.objects.create(
                organization=organization,
                purchase_return=purchase_return,
                supplier=purchase_return.supplier,
                credit_number=credit_data['credit_number'],
                date_received=credit_data['date_received'],
                amount=amount,
                tax_amount=tax,
                total_amount=amount + tax,
                status='RECEIVED',
                notes=credit_data.get('notes', ''),
            )

            # Update actual credit amount on return
            purchase_return.actual_credit_amount = (
                purchase_return.actual_credit_amount or Decimal('0')
            ) + (amount + tax)
            purchase_return.save(update_fields=['actual_credit_amount'])

            # Post AP adjustment if LedgerService available
            if LedgerService:
                rules = ConfigurationService.get_posting_rules(organization)
                ap_acc = rules.get('purchases', {}).get('payable')

                if ap_acc:
                    journal_entry = LedgerService.create_journal_entry(
                        organization=organization,
                        transaction_date=timezone.now(),
                        description=f"Supplier Credit Note {credit_note.credit_number} — Return {purchase_return.return_number}",
                        reference=f"SCN-{credit_note.credit_number}",
                        status='POSTED',
                        scope='OFFICIAL',
                        lines=[
                            # Dr. AP — supplier reduces their receivable
                            {"account_id": ap_acc, "debit": amount + tax, "credit": Decimal('0'),
                             "description": f"Supplier credit note from {purchase_return.supplier}"},
                            # Cr. Return clearing (same AP for simplicity)
                            {"account_id": ap_acc, "debit": Decimal('0'), "credit": amount + tax,
                             "description": "Supplier credit applied"},
                        ]
                    )
                    credit_note.journal_entry = journal_entry
                    credit_note.status = 'APPLIED'
                    credit_note.save()

            # Auto-close the return if credit covers expected amount
            from django.db import models as db_models
            total_credited = SupplierCreditNote.objects.filter(
                purchase_return=purchase_return,
                status__in=('RECEIVED', 'APPLIED'),
            ).aggregate(total=db_models.Sum('total_amount'))['total'] or Decimal('0')

            if total_credited >= (purchase_return.expected_credit_amount or Decimal('0')):
                if purchase_return.status != 'CLOSED':
                    purchase_return.status = 'CLOSED'
                    purchase_return.closed_at = timezone.now()
                    purchase_return.save(update_fields=['status', 'closed_at'])

            return credit_note

    @staticmethod
    def cancel_purchase_return(organization, return_id, reason=None, user=None):
        """Cancel a purchase return. If already approved, reversal may be needed."""
        from apps.pos.models import PurchaseReturn

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.select_for_update().get(
                id=return_id, organization=organization
            )
            terminal = ('CLOSED', 'CANCELLED')
            if purchase_return.status in terminal:
                raise ValidationError(
                    f"Cannot cancel return in status '{purchase_return.status}'"
                )

            purchase_return.status = 'CANCELLED'
            purchase_return.cancelled_at = timezone.now()
            purchase_return.cancellation_reason = reason or ''
            purchase_return.save()

            return purchase_return

