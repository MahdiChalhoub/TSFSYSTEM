"""
Integrated Checkout Service
==========================
Handles the direct interaction between Client Portal Sales and:
- Inventory Management (Inventory reduction)
- Commercial/Financial (Invoice generation)
- CRM (Contact history & analytics)
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.client_portal.models import ClientOrder
from apps.inventory.services import InventoryService
from apps.finance.invoice_models import Invoice, InvoiceLine
from apps.finance.invoice_service import InvoiceService
from apps.crm.models import Contact

logger = logging.getLogger(__name__)

class IntegratedCheckoutService:
    @staticmethod
    def process_checkout(order_id, user=None):
        """
        Atomically process a client order:
        1. Validate stock
        2. Create Finance Invoice (Commercial)
        3. Deduct Inventory (Inventory)
        4. Update CRM Analytics (CRM)
        5. Record Payments (Financial)
        """
        with transaction.atomic():
            order = ClientOrder.objects.select_for_update().get(id=order_id)
            if order.status != 'PLACED':
                # If it's still CART, we mark it as PLACED now
                order.status = 'PLACED'
                order.placed_at = timezone.now()
                order.save(update_fields=['status', 'placed_at'])

            # ── 1. Inventory Interaction ──────────────────────────────────────
            # Respect the organization's inventory check policy
            from apps.client_portal.models import ClientPortalConfig
            config = ClientPortalConfig.get_config(order.organization)
            check_mode = getattr(config, 'inventory_check_mode', 'STRICT')

            if check_mode != 'DISABLED':
                # We pick the first available warehouse for simplicity, 
                # or use an org-wide default warehouse.
                from apps.inventory.models import Warehouse
                warehouse = Warehouse.objects.filter(organization=order.organization).first()
                if not warehouse:
                    raise ValidationError("No warehouse configured for this organization.")

                for line in order.lines.all():
                    if not line.product:
                        continue
                    
                    # Deduct stock (STRICT vs ALLOW_OVERSALE)
                    InventoryService.reduce_stock(
                        organization=order.organization,
                        product=line.product,
                        warehouse=warehouse,
                        quantity=line.quantity,
                        reference=order.order_number,
                        user=user,
                        scope='OFFICIAL',
                        allow_negative=(check_mode == 'ALLOW_OVERSALE')
                    )

            # ── 2. Commercial Interaction (Invoice) ───────────────────────────
            invoice = Invoice.objects.create(
                organization=order.organization,
                type='SALES',
                sub_type='RETAIL',
                status='SENT', # Storefront orders are immediately sent/issued
                contact=order.contact,
                contact_name=order.contact.name,
                contact_email=order.contact.email,
                contact_address=order.delivery_address or order.contact.address,
                issue_date=timezone.now().date(),
                due_date=timezone.now().date(), # Usually immediate for eCommerce
                currency=order.currency,
                subtotal_ht=order.subtotal - order.tax_amount, # Approx if not stored
                tax_amount=order.tax_amount,
                discount_amount=order.discount_amount,
                total_amount=order.total_amount,
                notes=f"Generated from Storefront Order #{order.order_number}",
                created_by=user
            )

            # Create Invoice Lines
            for idx, line in enumerate(order.lines.all()):
                InvoiceLine.objects.create(
                    invoice=invoice,
                    product=line.product,
                    description=line.product_name,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    tax_rate=line.tax_rate,
                    discount_percent=line.discount_percent,
                    sort_order=idx
                )
            
            # Recalculate to be sure
            invoice.recalculate_totals()
            
            # Link to order
            order.invoice = invoice
            order.status = 'CONFIRMED'
            order.save(update_fields=['invoice', 'status'])

            # ── 3. Financial Interaction (Payments) ───────────────────────────
            # If paid by wallet, record it in finance
            if order.wallet_amount > 0:
                InvoiceService.record_payment_for_invoice(
                    invoice=invoice,
                    amount=order.wallet_amount,
                    method='WALLET',
                    payment_account_id=None, # System will pick default
                    description=f"Wallet Payment for Order {order.order_number}",
                    reference=order.order_number,
                    user=user
                )

            # If the order is fully paid, mark status
            if invoice.balance_due <= 0:
                order.payment_status = 'PAID'
                order.save(update_fields=['payment_status'])

            # ── 4. CRM Interaction (Analytics) ────────────────────────────────
            contact = order.contact
            contact.total_orders += 1
            contact.lifetime_value += order.total_amount
            contact.last_purchase_date = timezone.now()
            if not contact.first_purchase_date:
                contact.first_purchase_date = timezone.now()
            contact.save(update_fields=['total_orders', 'lifetime_value', 'last_purchase_date', 'first_purchase_date'])

            logger.info(f"Integrated Checkout Success: Order {order.order_number} converted to Invoice {invoice.invoice_number}")

            return order, invoice
