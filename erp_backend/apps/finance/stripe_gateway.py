"""
Stripe Payment Gateway Service
================================
Handles payment intent creation, webhook processing, and refunds.
Uses tenant-specific encrypted credentials from GatewayConfig.
"""
import logging
import json
from decimal import Decimal

logger = logging.getLogger(__name__)


class StripeGatewayService:
    """
    Stripe integration service.

    Usage:
        gateway = StripeGatewayService(organization_id)
        intent = gateway.create_payment_intent(amount=50.00, currency='USD', metadata={...})
        # Frontend uses intent['client_secret'] with Stripe.js
        # Webhook confirms payment
    """

    def __init__(self, organization_id):
        self.organization_id = organization_id
        self._stripe = None
        self._config = None

    def _get_config(self):
        """Load gateway config for this organization."""
        if self._config:
            return self._config
        from apps.finance.gateway_models import GatewayConfig
        self._config = GatewayConfig.objects.filter(
            organization_id=self.organization_id,
            gateway_type='STRIPE',
            is_active=True
        ).first()
        if not self._config:
            raise ValueError("Stripe gateway not configured or not active for this organization")
        return self._config

    def _get_stripe(self):
        """Get configured Stripe module."""
        if self._stripe:
            return self._stripe
        try:
            import stripe
            config = self._get_config()
            stripe.api_key = config.get_api_key()
            self._stripe = stripe
            return stripe
        except ImportError:
            raise ImportError("stripe package not installed. Run: pip install stripe")

    # ── Payment Intents ────────────────────────────────────────

    def create_payment_intent(self, amount, currency=None, metadata=None, customer_email=None):
        """
        Create a Stripe PaymentIntent.

        Args:
            amount: Payment amount (will be converted to cents)
            currency: e.g. 'usd', 'eur' — defaults to gateway default
            metadata: dict of metadata (invoice_id, order_id, etc.)
            customer_email: Optional email for receipt

        Returns:
            dict with client_secret, payment_intent_id, status
        """
        stripe = self._get_stripe()
        config = self._get_config()

        if currency is None:
            currency = config.default_currency.lower()

        # Stripe expects amounts in smallest unit (cents)
        amount_cents = int(Decimal(str(amount)) * 100)

        params = {
            'amount': amount_cents,
            'currency': currency,
            'metadata': metadata or {},
            'automatic_payment_methods': {'enabled': True},
        }
        if customer_email:
            params['receipt_email'] = customer_email

        try:
            intent = stripe.PaymentIntent.create(**params)
            logger.info(f"[Stripe] PaymentIntent created: {intent.id} for {amount} {currency}")
            return {
                'payment_intent_id': intent.id,
                'client_secret': intent.client_secret,
                'status': intent.status,
                'amount': amount,
                'currency': currency,
            }
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] Error creating PaymentIntent: {e}")
            return {'error': str(e)}

    def retrieve_payment_intent(self, payment_intent_id):
        """Retrieve details of an existing PaymentIntent."""
        stripe = self._get_stripe()
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                'id': intent.id,
                'status': intent.status,
                'amount': intent.amount / 100,
                'currency': intent.currency,
                'metadata': dict(intent.metadata) if intent.metadata else {},
            }
        except stripe.error.StripeError as e:
            return {'error': str(e)}

    # ── Refunds ────────────────────────────────────────────────

    def create_refund(self, payment_intent_id, amount=None, reason=None):
        """
        Refund a payment (full or partial).

        Args:
            payment_intent_id: The original PaymentIntent ID
            amount: Optional partial refund amount (full refund if None)
            reason: Optional reason ('duplicate', 'fraudulent', 'requested_by_customer')
        """
        stripe = self._get_stripe()
        params = {'payment_intent': payment_intent_id}

        if amount is not None:
            params['amount'] = int(Decimal(str(amount)) * 100)
        if reason:
            params['reason'] = reason

        try:
            refund = stripe.Refund.create(**params)
            logger.info(f"[Stripe] Refund created: {refund.id} for PI {payment_intent_id}")
            return {
                'refund_id': refund.id,
                'status': refund.status,
                'amount': refund.amount / 100,
            }
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] Refund error: {e}")
            return {'error': str(e)}

    # ── Webhooks ───────────────────────────────────────────────

    def verify_webhook(self, payload, sig_header):
        """
        Verify a Stripe webhook signature.

        Args:
            payload: Raw request body (bytes)
            sig_header: Stripe-Signature header value

        Returns:
            Stripe Event object or None
        """
        stripe = self._get_stripe()
        config = self._get_config()
        webhook_secret = config.get_webhook_secret()

        if not webhook_secret:
            logger.error("[Stripe] Webhook secret not configured")
            return None

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            return event
        except stripe.error.SignatureVerificationError:
            logger.error("[Stripe] Webhook signature verification failed")
            return None
        except Exception as e:
            logger.error(f"[Stripe] Webhook error: {e}")
            return None

    def handle_webhook_event(self, event):
        """
        Process a verified Stripe webhook event.

        Supported events:
            - payment_intent.succeeded → Record payment + update invoice
            - payment_intent.payment_failed → Log failure
            - charge.refunded → Record refund

        Returns:
            dict with action taken
        """
        event_type = event.get('type', '') if isinstance(event, dict) else event.type
        data = event.get('data', {}).get('object', {}) if isinstance(event, dict) else event.data.object

        handlers = {
            'payment_intent.succeeded': self._handle_payment_succeeded,
            'payment_intent.payment_failed': self._handle_payment_failed,
            'charge.refunded': self._handle_charge_refunded,
        }

        handler = handlers.get(event_type)
        if handler:
            return handler(data)

        logger.info(f"[Stripe] Unhandled event type: {event_type}")
        return {'action': 'ignored', 'event_type': event_type}

    def _handle_payment_succeeded(self, data):
        """Process successful payment — create Payment record, update Invoice status."""
        metadata = data.get('metadata', {})
        amount = data.get('amount', 0) / 100
        currency = data.get('currency', 'usd').upper()

        logger.info(f"[Stripe] Payment succeeded: {data.get('id')} — {amount} {currency}")

        # Auto-record if it's a ClientOrder
        if metadata.get('type') == 'CLIENT_ORDER' and metadata.get('order_id'):
            order_id = metadata.get('order_id')
            try:
                from apps.client_portal.models import ClientOrder
                order = ClientOrder.objects.filter(id=order_id).first()
                if order:
                    order.payment_status = 'PAID'
                    order.save(update_fields=['payment_status', 'updated_at'])
                    logger.info(f"[Stripe] ClientOrder {order_id} marked PAID")
                    return {'action': 'order_marked_paid', 'order_id': order_id}
            except Exception as e:
                logger.error(f"[Stripe] Failed to mark order {order_id} as paid: {e}")

        # Auto-record payment if invoice_id in metadata
        invoice_id = metadata.get('invoice_id')
        if invoice_id:
            try:
                from apps.finance.invoice_service import InvoiceService
                InvoiceService.record_payment(
                    invoice_id=invoice_id,
                    amount=Decimal(str(amount)),
                    method='STRIPE',
                    reference=data.get('id', ''),
                    organization_id=self.organization_id,
                )
                return {'action': 'payment_recorded', 'invoice_id': invoice_id, 'amount': amount}
            except Exception as e:
                logger.error(f"[Stripe] Failed to record payment for invoice {invoice_id}: {e}")
                return {'action': 'error', 'error': str(e)}

        return {'action': 'payment_succeeded', 'amount': amount}

    def _handle_payment_failed(self, data):
        """Log payment failure."""
        logger.warning(f"[Stripe] Payment failed: {data.get('id')} — {data.get('last_payment_error', {}).get('message', 'Unknown')}")
        return {'action': 'payment_failed', 'payment_intent_id': data.get('id')}

    def _handle_charge_refunded(self, data):
        """Process refund."""
        amount = data.get('amount_refunded', 0) / 100
        logger.info(f"[Stripe] Charge refunded: {data.get('id')} — {amount}")
        return {'action': 'refund_processed', 'amount': amount}

    # ── Customers ──────────────────────────────────────────────

    def create_customer(self, email, name=None, metadata=None):
        """Create a Stripe customer for recurring billing."""
        stripe = self._get_stripe()
        params = {'email': email}
        if name:
            params['name'] = name
        if metadata:
            params['metadata'] = metadata

        try:
            customer = stripe.Customer.create(**params)
            return {'customer_id': customer.id, 'email': customer.email}
        except stripe.error.StripeError as e:
            return {'error': str(e)}
