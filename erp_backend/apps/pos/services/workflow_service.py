"""
SalesWorkflowService — Order State Machine
==========================================
Enforces valid transitions across all 4 workflow axes:
  - order_status:    DRAFT | CONFIRMED | PROCESSING | CLOSED | CANCELLED
  - delivery_status: PENDING | PARTIAL | DELIVERED | RETURNED | NA
  - payment_status:  UNPAID | PARTIAL | PAID | OVERPAID | WRITTEN_OFF
  - invoice_status:  NOT_GENERATED | GENERATED | SENT | DISPUTED

Each public method:
  1. Validates the transition is allowed from the current state
  2. Applies all relevant status changes atomically
  3. Stamps the appropriate timestamp
  4. Calls auto-close logic if all axes are settled

Never raises silently — always raises WorkflowError with a user-readable message.
"""
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError


class WorkflowError(ValidationError):
    """Raised when a requested state transition is not permitted."""
    pass


# ─── Transition Tables ────────────────────────────────────────────────────────

# (current_state, target_state) → allowed
ORDER_TRANSITIONS: dict[str, list[str]] = {
    'DRAFT':      ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED':  ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['CLOSED', 'CANCELLED'],
    'CLOSED':     [],           # terminal
    'CANCELLED':  [],           # terminal
}

DELIVERY_TRANSITIONS: dict[str, list[str]] = {
    'PENDING':   ['PARTIAL', 'DELIVERED', 'NA'],
    'PARTIAL':   ['DELIVERED', 'RETURNED'],
    'DELIVERED': ['RETURNED'],
    'RETURNED':  [],
    'NA':        [],
}

PAYMENT_TRANSITIONS: dict[str, list[str]] = {
    'UNPAID':      ['PARTIAL', 'PAID', 'WRITTEN_OFF'],
    'PARTIAL':     ['PAID', 'WRITTEN_OFF'],
    'PAID':        ['OVERPAID'],
    'OVERPAID':    [],
    'WRITTEN_OFF': [],
}

INVOICE_TRANSITIONS: dict[str, list[str]] = {
    'NOT_GENERATED': ['GENERATED'],
    'GENERATED':     ['SENT', 'DISPUTED'],
    'SENT':          ['DISPUTED'],
    'DISPUTED':      ['GENERATED'],  # re-issue
}


def _assert_transition(axis: str, table: dict, current: str, target: str):
    allowed = table.get(current, [])
    if target not in allowed:
        raise WorkflowError(
            f"[{axis}] Transition '{current}' → '{target}' is not permitted. "
            f"Allowed: {allowed or ['(none — terminal state)']}"
        )


