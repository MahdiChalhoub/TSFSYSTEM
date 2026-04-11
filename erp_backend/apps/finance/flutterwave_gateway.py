"""
Flutterwave Payment Gateway
============================
Handles mobile money, card, and bank transfer payments via Flutterwave Standard API.
Market-agnostic: works for any currency/country configured in the org's GatewayConfig.

Supported methods: mobile_money, card, bank_transfer, ussd
Webhook: POST /api/finance/webhooks/flutterwave/
"""
import hashlib
import hmac
import json
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


class FlutterwaveGateway:
    """
    Flutterwave Standard (Redirect) integration.

    Flow:
        1. Admin calls initiate_payment() → returns hosted_link
        2. Frontend redirects customer to hosted_link
        3. Customer pays on Flutterwave page
        4. Flutterwave POSTs to our webhook
        5. Webhook calls verify_transaction() → marks order PAID
    """

    FLW_API_BASE = "https://api.flutterwave.com/v3"

    def __init__(self, organization_id: int):
        self.organization_id = organization_id
        self._config = None

    def _get_config(self):
        """Load GatewayConfig for this org (FLUTTERWAVE type)."""
        if self._config:
            return self._config
        from apps.finance.gateway_models import GatewayConfig
        self._config = GatewayConfig.objects.filter(
            organization_id=self.organization_id,
            gateway_type='FLUTTERWAVE',
            is_active=True,
        ).first()
        if not self._config:
            raise ValueError(
                "Flutterwave gateway not configured or not active for this organization. "
                "Add a GatewayConfig with gateway_type='FLUTTERWAVE'."
            )
        return self._config

    def _headers(self):
        config = self._get_config()
        return {
            "Authorization": f"Bearer {config.get_api_key()}",
            "Content-Type": "application/json",
        }

    # ── Payment Initiation ─────────────────────────────────────────────────

    def initiate_payment(self, order, redirect_url: str, customer_email: str = None) -> dict:
        """
        Create a Flutterwave Standard payment link.

        Args:
            order: ClientOrder instance
            redirect_url: URL to send customer after payment (success/failure)
            customer_email: Optional override (defaults to order.contact.email)

        Returns:
            dict with 'hosted_link' (redirect URL) or 'error'
        """
        import requests
        config = self._get_config()

        email = customer_email
        name = "Customer"
        phone = order.delivery_phone or ""
        if order.contact:
            email = email or order.contact.email or ""
            name = order.contact.name or "Customer"

        amount_to_charge = float(order.total_amount - order.wallet_amount)

        payload = {
            "tx_ref": order.order_number,
            "amount": amount_to_charge,
            "currency": order.currency or config.default_currency,
            "redirect_url": redirect_url,
            "meta": {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "contact_id": str(order.contact_id) if order.contact_id else "",
                "type": "CLIENT_ORDER",
            },
            "customer": {
                "email": email,
                "name": name,
                "phonenumber": phone,
            },
            "customizations": {
                "title": config.display_name or "Order Payment",
                "description": f"Payment for order {order.order_number}",
            },
        }

        try:
            resp = requests.post(
                f"{self.FLW_API_BASE}/payments",
                headers=self._headers(),
                json=payload,
                timeout=30,
            )
            data = resp.json()
            if data.get("status") == "success":
                hosted_link = data["data"]["link"]
                logger.info(f"[Flutterwave] Payment link created for order {order.order_number}")
                return {
                    "hosted_link": hosted_link,
                    "tx_ref": order.order_number,
                }
            else:
                msg = data.get("message", "Unknown Flutterwave error")
                logger.error(f"[Flutterwave] initiate_payment failed: {msg}")
                return {"error": msg}
        except Exception as e:
            logger.error(f"[Flutterwave] initiate_payment exception: {e}")
            return {"error": str(e)}

    # ── Transaction Verification ───────────────────────────────────────────

    def verify_transaction(self, transaction_id: str) -> dict:
        """
        Verify a completed transaction by ID.

        Args:
            transaction_id: Flutterwave transaction ID from webhook

        Returns:
            dict with 'status' ('successful'|'failed'), 'amount', 'currency', 'tx_ref'
        """
        import requests
        try:
            resp = requests.get(
                f"{self.FLW_API_BASE}/transactions/{transaction_id}/verify",
                headers=self._headers(),
                timeout=30,
            )
            data = resp.json()
            if data.get("status") == "success":
                txn = data["data"]
                return {
                    "status": txn.get("status", "failed"),
                    "tx_ref": txn.get("tx_ref", ""),
                    "flw_ref": txn.get("flw_ref", ""),
                    "amount": Decimal(str(txn.get("amount", 0))),
                    "charged_amount": Decimal(str(txn.get("charged_amount", 0))),
                    "currency": txn.get("currency", ""),
                    "payment_type": txn.get("payment_type", ""),
                    "transaction_id": str(transaction_id),
                }
            else:
                return {"status": "failed", "error": data.get("message", "Verification failed")}
        except Exception as e:
            logger.error(f"[Flutterwave] verify_transaction exception: {e}")
            return {"status": "failed", "error": str(e)}

    # ── Webhook Validation ─────────────────────────────────────────────────

    @staticmethod
    def validate_webhook_signature(payload_bytes: bytes, signature_header: str, secret_hash: str) -> bool:
        """
        Validate Flutterwave webhook signature using verif-hash header.

        Args:
            payload_bytes: Raw request body
            signature_header: Value of 'verif-hash' header from request
            secret_hash: Secret hash configured in Flutterwave dashboard

        Returns:
            True if valid, False otherwise
        """
        if not signature_header or not secret_hash:
            return False
        return hmac.compare_digest(signature_header, secret_hash)

    # ── Refunds ───────────────────────────────────────────────────────────

    def create_refund(self, transaction_id: str, amount: Decimal = None) -> dict:
        """
        Initiate a refund for a Flutterwave transaction.

        Args:
            transaction_id: Original Flutterwave transaction ID
            amount: Partial refund amount (full refund if None)
        """
        import requests
        payload = {}
        if amount is not None:
            payload["amount"] = float(amount)

        try:
            resp = requests.post(
                f"{self.FLW_API_BASE}/transactions/{transaction_id}/refund",
                headers=self._headers(),
                json=payload,
                timeout=30,
            )
            data = resp.json()
            if data.get("status") == "success":
                return {"status": "refund_initiated", "data": data.get("data", {})}
            return {"error": data.get("message", "Refund failed")}
        except Exception as e:
            logger.error(f"[Flutterwave] create_refund exception: {e}")
            return {"error": str(e)}
