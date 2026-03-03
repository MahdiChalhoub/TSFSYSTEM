"""
Domain Event Service
=====================
Emits domain events to all active webhook subscriptions for the organization.

Usage:
    from apps.integrations.event_service import DomainEventService

    DomainEventService.emit(
        event_type='order.placed',
        payload={'order_number': 'CLO-...', 'total': 15000, ...},
        organization=order.organization,
    )

Delivery:
  - Synchronous HTTP POST with 5s timeout (suitable for < 100 subscribers)
  - HMAC-SHA256 signed payload via X-TSFSYSTEM-Signature header
  - All attempts logged to WebhookDeliveryLog (success + failure)
  - Non-blocking: failures are logged but do NOT raise exceptions to caller
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime

logger = logging.getLogger('integrations.events')


class DomainEventService:

    STATUS_TO_EVENT = {
        'PLACED':    'order.placed',
        'CONFIRMED': 'order.confirmed',
        'PROCESSING': None,             # no external event for internal state
        'SHIPPED':   'order.shipped',
        'DELIVERED': 'order.delivered',
        'CANCELLED': 'order.cancelled',
        'RETURNED':  'order.returned',
    }

    @classmethod
    def emit_for_status_change(cls, order, new_status: str) -> None:
        """
        Convenience wrapper: maps an order status to the correct event type and emits.
        Call after saving the new status.

        Args:
            order:      ClientOrder instance with updated status
            new_status: the new status string
        """
        event_type = cls.STATUS_TO_EVENT.get(new_status)
        if not event_type:
            return

        cls.emit(
            event_type=event_type,
            payload=cls._build_order_payload(order),
            organization=order.organization,
        )

    @classmethod
    def emit_payment_confirmed(cls, order) -> None:
        """Emits payment.confirmed event."""
        cls.emit(
            event_type='payment.confirmed',
            payload=cls._build_order_payload(order),
            organization=order.organization,
        )

    @classmethod
    def emit(cls, event_type: str, payload: dict, organization) -> None:
        """
        Fire all active webhook subscriptions for this event.

        Args:
            event_type:   e.g. 'order.placed'
            payload:      dict that will be JSON-encoded in the POST body
            organization: erp.Organization — scopes subscription lookup

        Does NOT raise on failure. All errors are caught and logged.
        """
        try:
            from apps.integrations.event_models import WebhookSubscription
            subscriptions = WebhookSubscription.objects.filter(
                organization=organization,
                event_type=event_type,
                is_active=True,
            )
        except Exception as e:
            logger.error(f"[DomainEvent] Failed to query subscriptions: {e}")
            return

        if not subscriptions.exists():
            return

        # Build the envelope
        envelope = {
            'event': event_type,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'organization_slug': organization.slug,
            'data': payload,
        }
        body = json.dumps(envelope, default=str).encode('utf-8')

        for subscription in subscriptions:
            cls._deliver(subscription, event_type, envelope, body)

    @classmethod
    def _deliver(cls, subscription, event_type: str, envelope: dict, body: bytes) -> None:
        """Attempt a single HTTP delivery and log the result."""
        import requests
        from django.utils import timezone
        from apps.integrations.event_models import WebhookDeliveryLog

        log = WebhookDeliveryLog(
            organization=subscription.organization,
            subscription=subscription,
            event_type=event_type,
            payload=envelope,
        )

        try:
            headers = {
                'Content-Type': 'application/json',
                'X-TSFSYSTEM-Event': event_type,
            }

            # HMAC signing
            if subscription.secret:
                signature = hmac.new(
                    subscription.secret.encode('utf-8'),
                    body,
                    hashlib.sha256,
                ).hexdigest()
                headers['X-TSFSYSTEM-Signature'] = f"sha256={signature}"

            resp = requests.post(
                subscription.target_url,
                data=body,
                headers=headers,
                timeout=5,
            )

            log.response_status = resp.status_code
            log.response_body = resp.text[:2000]  # truncate
            log.delivered_at = timezone.now()
            log.failed = not (200 <= resp.status_code < 300)

            if log.failed:
                logger.warning(
                    f"[DomainEvent] Delivery failed: {event_type} → {subscription.target_url} "
                    f"[HTTP {resp.status_code}]"
                )
            else:
                logger.info(
                    f"[DomainEvent] Delivered: {event_type} → {subscription.target_url} "
                    f"[HTTP {resp.status_code}]"
                )

        except Exception as e:
            log.failed = True
            log.error_message = str(e)
            logger.error(f"[DomainEvent] Exception delivering {event_type} to {subscription.target_url}: {e}")

        finally:
            try:
                log.save()
            except Exception as save_err:
                logger.error(f"[DomainEvent] Failed to save delivery log: {save_err}")

    @staticmethod
    def _build_order_payload(order) -> dict:
        """Builds a standardised order payload for webhook bodies."""
        return {
            'id': order.id,
            'order_number': order.order_number,
            'status': order.status,
            'payment_status': order.payment_status,
            'payment_method': order.payment_method,
            'contact_id': order.contact_id,
            'contact_name': order.contact.name if order.contact else None,
            'subtotal': str(order.subtotal),
            'tax_amount': str(order.tax_amount),
            'delivery_fee': str(order.delivery_fee),
            'discount_amount': str(order.discount_amount),
            'total_amount': str(order.total_amount),
            'currency': order.currency,
            'delivery_address': order.delivery_address,
            'notes': order.notes,
            'placed_at': order.placed_at.isoformat() if order.placed_at else None,
        }
