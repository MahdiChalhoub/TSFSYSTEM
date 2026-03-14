import logging

# Connector Governance Layer — all cross-module access goes through here
from erp.connector_registry import connector

from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db.models import Sum, Count
from erp.views import TenantModelViewSet
from .models import (
    ClientPortalConfig, ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket, QuoteRequest, QuoteItem,
    ProductReview, WishlistItem
)
from .services import IntegratedCheckoutService
from .serializers import (
    ClientPortalAccessSerializer,
    ClientWalletSerializer, WalletTransactionSerializer,
    ClientOrderSerializer, ClientOrderListSerializer, ClientOrderLineSerializer,
    ClientTicketSerializer, QuoteRequestSerializer,
    ProductReviewSerializer, WishlistItemSerializer,
    ClientDashboardSerializer,
)
from .permissions import IsClientUser, HasClientPermission


# =============================================================================
# ADMIN-SIDE: Wallet management
# =============================================================================

class ClientWalletAdminViewSet(TenantModelViewSet):
    """Admin management of client wallets."""
    queryset = ClientWallet.objects.select_related('contact').all()
    serializer_class = ClientWalletSerializer

    @action(detail=True, methods=['post'])
    def manual_credit(self, request, pk=None):
        wallet = self.get_object()
        amount = request.data.get('amount', 0)
        reason = request.data.get('reason', 'Manual credit by admin')
        txn = wallet.credit(amount, reason=reason, reference_type='AdminCredit')
        return Response({
            'status': 'credited',
            'new_balance': str(wallet.balance),
            'transaction_id': txn.id,
        })

    @action(detail=True, methods=['post'])
    def manual_debit(self, request, pk=None):
        wallet = self.get_object()
        amount = request.data.get('amount', 0)
        reason = request.data.get('reason', 'Manual debit by admin')
        try:
            txn = wallet.debit(amount, reason=reason, reference_type='AdminDebit')
            return Response({
                'status': 'debited',
                'new_balance': str(wallet.balance),
                'transaction_id': txn.id,
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


# =============================================================================
# CLIENT-SIDE: Dashboard
# =============================================================================

class ClientDashboardViewSet(viewsets.ViewSet):
    """Client portal dashboard with aggregated metrics."""
    permission_classes = [IsAuthenticated, IsClientUser]

    def list(self, request):
        access = request.user.client_access
        contact = access.contact
        org = contact.organization

        orders = ClientOrder.objects.filter(organization=org, contact=contact)
        total_orders = orders.exclude(status='CART').count()
        active_orders = orders.exclude(status__in=['DELIVERED', 'CANCELLED', 'CART']).count()
        total_spent = orders.filter(status='DELIVERED').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0.00')

        wallet_balance = Decimal('0.00')
        loyalty_points = 0
        barcode = access.barcode or ''
        try:
            wallet = contact.wallet
            wallet_balance = wallet.balance
            loyalty_points = wallet.loyalty_points
        except ClientWallet.DoesNotExist:
            pass

        # Determine tier from CRM
        tier = 'STANDARD'
        if hasattr(contact, 'total_purchase_amount'):
            lv = contact.total_purchase_amount or 0
            if lv >= 50000:
                tier = 'WHOLESALE'
            elif lv >= 5000:
                tier = 'VIP'

        open_tickets = ClientTicket.objects.filter(
            organization=org, contact=contact,
            status__in=['OPEN', 'IN_PROGRESS']
        ).count()

        # Include org config for client-side display
        config = ClientPortalConfig.get_config(org)

        data = {
            'total_orders': total_orders,
            'active_orders': active_orders,
            'total_spent': total_spent,
            'wallet_balance': wallet_balance,
            'loyalty_points': loyalty_points,
            'loyalty_tier': tier,
            'open_tickets': open_tickets,
            'barcode': barcode,
            # Per-org config for client UI
            'loyalty_enabled': config.loyalty_enabled,
            'loyalty_earn_rate': str(config.loyalty_earn_rate),
            'loyalty_redemption_ratio': str(config.loyalty_redemption_ratio),
            'loyalty_min_redeem': config.loyalty_min_redeem,
            'wallet_enabled': config.wallet_enabled,
            'ecommerce_enabled': config.ecommerce_enabled,
            'tickets_enabled': config.tickets_enabled,
        }

        serializer = ClientDashboardSerializer(data)
        return Response(serializer.data)


# =============================================================================
# CLIENT-SIDE: My Orders
# =============================================================================

class ClientMyOrdersViewSet(viewsets.ModelViewSet):
    """Client views and manages their own orders."""
    serializer_class = ClientOrderSerializer
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'PLACE_ORDERS'

    def get_queryset(self):
        if not hasattr(self.request.user, 'client_access'):
            return ClientOrder.objects.none()
        contact = self.request.user.client_access.contact
        return ClientOrder.objects.filter(
            organization=contact.organization, contact=contact
        ).prefetch_related('lines')

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientOrderListSerializer
        return ClientOrderSerializer

    def perform_create(self, serializer):
        access = self.request.user.client_access
        order = serializer.save(
            organization=access.contact.organization,
            contact=access.contact,
        )

        # If order is created as PLACED with CARD payment, trigger Stripe
        if order.status == 'PLACED' and order.payment_method == 'CARD':
            try:
                StripeGatewayService = connector.require('finance.gateways.get_stripe_service', org_id=0, source='client_portal')
                service = StripeGatewayService(order.organization_id)
                
                amount_to_charge = order.total_amount - order.wallet_amount
                if amount_to_charge > 0:
                    intent = service.create_payment_intent(
                        amount=amount_to_charge,
                        currency=order.currency.lower(),
                        metadata={
                            'order_id': order.id,
                            'order_number': order.order_number,
                            'contact_id': order.contact_id,
                            'type': 'CLIENT_ORDER'
                        },
                        customer_email=self.request.user.email
                    )
                    if 'error' not in intent:
                        # Attach as temporary attribute so serializer can access it
                        order.stripe_client_secret = intent['client_secret']
                        order.stripe_payment_intent_id = intent['payment_intent_id']
            except Exception as e:
                logger.error(f"Stripe error in perform_create: {e}")


    @action(detail=True, methods=['post'])
    def add_to_cart(self, request, pk=None):
        order = self.get_object()
        if order.status != 'CART':
            return Response({'error': 'Order is not in CART status'}, status=400)
        line_data = request.data.copy()
        line_data['order'] = order.id
        line_data['organization'] = order.organization_id

        pricing_breakdown = None
        if 'product' in line_data and not line_data.get('product_name'):
            try:
                Product = connector.require('inventory.products.get_model', org_id=0, source='client_portal')
                PricingService = connector.require('crm.pricing.get_service', org_id=0, source='client_portal')
                product = Product.objects.get(id=line_data['product'])
                quantity = Decimal(str(line_data.get('quantity', '1')))

                # Resolve tier-aware price for this contact
                breakdown = PricingService.get_price_breakdown(
                    product=product,
                    contact=order.contact,
                    quantity=quantity,
                    organization=order.organization,
                )
                line_data['product_name'] = product.name
                line_data['unit_price'] = str(breakdown['effective_price'])
                line_data['tax_rate'] = str(product.tva_rate)
                pricing_breakdown = breakdown
            except Exception:
                pass

        serializer = ClientOrderLineSerializer(data=line_data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=order.organization)
        order.recalculate_totals()

        response_data = serializer.data
        if pricing_breakdown:
            response_data = dict(response_data)
            response_data['pricing'] = {
                'effective_price': str(pricing_breakdown['effective_price']),
                'base_price': str(pricing_breakdown['base_price']),
                'discount_applied': pricing_breakdown['discount_applied'],
                'discount_source': pricing_breakdown['discount_source'],
                'discount_amount': str(pricing_breakdown['discount_amount']),
                'discount_percent': str(pricing_breakdown['discount_percent']),
                'price_group_name': pricing_breakdown['price_group_name'],
            }
        return Response(response_data, status=201)

    @action(detail=True, methods=['post'])
    def place_order(self, request, pk=None):
        order = self.get_object()
        if order.status != 'CART':
            return Response({'error': 'Order is not in CART status'}, status=400)
        if not order.lines.exists():
            return Response({'error': 'Cart is empty'}, status=400)

        # Use org config for delivery fee and minimum order
        config = ClientPortalConfig.get_config(order.organization)

        if not config.ecommerce_enabled:
            return Response({'error': 'eCommerce is disabled for this organization'}, status=403)

        order.recalculate_totals()

        if config.min_order_amount > 0 and order.subtotal < config.min_order_amount:
            return Response({
                'error': f'Minimum order amount is {config.min_order_amount}'
            }, status=400)

        # Shipping fee — zone-aware if zone_id is provided, else use org default
        shipping_zone_id = request.data.get('shipping_zone_id')
        if shipping_zone_id:
            try:
                from apps.client_portal.shipping_service import ShippingService
                weight = ShippingService.get_cart_weight(order)
                order.delivery_fee = ShippingService.calculate_rate(
                    zone_id=int(shipping_zone_id),
                    organization=order.organization,
                    order_subtotal=order.subtotal,
                    total_weight_kg=weight,
                )
            except (ValueError, Exception) as e:
                return Response({'error': f'Shipping zone error: {e}'}, status=400)
        else:
            order.delivery_fee = config.get_delivery_fee(order.subtotal)
        order.recalculate_totals()

        # Auto-apply cart promotions (BOGO, bundle, spend threshold)
        try:
            from apps.client_portal.promotion_service import PromotionService
            PromotionService.apply_promotions(order)
        except Exception as promo_err:
            logger.warning(f"[place_order] Promotion evaluation failed: {promo_err}")

        # Handle wallet payment
        wallet_amount = Decimal(str(request.data.get('wallet_amount', 0)))
        if wallet_amount > 0:
            if not config.allow_wallet_payment:
                return Response({'error': 'Wallet payment is disabled'}, status=400)
            try:
                wallet = order.contact.wallet
                wallet.debit(wallet_amount, reason=f'Payment for {order.order_number}',
                            reference_type='ClientOrder', reference_id=order.id)
                order.wallet_amount = wallet_amount
            except (ValueError, ClientWallet.DoesNotExist) as e:
                return Response({'error': str(e)}, status=400)

        order.status = 'PLACED'
        order.placed_at = timezone.now()
        order.payment_method = request.data.get('payment_method', order.payment_method)
        order.delivery_address = request.data.get('delivery_address', order.delivery_address)
        order.delivery_phone = request.data.get('delivery_phone', order.delivery_phone)
        order.delivery_notes = request.data.get('delivery_notes', order.delivery_notes)
        order.save()

        # ── Stock Reservation ────────────────────────────────────────────
        # Soft-lock inventory for each line immediately on PLACED,
        # preventing concurrent orders from overselling during the
        # PLACED → CONFIRMED window. Released automatically on CANCEL.
        config = ClientPortalConfig.get_config(order.organization)
        if getattr(config, 'inventory_check_mode', 'STRICT') != 'DISABLED':
            try:
                StockReservationService = connector.require('inventory.services.get_reservation_service', org_id=0, source='client_portal')
                StockReservationError = connector.require('inventory.services.get_reservation_error', org_id=0, source='client_portal')
                from apps.client_portal.warehouse_router import WarehouseRouter

                for line in order.lines.select_related('product').all():
                    if not line.product:
                        continue
                    try:
                        wh = WarehouseRouter.select_warehouse(
                            organization=order.organization,
                            product=line.product,
                            quantity=line.quantity,
                            contact=order.contact,
                            check_mode='STRICT',
                        )
                    except ValueError:
                        wh = None
                    if wh:
                        StockReservationService.reserve(order, wh, user=request.user)
            except StockReservationError as sre:
                # Roll back order status — can't place if out of stock
                order.status = 'CART'
                order.placed_at = None
                order.save(update_fields=['status', 'placed_at'])
                return Response({'error': str(sre)}, status=400)
            except Exception as res_err:
                logger.warning(f"[place_order] Stock reservation failed (non-blocking): {res_err}")

        response_data = {'status': 'placed', 'order_number': order.order_number}

        # Handle Stripe Card Payment
        if order.payment_method == 'CARD':
            try:
                StripeGatewayService = connector.require('finance.gateways.get_stripe_service', org_id=0, source='client_portal')
                service = StripeGatewayService(order.organization_id)
                
                amount_to_charge = order.total_amount - order.wallet_amount
                if amount_to_charge > 0:
                    intent = service.create_payment_intent(
                        amount=amount_to_charge,
                        currency=order.currency.lower(),
                        metadata={
                            'order_id': order.id,
                            'order_number': order.order_number,
                            'contact_id': order.contact_id,
                            'type': 'CLIENT_ORDER'
                        },
                        customer_email=self.request.user.email
                    )
                    if 'error' in intent:
                        return Response({'error': intent['error']}, status=400)
                    
                    response_data['stripe_client_secret'] = intent['client_secret']
                    response_data['stripe_payment_intent_id'] = intent['payment_intent_id']
            except Exception as e:
                logger.error(f"Stripe error in place_order: {e}")

        # ── 3. Integrated Checkout Execution ────────────────────────────
        # ── 3. Integrated Checkout Execution ────────────────────────────
        # Trigger Inventory reduction, Commercial Invoice, CRM Analytics, Domain Events
        try:
            IntegratedCheckoutService.process_checkout(order.id, user=request.user)
            response_data['status'] = 'confirmed'
        except ValidationError as e:
            # If stock reduction or validation fails, rollback occurs in service
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            logger.error(f"Integrated checkout integration failed: {e}")
            return Response({'error': str(e)}, status=500)

        return Response(response_data)

    @action(detail=True, methods=['get'], url_path='shipping-rates')
    def shipping_rates(self, request, pk=None):
        """
        Returns available shipping zones with computed fees for this cart.
        Call from the checkout UI before the customer selects a shipping method.

        GET /api/client-portal/my-orders/{id}/shipping-rates/
        Response: { shipping_rates: [{zone_id, zone_name, fee, estimated_days, is_free}], cart_weight_kg }
        """
        order = self.get_object()
        if order.status != 'CART':
            return Response({'error': 'Order must be in CART status'}, status=400)

        from apps.client_portal.shipping_service import ShippingService
        weight = ShippingService.get_cart_weight(order)
        rates = ShippingService.get_available_methods(
            organization=order.organization,
            order_subtotal=order.subtotal,
            total_weight_kg=weight,
            contact=order.contact,
        )
        return Response({'shipping_rates': rates, 'cart_weight_kg': str(weight)})

    @action(detail=True, methods=['post'])
    def rate_delivery(self, request, pk=None):
        order = self.get_object()
        if order.status != 'DELIVERED':
            return Response({'error': 'Can only rate delivered orders'}, status=400)
        order.delivery_rating = request.data.get('rating')
        order.delivery_feedback = request.data.get('feedback', '')
        order.save(update_fields=['delivery_rating', 'delivery_feedback', 'updated_at'])
        return Response({'status': 'rated'})

    @action(detail=True, methods=['post'], url_path='apply-coupon')
    def apply_coupon(self, request, pk=None):
        """
        Apply a discount coupon to an order that is still in CART status.

        Body:
            { "code": "SUMMER25" }

        Returns updated order totals on success.
        """
        order = self.get_object()

        if order.status != 'CART':
            return Response(
                {'error': 'Coupons can only be applied to orders in CART status.'},
                status=400,
            )

        code = request.data.get('code', '').strip().upper()
        if not code:
            return Response({'error': 'Coupon code is required.'}, status=400)

        from apps.client_portal.models import Coupon, CouponUsage
        from django.db import transaction as db_transaction

        try:
            coupon = Coupon.objects.get(
                organization=order.organization,
                code=code,
            )
        except Coupon.DoesNotExist:
            return Response({'error': f"Coupon '{code}' not found."}, status=404)

        # Validate coupon against this order
        is_valid, reason = coupon.is_valid(
            order_subtotal=order.subtotal,
            contact=order.contact,
        )
        if not is_valid:
            return Response({'error': reason}, status=400)

        # Remove any previously applied coupon for this order (replace logic)
        CouponUsage.objects.filter(order=order).select_related('coupon').update()  # just for clarity
        existing = CouponUsage.objects.filter(order=order).first()
        if existing:
            # Reverse old discount before applying new one
            old_discount = existing.discount_applied
            order.discount_amount -= old_discount
            existing.coupon.used_count -= 1
            existing.coupon.save(update_fields=['used_count'])
            existing.delete()

        # Calculate and apply discount
        with db_transaction.atomic():
            discount = coupon.calculate_discount(order.subtotal)
            order.discount_amount = discount
            order.recalculate_totals()

            # Record usage
            CouponUsage.objects.create(
                organization=order.organization,
                coupon=coupon,
                contact=order.contact,
                order=order,
                discount_applied=discount,
            )

            # Increment usage counter
            coupon.used_count += 1
            coupon.save(update_fields=['used_count', 'updated_at'])

        return Response({
            'status': 'applied',
            'coupon_code': code,
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.value),
            'discount_applied': str(discount),
            'new_total': str(order.total_amount),
            'new_subtotal': str(order.subtotal),
        })


    @action(detail=False, methods=['get'], url_path='account-summary')
    def account_summary(self, request):
        """
        Returns a summary of the customer's account for the storefront dashboard.

        GET /api/client-portal/my-orders/account-summary/
        Response: {
          orders_count, total_spent, pending_count,
          loyalty_points, wallet_balance, currency
        }
        """
        if not hasattr(request.user, 'client_access'):
            return Response({'error': 'No client access'}, status=403)

        contact = request.user.client_access.contact
        org = contact.organization
        from django.db.models import Sum, Count

        orders_qs = ClientOrder.objects.filter(organization=org, contact=contact)
        agg = orders_qs.aggregate(
            total_spent=Sum('total_amount'),
            orders_count=Count('id'),
        )
        pending_count = orders_qs.filter(
            status__in=['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED']
        ).count()

        # Loyalty + wallet
        loyalty_points = 0
        wallet_balance = 0
        currency = 'USD'
        try:
            wallet = contact.wallet
            loyalty_points = wallet.loyalty_points
            wallet_balance = float(wallet.balance)
            config = ClientPortalConfig.get_config(org)
            currency = config.wallet_currency
        except Exception:
            pass

        return Response({
            'orders_count': agg['orders_count'] or 0,
            'total_spent': str(agg['total_spent'] or '0.00'),
            'pending_count': pending_count,
            'loyalty_points': loyalty_points,
            'wallet_balance': str(wallet_balance),
            'currency': currency,
        })

    @action(detail=True, methods=['get'], url_path='track')
    def track(self, request, pk=None):
        """
        Returns the order status timeline for live customer tracking.

        GET /api/client-portal/my-orders/{id}/track/
        Response: { status, estimated_delivery, delivered_at, timeline: [{status, label, date, note}] }
        """
        order = self.get_object()

        STATUS_LABELS = {
            'CART': 'In Cart', 'PLACED': 'Order Placed', 'CONFIRMED': 'Confirmed',
            'PROCESSING': 'Processing', 'SHIPPED': 'Shipped', 'DELIVERED': 'Delivered',
            'CANCELLED': 'Cancelled', 'RETURNED': 'Returned',
        }
        STATUS_ORDER = ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

        # Build timeline from order notes (each transition appends a note)
        timeline = []
        if order.placed_at:
            timeline.append({
                'status': 'PLACED',
                'label': 'Order Placed',
                'date': order.placed_at.isoformat(),
                'note': '',
            })

        # Parse notes for transition records: [YYYY-MM-DD HH:MM] OLD→NEW: note
        import re
        note_pattern = re.compile(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] \w+→(\w+)(?:: (.*))?')
        for match in note_pattern.finditer(order.notes or ''):
            ts, status_code, note_text = match.groups()
            timeline.append({
                'status': status_code,
                'label': STATUS_LABELS.get(status_code, status_code),
                'date': ts,
                'note': (note_text or '').strip(),
            })

        if order.delivered_at:
            # Ensure DELIVERED is always in timeline with exact timestamp
            if not any(e['status'] == 'DELIVERED' for e in timeline):
                timeline.append({
                    'status': 'DELIVERED',
                    'label': 'Delivered',
                    'date': order.delivered_at.isoformat(),
                    'note': '',
                })

        return Response({
            'order_number': order.order_number,
            'status': order.status,
            'status_label': STATUS_LABELS.get(order.status, order.status),
            'estimated_delivery': order.estimated_delivery.isoformat() if order.estimated_delivery else None,
            'delivered_at': order.delivered_at.isoformat() if order.delivered_at else None,
            'timeline': sorted(timeline, key=lambda e: e['date']),
        })

    @action(detail=True, methods=['post'], url_path='request-return')
    def request_return(self, request, pk=None):
        """
        Customer raises a return/refund request for a delivered order.

        POST /api/client-portal/my-orders/{id}/request-return/
        Body: { "reason": "Wrong item received", "items": [{"line_id": 3, "qty": 1}] }
        """
        order = self.get_object()
        if order.status not in ('DELIVERED',):
            return Response({'error': 'Only delivered orders can be returned.'}, status=400)

        reason = request.data.get('reason', '').strip()
        items = request.data.get('items', [])
        if not reason:
            return Response({'error': 'A return reason is required.'}, status=400)

        # Build item summary for ticket description
        item_lines = '\n'.join(
            f"  - Line #{i.get('line_id')} × {i.get('qty', 1)}" for i in items
        ) or '  (All items)'

        from apps.client_portal.models import ClientTicket
        ticket = ClientTicket.objects.create(
            organization=order.organization,
            contact=order.contact,
            subject=f"Return Request — Order #{order.order_number}",
            message=f"Reason: {reason}\n\nItems:\n{item_lines}",
            ticket_type='RETURN',
            status='OPEN',
            related_order=order,
        )
        logger.info(f"[Return] Ticket #{ticket.id} created for order {order.order_number}")
        return Response({
            'status': 'submitted',
            'ticket_id': ticket.id,
            'message': 'Your return request has been submitted. Our team will contact you shortly.',
        }, status=201)


# =============================================================================
# CLIENT-SIDE: Wallet
# =============================================================================

class ClientWalletViewSet(viewsets.ViewSet):
    """Client views their wallet and transaction history."""
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'VIEW_WALLET'

    def list(self, request):
        access = request.user.client_access
        wallet, _ = ClientWallet.objects.get_or_create(
            organization=access.contact.organization,
            contact=access.contact,
        )
        serializer = ClientWalletSerializer(wallet)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        access = request.user.client_access
        try:
            wallet = access.contact.wallet
            txns = wallet.transactions.all()[:50]
            serializer = WalletTransactionSerializer(txns, many=True)
            return Response(serializer.data)
        except ClientWallet.DoesNotExist:
            return Response([])

    @action(detail=False, methods=['post'])
    def redeem_points(self, request):
        if not request.user.client_access.has_permission('REDEEM_LOYALTY'):
            return Response({'error': 'No REDEEM_LOYALTY permission'}, status=403)
        access = request.user.client_access
        org = access.contact.organization
        config = ClientPortalConfig.get_config(org)

        if not config.loyalty_enabled:
            return Response({'error': 'Loyalty system is disabled for this organization'}, status=403)

        points = int(request.data.get('points', 0))

        if points < config.loyalty_min_redeem:
            return Response({
                'error': f'Minimum redemption is {config.loyalty_min_redeem} points'
            }, status=400)

        try:
            wallet = access.contact.wallet
            # Use org-configured redemption ratio
            discount = config.get_loyalty_value(points)
            txn = wallet.redeem_loyalty_points(points, discount)
            return Response({
                'status': 'redeemed',
                'points_used': points,
                'discount': str(discount),
                'redemption_ratio': str(config.loyalty_redemption_ratio),
                'new_balance': str(wallet.balance),
                'remaining_points': wallet.loyalty_points,
            })
        except (ValueError, ClientWallet.DoesNotExist) as e:
            return Response({'error': str(e)}, status=400)


# =============================================================================
# CLIENT-SIDE: Tickets
# =============================================================================

class ClientMyTicketsViewSet(viewsets.ModelViewSet):
    """Client creates and tracks support tickets."""
    serializer_class = ClientTicketSerializer
    permission_classes = [IsAuthenticated, IsClientUser, HasClientPermission]
    client_permission = 'SUBMIT_TICKETS'

    def get_queryset(self):
        if not hasattr(self.request.user, 'client_access'):
            return ClientTicket.objects.none()
        contact = self.request.user.client_access.contact
        return ClientTicket.objects.filter(
            organization=contact.organization, contact=contact
        )

    def perform_create(self, serializer):
        access = self.request.user.client_access
        serializer.save(
            organization=access.contact.organization,
            contact=access.contact,
        )

    @action(detail=True, methods=['post'])
    def rate_resolution(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status not in ('RESOLVED', 'CLOSED'):
            return Response({'error': 'Can only rate resolved/closed tickets'}, status=400)
        ticket.satisfaction_rating = request.data.get('rating')
        ticket.satisfaction_feedback = request.data.get('feedback', '')
        ticket.save(update_fields=['satisfaction_rating', 'satisfaction_feedback', 'updated_at'])
        return Response({'status': 'rated'})


# =============================================================================
# ADMIN: Order lines
# =============================================================================

class ClientOrderLineViewSet(TenantModelViewSet):
    """Admin management of client order lines."""
    queryset = ClientOrderLine.objects.select_related('product').all()
    serializer_class = ClientOrderLineSerializer


# =============================================================================
# ADMIN: Portal Configuration
# =============================================================================

class ClientPortalConfigViewSet(TenantModelViewSet):
    """Admin management of per-org Client Portal configuration."""
    queryset = ClientPortalConfig.objects.all()
    serializer_class = None  # will use generic serializer below

    def get_serializer_class(self):
        from .serializers import ClientPortalConfigSerializer
        return ClientPortalConfigSerializer

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current org's config (auto-creates with defaults if none exists)."""
        from erp.middleware import get_current_tenant_id
        from erp.models import Organization
        
        org = request.user.organization
        if not org:
            organization_id = get_current_tenant_id()
            if organization_id:
                try:
                    org = Organization.objects.get(id=organization_id)
                except Organization.DoesNotExist:
                    pass
        
        if not org and (request.user.is_staff or request.user.is_superuser):
            # SaaS Admin fallback: If no explicit organization context, use the first available org.
            # This allows Platform Admins to access settings from the SaaS root.
            org = Organization.objects.first()

        if not org:
            return Response({"error": "No organization context found"}, status=400)

        config = ClientPortalConfig.get_config(org)
        from .serializers import ClientPortalConfigSerializer
        return Response(ClientPortalConfigSerializer(config).data)


class ProductReviewViewSet(viewsets.ModelViewSet):
    """API for product reviews."""
    queryset = ProductReview.objects.filter(is_visible=True)
    serializer_class = ProductReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def perform_create(self, serializer):
        from erp.middleware import get_current_tenant_id
        from erp.models import Organization
        
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)
        
        # Auto-assign contact if user is logged in
        contact = None
        if hasattr(self.request.user, 'client_access'):
            contact = self.request.user.client_access.contact
        
        serializer.save(
            organization=org,
            contact=contact,
            name=self.request.user.first_name or self.request.user.email
        )


class WishlistItemViewSet(viewsets.ModelViewSet):
    """API for customer wishlist."""
    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not hasattr(self.request.user, 'client_access'):
            return WishlistItem.objects.none()
        return WishlistItem.objects.filter(contact=self.request.user.client_access.contact)

    def perform_create(self, serializer):
        from erp.middleware import get_current_tenant_id
        from erp.models import Organization
        
        organization_id = get_current_tenant_id()
        org = Organization.objects.get(id=organization_id)
        
        if not hasattr(self.request.user, 'client_access'):
            raise serializers.ValidationError("Only customers with portal access can have a wishlist.")
        
        serializer.save(
            organization=org,
            contact=self.request.user.client_access.contact
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Returns e-commerce analytics for the current organization."""
        org = request.user.organization
        # Real stats from ClientOrder
        total_orders = ClientOrder.objects.filter(organization=org).exclude(status='CART').count()
        total_revenue = ClientOrder.objects.filter(organization=org, payment_status='PAID').aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        pending_orders = ClientOrder.objects.filter(organization=org, status='PENDING').count()
        
        last_month = timezone.now() - timezone.timedelta(days=30)
        monthly_orders = ClientOrder.objects.filter(organization=org, created_at__gte=last_month).exclude(status='CART').count()
        monthly_revenue = ClientOrder.objects.filter(
            organization=org, payment_status='PAID', created_at__gte=last_month
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        
        # Breakdown by status
        status_counts = ClientOrder.objects.filter(organization=org).values('status').annotate(count=Count('id'))
        status_map = {s['status']: s['count'] for s in status_counts}

        return Response({
            'total_orders': total_orders,
            'monthly_orders': monthly_orders,
            'monthly_revenue': str(monthly_revenue),
            'total_revenue': str(total_revenue),
            'pending': status_map.get('PENDING', 0),
            'processing': status_map.get('PROCESSING', 0),
            'shipped': status_map.get('SHIPPED', 0),
            'delivered': status_map.get('DELIVERED', 0),
        })

    @action(detail=False, methods=['get'])
    def abandoned_carts(self, request):
        """List orders stuck in 'CART' status for more than 24 hours."""
        org = request.user.organization
        cutoff = timezone.now() - timezone.timedelta(hours=24)
        carts = ClientOrder.objects.filter(
            organization=org, status='CART', created_at__lt=cutoff
        ).select_related('contact').order_by('-created_at')
        
        return Response([{
            'id': c.id,
            'order_number': c.order_number,
            'contact_name': c.contact.name if c.contact else 'Guest',
            'email': c.contact.email if c.contact else 'Unknown',
            'amount': str(c.total_amount),
            'created_at': c.created_at,
        } for c in carts])

# =============================================================================
# QUOTE REQUESTS (CATALOGUE MODE)
# =============================================================================

class QuoteRequestViewSet(TenantModelViewSet):
    """
    ViewSet for handling Quote Requests.
    Creation is public (AllowAny), while viewing and managing is restricted to staff.
    """
    queryset = QuoteRequest.objects.all()
    serializer_class = QuoteRequestSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        org = None
        # Try to resolve organization from authenticated user
        if self.request.user.is_authenticated and hasattr(self.request.user, 'organization'):
            org = self.request.user.organization
        else:
            # Resolve from header X-Tenant-Id (slug) for guest visitors
            org_slug = self.request.headers.get('X-Tenant-Id')
            if org_slug:
                from erp.models import Organization
                org = Organization.objects.filter(slug=org_slug).first()

        if org:
            # Handle contact linking for logged-in clients
            contact = None
            if self.request.user.is_authenticated:
                try:
                    contact = self.request.user.client_access.contact
                except Exception:
                    pass

            serializer.save(organization=org, contact=contact)
        else:
            # If organization cannot be determined, let it fail with validation error or use default logic
            super().perform_create(serializer)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        """
        Admin: respond to a quote request with a price and notes.
        Transitions status → QUOTED.
        """
        quote = self.get_object()
        quoted_price = request.data.get('quoted_price')
        quoted_notes = request.data.get('quoted_notes', '')

        if not quoted_price:
            return Response({'error': 'quoted_price is required'}, status=400)

        quote.quoted_price = quoted_price
        quote.quoted_notes = quoted_notes
        quote.status = 'QUOTED'
        quote.save(update_fields=['quoted_price', 'quoted_notes', 'status', 'updated_at'])

        logger.info(
            f"[QuoteRequest] #{quote.id} → QUOTED by {request.user} "
            f"at price={quoted_price}"
        )
        return Response({
            'status': 'quoted',
            'id': quote.id,
            'quoted_price': str(quoted_price),
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Admin: reject a quote request."""
        quote = self.get_object()
        quote.status = 'REJECTED'
        quote.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'rejected'})