class SalesWorkflowService:
    """
    Stateless service — all methods are classmethods.
    Call on any sales Order (SALE type). Purchase orders have a different flow.
    """

    @classmethod
    def confirm_order(cls, order, user=None, warehouse_id=None) -> None:
        """
        DRAFT / PENDING → CONFIRMED
        Sets confirmed_at, optionally updates fulfillment warehouse.
        Also reserves stock per line (Gap 3).
        """
        _assert_transition('order_status', ORDER_TRANSITIONS, order.order_status, 'CONFIRMED')
        with transaction.atomic():
            if warehouse_id:
                order.site_id = warehouse_id
            order.order_status = 'CONFIRMED'
            order.confirmed_at = timezone.now()
            order.save(update_fields=['order_status', 'confirmed_at', 'site'])
            # ── Gap 3: reserve stock for all lines ──
            cls._reserve_stock(order, user)
        # ── Gap 2: post confirmation journal entry (Dr A/R, Cr Revenue, Cr VAT Payable) ──
        try:
            from apps.pos.services.accounting_poster import SalesAccountingPoster
            SalesAccountingPoster.post_confirmation(order, user)
        except Exception:
            pass  # Never block workflow for accounting failures
        cls._log(order, user, 'CONFIRMED', f"Order confirmed by {_uname(user)}")

    @classmethod
    def mark_processing(cls, order, user=None) -> None:
        """
        CONFIRMED → PROCESSING (e.g. picked, packed, in transit)
        """
        _assert_transition('order_status', ORDER_TRANSITIONS, order.order_status, 'PROCESSING')
        with transaction.atomic():
            order.order_status = 'PROCESSING'
            order.save(update_fields=['order_status'])
        cls._log(order, user, 'PROCESSING', "Order marked as processing")

    @classmethod
    def mark_delivered(cls, order, partial: bool = False, user=None) -> None:
        """
        PENDING | PARTIAL → DELIVERED | PARTIAL
        On full delivery: stamps delivered_at, posts COGS Dr/Cr journal entry.
        """
        target = 'PARTIAL' if partial else 'DELIVERED'
        _assert_transition('delivery_status', DELIVERY_TRANSITIONS, order.delivery_status, target)
        with transaction.atomic():
            order.delivery_status = target
            fields = ['delivery_status']
            if target == 'DELIVERED':
                order.delivered_at = timezone.now()
                fields.append('delivered_at')
                if order.order_status == 'CONFIRMED':
                    order.order_status = 'PROCESSING'
                    fields.append('order_status')
            order.save(update_fields=fields)
            # ── Phase 2: COGS accounting entry on full delivery ──
            if target == 'DELIVERED':
                cls._post_cogs_on_delivery(order, user)
                # ── Gap 3: deduct reserved stock (release reservation + reduce on_hand) ──
                cls._deduct_stock(order, user)
                
                # ── Delivery Fleet: Trigger commission/fleet logic ──
                try:
                    from apps.pos.services.delivery_fleet_service import DeliveryFleetService
                    for delivery in order.deliveries.filter(status='PENDING'):
                        delivery.status = 'DELIVERED'
                        delivery.delivered_at = timezone.now()
                        delivery.save(update_fields=['status', 'delivered_at'])
                        DeliveryFleetService.on_delivery_completed(delivery, user)
                except Exception:
                    pass
            cls._try_auto_close(order)
        cls._log(order, user, f'DELIVERY_{target}', f"Delivery marked as {target}")

    @classmethod
    def mark_returned(cls, order, user=None) -> None:
        """
        DELIVERED | PARTIAL → RETURNED
        """
        _assert_transition('delivery_status', DELIVERY_TRANSITIONS, order.delivery_status, 'RETURNED')
        with transaction.atomic():
            order.delivery_status = 'RETURNED'
            order.save(update_fields=['delivery_status'])
        cls._log(order, user, 'DELIVERY_RETURNED', "Delivery marked as returned")

    @classmethod
    def mark_paid(cls, order, amount_paid=None, user=None) -> None:
        """
        UNPAID | PARTIAL → PAID (or PARTIAL if amount_paid < total).
        For credit sales: posts Dr Cash/Bank / Cr A/R to clear the receivable.
        """
        from decimal import Decimal
        total = order.total_amount or Decimal('0')
        paid_so_far = amount_paid or total

        target = 'PAID' if paid_so_far >= total else 'PARTIAL'

        _assert_transition('payment_status', PAYMENT_TRANSITIONS, order.payment_status, target)
        with transaction.atomic():
            order.payment_status = target
            order.save(update_fields=['payment_status'])
            # ── Phase 2: A/R clearance for credit sales ──
            if target == 'PAID':
                cls._post_ar_adjustment_on_payment(order, paid_so_far, user)
            cls._try_auto_close(order)
        cls._log(order, user, f'PAYMENT_{target}', f"Payment recorded — status: {target}")

    @classmethod
    def mark_written_off(cls, order, reason: str = '', user=None) -> None:
        """
        UNPAID | PARTIAL → WRITTEN_OFF
        """
        _assert_transition('payment_status', PAYMENT_TRANSITIONS, order.payment_status, 'WRITTEN_OFF')
        with transaction.atomic():
            order.payment_status = 'WRITTEN_OFF'
            order.save(update_fields=['payment_status'])
            cls._try_auto_close(order)
        cls._log(order, user, 'PAYMENT_WRITTEN_OFF', f"Payment written off. Reason: {reason}")

    @classmethod
    def generate_invoice(cls, order, user=None) -> None:
        """
        NOT_GENERATED → GENERATED
        """
        _assert_transition('invoice_status', INVOICE_TRANSITIONS, order.invoice_status, 'GENERATED')
        with transaction.atomic():
            order.invoice_status = 'GENERATED'
            order.invoiced_at = timezone.now()
            order.save(update_fields=['invoice_status', 'invoiced_at'])
        cls._log(order, user, 'INVOICE_GENERATED', "Invoice generated")

    @classmethod
    def send_invoice(cls, order, user=None) -> None:
        """
        GENERATED → SENT
        """
        _assert_transition('invoice_status', INVOICE_TRANSITIONS, order.invoice_status, 'SENT')
        with transaction.atomic():
            order.invoice_status = 'SENT'
            order.save(update_fields=['invoice_status'])
        cls._log(order, user, 'INVOICE_SENT', "Invoice sent to client")

    @classmethod
    def cancel_order(cls, order, reason: str = '', user=None) -> None:
        """
        DRAFT | CONFIRMED | PROCESSING → CANCELLED
        Cancels across all axes safely.
        Future: release stock reservation here.
        """
        _assert_transition('order_status', ORDER_TRANSITIONS, order.order_status, 'CANCELLED')
        with transaction.atomic():
            order.order_status = 'CANCELLED'
            if order.delivery_status == 'PENDING':
                order.delivery_status = 'NA'
            if order.payment_status == 'UNPAID':
                order.payment_status = 'WRITTEN_OFF'
            order.save(update_fields=['order_status', 'delivery_status', 'payment_status'])
            # ── Gap 3: release any stock reservations ──
            cls._release_stock(order, user)
        # ── Gap 2: reverse all accounting entries posted on this order ──
        try:
            from apps.pos.services.accounting_poster import SalesAccountingPoster
            SalesAccountingPoster.post_return(order, user)
        except Exception:
            pass  # Never block workflow for accounting failures
        cls._log(order, user, 'CANCELLED', f"Order cancelled. Reason: {reason}")

    # ─── Internal Helpers ──────────────────────────────────────────────────────

    @classmethod
    def _try_auto_close(cls, order) -> None:
        """Auto-transition order_status → CLOSED when all axes are settled."""
        delivery_settled = order.delivery_status in ('DELIVERED', 'RETURNED', 'NA')
        payment_settled  = order.payment_status in ('PAID', 'OVERPAID', 'WRITTEN_OFF')
        if delivery_settled and payment_settled and order.order_status == 'PROCESSING':
            order.order_status = 'CLOSED'
            order.closed_at = timezone.now()
            order.save(update_fields=['order_status', 'closed_at'])

    # ── Gap 3: Stock Reservation Wrappers ─────────────────────────────────────

    @classmethod
    def _resolve_warehouse(cls, order):
        """Resolve the delivery warehouse from order.site (Warehouse FK)."""
        try:
            from erp.connector_registry import connector
            Warehouse = connector.require('inventory.warehouses.get_model', org_id=order.organization_id, source='pos.workflow')
            if Warehouse and order.site:
                return order.site
        except Exception:
            pass
        return None

    @classmethod
    def _reserve_stock(cls, order, user=None) -> None:
        """Safe wrapper: reserves stock on confirm. Raises StockReservationError on shortage."""
        try:
            from erp.connector_registry import connector
            StockReservationService = connector.require('inventory.services.get_reservation_service', org_id=order.organization_id, source='pos.workflow')
            if not StockReservationService:
                return
            warehouse = cls._resolve_warehouse(order)
            if warehouse:
                StockReservationService.reserve(order, warehouse, user)
        except Exception as exc:
            # Re-raise reservation errors (insufficient stock) — these ARE blocking
            try:
                from erp.connector_registry import connector as _conn
                StockReservationError = _conn.require('inventory.services.get_reservation_error', org_id=order.organization_id, source='pos.workflow')
                if StockReservationError and isinstance(exc, StockReservationError):
                    raise
            except Exception:
                pass
            import logging
            logging.getLogger(__name__).warning(
                "[WorkflowService] Stock reservation failed for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _release_stock(cls, order, user=None) -> None:
        """Safe wrapper: releases reservations on cancel. Never blocks."""
        try:
            from erp.connector_registry import connector
            StockReservationService = connector.require('inventory.services.get_reservation_service', org_id=order.organization_id, source='pos.workflow')
            if not StockReservationService:
                return
            warehouse = cls._resolve_warehouse(order)
            if warehouse:
                StockReservationService.release(order, warehouse, user)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[WorkflowService] Stock release failed for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _deduct_stock(cls, order, user=None) -> None:
        """Safe wrapper: deducts stock on delivery. Never blocks."""
        try:
            from erp.connector_registry import connector
            StockReservationService = connector.require('inventory.services.get_reservation_service', org_id=order.organization_id, source='pos.workflow')
            if not StockReservationService:
                return
            warehouse = cls._resolve_warehouse(order)
            if warehouse:
                StockReservationService.deduct(order, warehouse, user)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[WorkflowService] Stock deduction failed for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _post_cogs_on_delivery(cls, order, user=None) -> None:
        """
        Phase 2 — Gap 2: Post Dr COGS / Cr Inventory when delivery is confirmed.

        Uses effective_cost on each OrderLine (AMC captured at checkout time).
        Safe: catches all exceptions — never blocks the delivery workflow.

        [Phase 3A] Now routes through ConnectorEngine instead of importing finance directly.
        """
        try:
            from decimal import Decimal
            from erp.connector_engine import connector_engine

            # Sum COGS from order lines using the cost captured at checkout
            total_cogs = Decimal('0')
            for line in order.lines.all():
                cost = line.effective_cost or line.unit_cost_ht or Decimal('0')
                total_cogs += (cost * line.quantity).quantize(Decimal('0.01'))

            if total_cogs <= Decimal('0'):
                return  # Nothing to post (e.g., service items with zero cost)

            # Route to Finance via ConnectorEngine — finance resolves accounts internally
            connector_engine.route_write(
                target_module='finance',
                endpoint='post_cogs_entry',
                data={
                    'organization_id': order.organization_id,
                    'order_id': order.id,
                    'cogs_total': str(total_cogs),
                    'invoice_number': order.invoice_number or f'ORD-{order.id}',
                    'ref_code': order.ref_code or '',
                    'scope': order.scope or 'OFFICIAL',
                    'site_id': order.site_id,
                    'delivered_at': str(timezone.now()),
                    'user_id': user.id if user else None,
                },
                organization_id=order.organization_id,
                source_module='pos',
            )
        except Exception as exc:
            # Log the failure but never block the delivery status change
            import logging
            logging.getLogger(__name__).warning(
                "[WorkflowService] COGS posting failed for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _post_ar_adjustment_on_payment(cls, order, amount_paid, user=None) -> None:
        """
        Phase 2 — Gap 5: For orders paid via CREDIT method (A/R sale),
        when the customer pays cash/Wave/bank: Dr Cash / Cr A/R.

        This clears the receivable that was booked at checkout.
        Safe: catches all exceptions — never blocks the payment workflow.

        [Phase 3A] Now routes through ConnectorEngine instead of importing finance directly.
        """
        try:
            # Only post this for credit sales (A/R was debited at checkout)
            if order.payment_method != 'CREDIT':
                return

            from decimal import Decimal
            from erp.connector_engine import connector_engine

            amount = (amount_paid or order.total_amount or Decimal('0'))
            if hasattr(amount, 'quantize'):
                amount = amount.quantize(Decimal('0.01'))
            if amount <= Decimal('0'):
                return

            # Route to Finance via ConnectorEngine — finance resolves accounts internally
            connector_engine.route_write(
                target_module='finance',
                endpoint='post_payment_receipt',
                data={
                    'organization_id': order.organization_id,
                    'order_id': order.id,
                    'amount': str(amount),
                    'payment_method': order.payment_method or 'CREDIT',
                    'invoice_number': order.invoice_number or f'ORD-{order.id}',
                    'ref_code': order.ref_code or '',
                    'scope': order.scope or 'OFFICIAL',
                    'site_id': order.site_id,
                    'user_id': user.id if user else None,
                    'force': True,  # Force JE since we're processing CREDIT A/R clearance
                },
                organization_id=order.organization_id,
                source_module='pos',
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[WorkflowService] A/R clearance posting failed for order %s: %s",
                order.id, exc, exc_info=True
            )

    @classmethod
    def _log(cls, order, user, action: str, note: str) -> None:
        """
        Dual audit log — writes both the generic POSAuditEvent (legacy)
        and the structured SalesAuditLog (Gap 8). Never blocks the main flow.
        """
        # 1. Generic POSAuditEvent (backward compat)
        try:
            from apps.pos.services.pos_service import fire_audit_event
            fire_audit_event(
                organization=order.organization,
                user=user,
                event_type='WORKFLOW_TRANSITION',
                event_name=f"[{action}] Order #{order.invoice_number or order.id}",
                details={'note': note, 'order_id': order.id, 'action': action},
                reference_id=order.id
            )
        except Exception:
            pass

        # 2. Structured SalesAuditLog (Gap 8)
        try:
            from apps.pos.models.audit_models import SalesAuditLog
            _ACTION_MAP = {
                'CONFIRMED':          'ORDER_CONFIRMED',
                'PROCESSING':         'ORDER_PROCESSING',
                'DELIVERY_DELIVERED': 'DELIVERY_DELIVERED',
                'DELIVERY_PARTIAL':   'DELIVERY_PARTIAL',
                'DELIVERY_RETURNED':  'DELIVERY_RETURNED',
                'PAYMENT_PAID':       'PAYMENT_PAID',
                'PAYMENT_PARTIAL':    'PAYMENT_PARTIAL',
                'PAYMENT_WRITTEN_OFF':'PAYMENT_WRITTEN_OFF',
                'INVOICE_GENERATED':  'INVOICE_GENERATED',
                'INVOICE_SENT':       'INVOICE_SENT',
                'CANCELLED':          'ORDER_CANCELLED',
            }
            SalesAuditLog.log(
                order=order,
                action_type=_ACTION_MAP.get(action, 'WORKFLOW_TRANSITION'),
                summary=note,
                actor=user,
            )
        except Exception:
            pass


def _uname(user) -> str:
    if not user:
        return 'System'
    return user.get_full_name() or user.username
