from .base import Decimal, ValidationError, transaction, timezone, _safe_import
from apps.pos.models import Order, OrderLine
from erp.services import ConfigurationService

class POSService:
    @staticmethod
    def checkout(organization, user, warehouse, payment_account_id, items, scope='OFFICIAL',
                 contact_id=None, payment_method='CASH', points_redeemed=0,
                 store_change_in_wallet=False, cash_received=0):
        
        # Gated cross-module imports
        (Product,) = _safe_import('apps.inventory.models', ['Product'])
        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        (LedgerService, SequenceService, ForensicAuditService) = _safe_import(
            'apps.finance.services', ['LedgerService', 'SequenceService', 'ForensicAuditService']
        )

        if not Product or not InventoryService:
            raise ValidationError("Inventory module is required for POS checkout.")
        if not LedgerService or not SequenceService:
            raise ValidationError("Finance module is required for POS checkout.")
        """
        items: list of {'product_id': id, 'quantity': q, 'unit_price': p}
        """
        with transaction.atomic():
            total_amount = Decimal('0')
            total_tax = Decimal('0')
            total_cogs = Decimal('0')

            # 1. Dual-Mode Gapless Sequencing
            sequence_type = f"SALE_{scope.upper()}"
            invoice_num = SequenceService.get_next_number(organization, sequence_type)

            # 2. Cryptographic Chaining Context (Scope-Isolated)
            last_order = Order.objects.filter(
                organization=organization,
                scope=scope
            ).order_by('-created_at', '-id').first()
            prev_hash = last_order.receipt_hash if last_order else "GENESIS"

            order = Order.objects.create(
                organization=organization,
                user=user,
                site=warehouse.site,
                type='SALE',
                status='COMPLETED',
                scope=scope,
                invoice_number=invoice_num,
                previous_hash=prev_hash,
                payment_method=payment_method,
                contact_id=contact_id
            )

            for item in items:
                # 3. Atomic Serializability: Lock Product
                product = Product.objects.select_for_update().get(id=item['product_id'], organization=organization)
                qty = Decimal(str(item['quantity']))
                price = Decimal(str(item['unit_price']))

                # 4. Forensic Price Audit: Check for Overrides
                is_override = False
                base_price = product.selling_price_ttc or Decimal('0.00')
                if price < base_price * Decimal('0.95'): # 5% threshold for "anomaly"
                    is_override = True

                # 4.1 Margin Guard: Prevent loss-making sales
                margin_threshold = ConfigurationService.get_setting(organization, 'margin_guard_threshold', 1.0)
                cost_price = product.cost_price or Decimal('0.00')
                if price < (cost_price * Decimal(str(margin_threshold))):
                    raise ValidationError(
                        f"MARGIN ALERT: Sale blocked for '{product.name}'. Price {price} is below "
                        f"minimum margin threshold (Cost: {cost_price} x {margin_threshold})."
                    )

                amc = InventoryService.reduce_stock(
                    organization=organization,
                    product=product,
                    warehouse=warehouse,
                    quantity=qty,
                    reference=f"POS-{order.id}",
                    serials=item.get('serials'),
                    user=user
                )

                tax_rate = Decimal(str(product.tva_rate))
                item_total = qty * price
                item_tax = item_total * tax_rate
                item_cogs = qty * amc

                total_amount += (item_total + item_tax)
                total_tax += item_tax
                total_cogs += item_cogs

                OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=price,
                    tax_rate=tax_rate,
                    total=(item_total + item_tax),
                    unit_cost_ht=amc,
                    effective_cost=amc,
                    price_override_detected=is_override
                )

                if is_override and ForensicAuditService:
                    ForensicAuditService.log_mutation(
                        organization=organization,
                        user=user,
                        model_name="POS_OrderLine",
                        object_id=order.id,
                        change_type="PRICE_OVERRIDE",
                        payload={
                            "product": product.name,
                            "base_price": str(base_price),
                            "sold_price": str(price),
                            "qty": str(qty)
                        }
                    )

            order.total_amount = total_amount
            order.tax_amount = total_tax

            # Loyalty & Wallet CRM update
            (Contact,) = _safe_import('apps.crm.models', ['Contact'])
            contact = None
            if contact_id and Contact:
                contact = Contact.objects.select_for_update().filter(id=contact_id, organization=organization).first()
                if contact:
                    # 1. Redeem Points
                    pts_to_redeem = Decimal(str(points_redeemed))
                    if pts_to_redeem > 0 and contact.loyalty_points >= pts_to_redeem:
                        contact.loyalty_points -= pts_to_redeem

                    # 2. Earn Points (e.g. 1 point per $10 spent)
                    earned_points = int(total_amount / Decimal('10.0'))
                    contact.loyalty_points += Decimal(str(earned_points))

                    # 3. Store Change in Wallet
                    cash_received_dec = Decimal(str(cash_received))
                    change_due = max(Decimal('0'), cash_received_dec - total_amount)

                    wallet_added = Decimal('0')
                    if store_change_in_wallet and change_due > 0 and payment_method in ['CASH']:
                        contact.wallet_balance += change_due
                        wallet_added = change_due

                    contact.save()

            # 5. Cryptographic Seal
            order.receipt_hash = order.calculate_hash()
            order.save(force_audit_bypass=True)

            # 6. Finance Chain Link
            rules = ConfigurationService.get_posting_rules(organization)
            rev_acc = rules.get('sales', {}).get('revenue')
            inv_acc = rules.get('sales', {}).get('inventory')
            cogs_acc = rules.get('sales', {}).get('cogs')
            tax_acc = rules.get('purchases', {}).get('tax')

            if not all([rev_acc, inv_acc, cogs_acc]):
                raise ValidationError("Missing sales posting rules mapping.")

            (FinancialAccount,) = _safe_import('apps.finance.models', ['FinancialAccount'])
            actual_payment_acc_id = payment_account_id
            if FinancialAccount:
                fin_acc = FinancialAccount.objects.filter(id=payment_account_id, organization=organization).first()
                actual_payment_acc_id = fin_acc.ledger_account_id if fin_acc else payment_account_id

            lines = [
                {"account_id": rev_acc, "debit": Decimal('0'), "credit": (total_amount - total_tax)},
                {"account_id": tax_acc or rev_acc, "debit": Decimal('0'), "credit": total_tax},
                {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0')},
                {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs},
            ]

            if contact and wallet_added > 0:
                # Wallet Liability Account
                wallet_liability_acc = rules.get('sales', {}).get('receivable') # Usually advances are liabilities, fallback to AR
                lines.append({"account_id": actual_payment_acc_id, "debit": (total_amount + wallet_added), "credit": Decimal('0')})
                lines.append({"account_id": wallet_liability_acc, "debit": Decimal('0'), "credit": wallet_added})
            else:
                lines.append({"account_id": actual_payment_acc_id, "debit": total_amount, "credit": Decimal('0')})

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"POS Sale {invoice_num} | ReceiptHash: {order.receipt_hash[:12]}...",
                reference=f"POS-{order.id}",
                status='POSTED',
                scope='INTERNAL',
                site_id=warehouse.site_id,
                user=user,
                lines=lines
            )

            return order
