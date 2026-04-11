"""
Generic Payment Gateway Service
=================================
Market-agnostic factory that dispatches to the correct payment backend
based on the payment_method string provided at checkout.

Supported methods:
  CARD            → Stripe (existing)
  MOBILE_MONEY    → Flutterwave (new)
  BANK_TRANSFER   → Manual bank transfer (pending admin confirmation)
  CASH            → Cash on Delivery (no external call)
  WALLET          → Internal wallet debit (already handled in place_order)

Usage:
    from apps.finance.payment_gateway import PaymentGatewayService
    result = PaymentGatewayService.process(order, method='MOBILE_MONEY', redirect_url='...')
    if result.requires_redirect:
        return Response({'redirect_url': result.redirect_url})
"""
import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class PaymentResult:
    """
    Standardized return value from any payment backend.

    Fields:
        success         — True if synchronously confirmed (COD, wallet).
                          False on error. None if pending (bank transfer, mobile money).
        requires_redirect — True if the customer must visit an external URL.
        redirect_url    — The external payment URL (Flutterwave hosted page, etc.)
        reference       — Gateway transaction reference or internal reference.
        payment_method  — Echoes back which method was used.
        error           — Human-readable error message, or None on success.
        raw             — Raw gateway response dict for debugging.
    """
    success: Optional[bool]
    payment_method: str
    requires_redirect: bool = False
    redirect_url: Optional[str] = None
    reference: Optional[str] = None
    error: Optional[str] = None
    raw: dict = field(default_factory=dict)


