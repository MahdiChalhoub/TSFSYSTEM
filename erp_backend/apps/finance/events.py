"""
Finance Module Event Handlers
==============================

Handles events from other modules and emits finance-related events.

Event Contracts Implemented:
- invoice.created (emits)
- invoice.paid (emits)
- payment.received (emits)
- order.completed (subscribes - may create invoice)
- subscription.renewed (subscribes - creates invoice)
"""

import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from kernel.events import emit_event, subscribe_to_event
from kernel.contracts.decorators import enforce_contract

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for Finance module

    Routes events to appropriate handlers based on event name.
    """
    logger.info(f"[Finance] Received event: {event_name}")

    handlers = {
        'order.completed': handle_order_completed,
        'subscription.created': handle_subscription_created,
        'subscription.renewed': handle_subscription_renewed,
        'subscription.cancelled': handle_subscription_cancelled,
    }

    handler = handlers.get(event_name)

    if handler:
        try:
            handler(payload, organization_id)
            logger.info(f"[Finance] Successfully handled {event_name}")
        except Exception as e:
            logger.error(f"[Finance] Error handling {event_name}: {e}")
            raise
    else:
        logger.warning(f"[Finance] No handler for event: {event_name}")


@subscribe_to_event('order.completed')
@enforce_contract('order.completed')
def on_order_completed(event):
    """EventBus handler wrapper for order.completed"""
    handle_order_completed(event.payload, event.organization_id, triggered_by=event.triggered_by)


@transaction.atomic
def handle_order_completed(payload: dict, organization_id: int, triggered_by=None):
    """
    Handle order.completed event from POS module

    Creates an invoice for the completed order.
    """
    from apps.finance.models import Invoice, InvoiceLine

    order_id = payload.get('order_id')
    customer_id = payload.get('customer_id')
    total_amount = Decimal(str(payload.get('total_amount', 0)))
    currency = payload.get('currency', 'USD')
    items = payload.get('items', [])

    logger.info(f"[Finance] Creating invoice for order {order_id}")

    try:
        # Create invoice
        invoice = Invoice.objects.create(
            customer_id=customer_id,
            invoice_date=timezone.now().date(),
            due_date=timezone.now().date(),  # Immediate for POS orders
            total_amount=total_amount,
            currency=currency,
            status='PAID',  # POS orders are paid immediately
            reference_type='ORDER',
            reference_id=order_id,
            organization_id=organization_id
        )

        # Create invoice lines
        for item in items:
            InvoiceLine.objects.create(
                invoice=invoice,
                product_id=item.get('product_id'),
                description=item.get('description', ''),
                quantity=Decimal(str(item.get('quantity', 0))),
                unit_price=Decimal(str(item.get('unit_price', 0))),
                total=Decimal(str(item.get('total', 0))),
                organization_id=organization_id
            )

        # Emit invoice.created event
        emit_event('invoice.created', {
            'invoice_id': invoice.id,
            'customer_id': customer_id,
            'total_amount': float(total_amount),
            'currency': currency,
            'organization_id': organization_id
        }, aggregate_type='invoice', aggregate_id=invoice.id, triggered_by=triggered_by)

        # Emit invoice.paid event (since POS orders are paid immediately)
        emit_event('invoice.paid', {
            'invoice_id': invoice.id,
            'customer_id': customer_id,
            'amount_paid': float(total_amount),
            'payment_date': timezone.now().isoformat(),
            'organization_id': organization_id
        }, aggregate_type='invoice', aggregate_id=invoice.id, triggered_by=triggered_by)

        logger.info(f"[Finance] Created invoice {invoice.id} for order {order_id}")

    except Exception as e:
        logger.error(f"[Finance] Error creating invoice for order {order_id}: {e}")
        raise


@subscribe_to_event('subscription.created')
def on_subscription_created(event):
    """EventBus handler wrapper for subscription.created"""
    handle_subscription_created(event.payload, event.organization_id)


@transaction.atomic
def handle_subscription_created(payload: dict, organization_id: int):
    """
    Handle subscription.created event

    May create initial invoice for subscription.
    """
    subscription_id = payload.get('subscription_id')
    customer_id = payload.get('customer_id')

    logger.info(f"[Finance] Subscription created: {subscription_id}")
    # TODO: Implement initial subscription invoice if needed


@subscribe_to_event('subscription.renewed')
@enforce_contract('subscription.renewed')
def on_subscription_renewed(event):
    """EventBus handler wrapper for subscription.renewed"""
    handle_subscription_renewed(event.payload, event.organization_id)


@transaction.atomic
def handle_subscription_renewed(payload: dict, organization_id: int):
    """
    Handle subscription.renewed event

    Creates renewal invoice.
    """
    from apps.finance.models import Invoice

    subscription_id = payload.get('subscription_id')
    customer_id = payload.get('customer_id')
    amount = Decimal(str(payload.get('amount', 0)))
    currency = payload.get('currency', 'USD')
    renewal_date = payload.get('renewal_date')

    logger.info(f"[Finance] Creating renewal invoice for subscription {subscription_id}")

    try:
        # Create renewal invoice
        invoice = Invoice.objects.create(
            customer_id=customer_id,
            invoice_date=timezone.now().date(),
            due_date=renewal_date,
            total_amount=amount,
            currency=currency,
            status='PENDING',
            reference_type='SUBSCRIPTION',
            reference_id=subscription_id,
            organization_id=organization_id
        )

        # Emit invoice.created event
        emit_event('invoice.created', {
            'invoice_id': invoice.id,
            'customer_id': customer_id,
            'total_amount': float(amount),
            'currency': currency,
            'organization_id': organization_id
        })

        logger.info(f"[Finance] Created renewal invoice {invoice.id}")

    except Exception as e:
        logger.error(f"[Finance] Error creating renewal invoice: {e}")
        raise


@subscribe_to_event('subscription.cancelled')
def on_subscription_cancelled(event):
    """EventBus handler wrapper for subscription.cancelled"""
    handle_subscription_cancelled(event.payload, event.organization_id)


def handle_subscription_cancelled(payload: dict, organization_id: int):
    """
    Handle subscription.cancelled event

    May trigger refund or credit note creation.
    """
    subscription_id = payload.get('subscription_id')
    logger.info(f"[Finance] Subscription cancelled: {subscription_id}")
    # TODO: Implement refund/credit note logic if needed


# Utility functions

def record_payment(invoice_id: int, amount: Decimal, payment_method: str, organization_id: int):
    """
    Record a payment against an invoice and emit payment.received event.
    """
    from apps.finance.models import Invoice, Payment

    try:
        invoice = Invoice.objects.get(id=invoice_id, organization_id=organization_id)

        # Create payment record
        payment = Payment.objects.create(
            invoice=invoice,
            amount=amount,
            payment_method=payment_method,
            payment_date=timezone.now(),
            organization_id=organization_id
        )

        # Update invoice status
        invoice.amount_paid += amount
        if invoice.amount_paid >= invoice.total_amount:
            invoice.status = 'PAID'
        else:
            invoice.status = 'PARTIAL'
        invoice.save()

        # Emit payment.received event
        emit_event('payment.received', {
            'payment_id': payment.id,
            'invoice_id': invoice_id,
            'customer_id': invoice.customer_id,
            'amount': float(amount),
            'payment_method': payment_method,
            'organization_id': organization_id
        })

        # If fully paid, emit invoice.paid event
        if invoice.status == 'PAID':
            emit_event('invoice.paid', {
                'invoice_id': invoice_id,
                'customer_id': invoice.customer_id,
                'amount_paid': float(invoice.total_amount),
                'payment_date': timezone.now().isoformat(),
                'organization_id': organization_id
            })

        logger.info(f"[Finance] Recorded payment of {amount} for invoice {invoice_id}")

        return payment

    except Invoice.DoesNotExist:
        logger.error(f"[Finance] Invoice {invoice_id} not found")
        raise
    except Exception as e:
        logger.error(f"[Finance] Error recording payment: {e}")
        raise