class PaymentGatewayService:
    """
    Central dispatcher for all payment methods.
    All methods are class-level — no instantiation needed.
    """

    # ── Backend Dispatch Map ───────────────────────────────────────────────

    @classmethod
    def process(
        cls,
        order,
        method: str,
        redirect_url: str = "",
        customer_email: str = None,
        bank_details: dict = None,
    ) -> PaymentResult:
        """
        Process payment for a ClientOrder using the specified method.

        Args:
            order:          ClientOrder instance (already status='PLACED')
            method:         Payment method string (CARD, MOBILE_MONEY, CASH, BANK_TRANSFER)
            redirect_url:   URL Flutterwave/Stripe redirects to after payment
            customer_email: Optional customer email override
            bank_details:   Dict with bank account info for BANK_TRANSFER display

        Returns:
            PaymentResult
        """
        method = method.upper()
        dispatch = {
            "CARD": cls._process_card,
            "MOBILE_MONEY": cls._process_mobile_money,
            "CASH": cls._process_cash_on_delivery,
            "BANK_TRANSFER": cls._process_bank_transfer,
        }
        handler = dispatch.get(method)
        if not handler:
            return PaymentResult(
                success=False,
                payment_method=method,
                error=f"Unsupported payment method: '{method}'. Supported: {', '.join(dispatch.keys())}",
            )

        try:
            return handler(order, redirect_url=redirect_url, customer_email=customer_email, bank_details=bank_details)
        except Exception as e:
            logger.error(f"[PaymentGateway] Unexpected error in {method}: {e}")
            return PaymentResult(success=False, payment_method=method, error=str(e))

    # ── Card (Stripe) ──────────────────────────────────────────────────────

    @classmethod
    def _process_card(cls, order, redirect_url="", customer_email=None, **kwargs) -> PaymentResult:
        """Stripe PaymentIntent — client-side confirmation via Stripe.js."""
        try:
            from apps.finance.stripe_gateway import StripeGatewayService
            svc = StripeGatewayService(order.organization_id)
            amount_to_charge = order.total_amount - order.wallet_amount
            if amount_to_charge <= 0:
                return PaymentResult(success=True, payment_method="CARD", reference="wallet_covered")

            result = svc.create_payment_intent(
                amount=amount_to_charge,
                currency=order.currency.lower(),
                metadata={
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "contact_id": order.contact_id,
                    "type": "CLIENT_ORDER",
                },
                customer_email=customer_email or (order.contact.email if order.contact else None),
            )
            if "error" in result:
                return PaymentResult(success=False, payment_method="CARD", error=result["error"])

            return PaymentResult(
                success=None,   # Pending — Stripe.js on frontend will confirm
                payment_method="CARD",
                requires_redirect=False,
                reference=result["payment_intent_id"],
                raw=result,
            )
        except ValueError as e:
            # Stripe not configured for this org
            return PaymentResult(success=False, payment_method="CARD", error=str(e))

    # ── Mobile Money (Flutterwave) ─────────────────────────────────────────

    @classmethod
    def _process_mobile_money(cls, order, redirect_url="", customer_email=None, **kwargs) -> PaymentResult:
        """Flutterwave hosted payment page redirect."""
        try:
            from apps.finance.flutterwave_gateway import FlutterwaveGateway
            gateway = FlutterwaveGateway(order.organization_id)
            result = gateway.initiate_payment(
                order=order,
                redirect_url=redirect_url,
                customer_email=customer_email,
            )
            if "error" in result:
                return PaymentResult(success=False, payment_method="MOBILE_MONEY", error=result["error"])

            return PaymentResult(
                success=None,   # Pending — webhook will confirm
                payment_method="MOBILE_MONEY",
                requires_redirect=True,
                redirect_url=result["hosted_link"],
                reference=result.get("tx_ref"),
                raw=result,
            )
        except ValueError as e:
            # Flutterwave not configured for this org
            return PaymentResult(success=False, payment_method="MOBILE_MONEY", error=str(e))

    # ── Cash on Delivery ───────────────────────────────────────────────────

    @classmethod
    def _process_cash_on_delivery(cls, order, **kwargs) -> PaymentResult:
        """
        No external call. Order placed with UNPAID status.
        Cash collected by delivery agent on arrival.
        """
        logger.info(f"[PaymentGateway] COD set for order {order.order_number}")
        return PaymentResult(
            success=True,
            payment_method="CASH",
            requires_redirect=False,
            reference=f"COD-{order.order_number}",
            raw={"note": "Cash to be collected on delivery"},
        )

    # ── Manual Bank Transfer ───────────────────────────────────────────────

    @classmethod
    def _process_bank_transfer(cls, order, bank_details: dict = None, **kwargs) -> PaymentResult:
        """
        No external call. Provides org bank account details to customer.
        Order stays UNPAID until admin manually confirms receipt.
        """
        if not bank_details:
            # Try to load from org's GatewayConfig
            try:
                from apps.finance.gateway_models import GatewayConfig
                config = GatewayConfig.objects.filter(
                    organization_id=order.organization_id,
                    gateway_type='BANK_TRANSFER',
                    is_active=True,
                ).first()
                bank_details = config.metadata if config else {}
            except Exception:
                bank_details = {}

        logger.info(f"[PaymentGateway] Bank transfer instructions issued for order {order.order_number}")
        return PaymentResult(
            success=True,   # "Success" = instructions dispatched. Still UNPAID.
            payment_method="BANK_TRANSFER",
            requires_redirect=False,
            reference=f"TRANSFER-{order.order_number}",
            raw={
                "note": "Customer must transfer to the provided bank account.",
                "bank_details": bank_details,
                "order_number": order.order_number,
                "amount": str(order.total_amount - order.wallet_amount),
                "currency": order.currency,
            },
        )

    # ── Utility: Confirm Manual Payment ────────────────────────────────────

    @staticmethod
    def confirm_manual_payment(order, confirmed_by_user=None) -> bool:
        """
        Admin action to manually confirm a BANK_TRANSFER or COD payment.
        Updates order.payment_status = 'PAID' and posts loyalty points.

        Returns: True on success
        """
        from erp.connector_registry import connector
        ClientPortalConfig = connector.require('client_portal.config.get_model', org_id=0, source='finance')
        order.payment_status = "PAID"
        order.save(update_fields=["payment_status", "updated_at"])

        # Post loyalty points if enabled
        try:
            config = ClientPortalConfig.get_config(order.organization)
            if config.loyalty_enabled and order.contact:
                points = config.get_points_for_amount(order.total_amount)
                if points > 0:
                    wallet = order.contact.wallet
                    wallet.add_loyalty_points(points)
                    logger.info(f"[PaymentGateway] +{points} loyalty points for {order.contact}")
        except Exception as e:
            logger.warning(f"[PaymentGateway] Loyalty points post failed: {e}")

        logger.info(f"[PaymentGateway] Manual payment confirmed for order {order.order_number}")
        return True
