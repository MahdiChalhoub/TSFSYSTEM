from .base import Decimal, ValidationError, transaction, timezone, _safe_import
from apps.pos.models import Order, OrderLine
from erp.services import ConfigurationService


def fire_audit_event(organization, user, event_type, event_name, details, reference_id=None):
    """
    Create a POSAuditEvent and trigger any configured POSAuditRule actions:
      - create_task=True  → Creates a URGENT Workspace Task assigned to the manager role
      - send_notification → Marks notification_pending on the event (picked up by polling)
    Also fires WorkspaceAutoTaskService auto-task rules.
    Safe: always wraps in try/except — never blocks a sale.
    """
    # POS event type → AutoTaskRule trigger_event mapping
    EVENT_TO_TRIGGER = {
        'PRICE_OVERRIDE':         'PRICE_CHANGE',
        'GLOBAL_DISCOUNT':        'CASHIER_DISCOUNT',
        'NEGATIVE_STOCK_OVERRIDE': 'NEGATIVE_STOCK',
        'CREDIT_SALE':            'CREDIT_SALE',
        'CLEAR_CART':             'CUSTOM',
        'REMOVE_ITEM':            'CUSTOM',
        'DECREASE_QTY':           'CUSTOM',
    }
    try:
        from apps.pos.models import POSAuditEvent, POSAuditRule
        event = POSAuditEvent.objects.create(
            organization=organization,
            user=user,
            event_type=event_type,
            event_name=event_name,
            details=details or {},
            reference_id=reference_id,
        )

        # ── POSAuditRule → immediate Task ─────────────────────────────────────
        try:
            rule = POSAuditRule.objects.filter(
                organization=organization,
                event_type=event_type,
                is_active=True
            ).first()

            if rule and rule.create_task:
                try:
                    from apps.workspace.models import Task
                    from erp.models import Role
                    manager_role = Role.objects.filter(
                        organization=organization,
                        name__icontains='manager'
                    ).first()
                    Task.objects.create(
                        organization=organization,
                        title=f'⚠️ POS Alert: {event_name}',
                        description=(
                            f"Event Type: {event_type}\n"
                            f"Reference: {reference_id or 'N/A'}\n"
                            f"Cashier: {user.get_full_name() or user.username if user else 'Unknown'}\n\n"
                            f"Details: {details}"
                        ),
                        priority='URGENT',
                        status='PENDING',
                        source='SYSTEM',
                        assigned_to_group=manager_role,
                        related_object_type='POSAuditEvent',
                        related_object_id=event.id,
                        related_object_label=event_name,
                    )
                except Exception:
                    pass

        except Exception:
            pass

        # ── AutoTaskRule engine ────────────────────────────────────────────────
        try:
            trigger = EVENT_TO_TRIGGER.get(event_type)
            if trigger:
                from apps.workspace.auto_task_service import fire_auto_tasks
                fire_auto_tasks(
                    organization=organization,
                    trigger_event=trigger,
                    context={
                        'user': user,
                        'amount': details.get('total') or details.get('discount_amount') or 0,
                        'reference': reference_id,
                        'cashier_id': user.id if user else None,
                        'extra': details,
                    }
                )
        except Exception:
            pass

        return event
    except Exception:
        return None


class POSService:
    @staticmethod
    def checkout(organization, user, warehouse, payment_account_id, items, scope='OFFICIAL',
                 contact_id=None, payment_method='CASH', points_redeemed=0,
                 store_change_in_wallet=False, cash_received=0, notes='',
                 global_discount=0, payment_legs=None):
        
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
                site=warehouse.parent or warehouse,
                type='SALE',
                status='COMPLETED',
                scope=scope,
                invoice_number=invoice_num,
                previous_hash=prev_hash,
                payment_method=payment_method,
                contact_id=contact_id,
                discount_amount=Decimal(str(global_discount or 0)),
                notes=notes or ''
            )

            # ── Resolve invoice type via new engine (scope guard + org policy) ──
            # _ctx safe-default: vat_active will be derived from policy; fallback is vat_active=True (OFFICIAL scope)
            try:
                from apps.finance.tax_calculator import TaxEngineContext, TaxCalculator
                _ctx = TaxEngineContext.from_org(organization, scope=scope, is_export=False)
                _client_vat_registered = False
                if contact_id:
                    (Contact,) = _safe_import('apps.crm.models', ['Contact'])
                    if Contact:
                        _c = Contact.objects.filter(id=contact_id, organization=organization).first()
                        if _c:
                            from apps.finance.tax_calculator import _ClientProfile
                            _client_vat_registered = _ClientProfile.from_contact(_c).vat_registered
                order.invoice_type = TaxCalculator.resolve_invoice_type(_ctx, _client_vat_registered)
            except Exception:
                from apps.finance.tax_calculator import TaxEngineContext
                _ctx = TaxEngineContext(scope=scope)  # safe default — scope guard still applies
                order.invoice_type = 'RECEIPT'





            for item in items:
                # 3. Atomic Serializability: Lock Product
                product = Product.objects.select_for_update().get(id=item['product_id'], organization=organization)
                qty = Decimal(str(item['quantity']))
                price = Decimal(str(item['unit_price']))
                discount_rate = Decimal(str(item.get('discount_rate', 0)))

                # 4. Forensic Price Audit: Check for Overrides
                is_override = False
                base_price = product.selling_price_ttc or Decimal('0.00')
                if price < base_price * Decimal('0.95'): # 5% threshold for "anomaly"
                    is_override = True

                # 4.1 Margin Guard: Prevent loss-making sales
                margin_threshold = ConfigurationService.get_setting(organization, 'margin_guard_threshold', 1.0)
                cost_price = product.cost_price or Decimal('0.00')
                
                # Apply discount to unit price for margin and total calculations
                unit_discount = price * (discount_rate / Decimal('100.0'))
                effective_price = price - unit_discount

                if effective_price < (cost_price * Decimal(str(margin_threshold))):
                    raise ValidationError(
                        f"MARGIN ALERT: Sale blocked for '{product.name}'. Effective Price {effective_price} is below "
                        f"minimum margin threshold (Cost: {cost_price} x {margin_threshold})."
                    )

                # ── Negative Stock Audit: log before reduce_stock clears it ──
                try:
                    from apps.inventory.models import Inventory as InvModel
                    from django.db.models import Sum as _Sum
                    current_stock = InvModel.objects.filter(
                        organization=organization,
                        product=product,
                        warehouse=warehouse
                    ).aggregate(total=_Sum('quantity'))['total'] or Decimal('0')
                    if current_stock <= Decimal('0'):
                        fire_audit_event(
                            organization=organization,
                            user=user,
                            event_type='NEGATIVE_STOCK_OVERRIDE',
                            event_name=f'Negative Stock Sale — {product.name}',
                            details={
                                'product': product.name,
                                'product_id': str(product.id),
                                'stock_at_sale': str(current_stock),
                                'qty_sold': str(qty),
                            },
                            reference_id=order.ref_code if order.ref_code else None
                        )
                except Exception:
                    pass  # Never block a sale due to audit logging failure

                amc = InventoryService.reduce_stock(
                    organization=organization,
                    product=product,
                    warehouse=warehouse,
                    quantity=qty,
                    reference=f"POS-{order.id}",
                    serials=item.get('serials'),
                    user=user
                )

                tax_rate = Decimal(str(product.tva_rate)) / Decimal('100')
                item_total = qty * effective_price
                item_tax = (item_total * tax_rate).quantize(Decimal('0.01'))
                item_cogs = qty * amc

                total_amount += (item_total + item_tax)
                total_tax += item_tax
                total_cogs += item_cogs

                line_obj = OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=price,  # Store original price
                    discount_rate=discount_rate, # Store applied discount
                    tax_rate=tax_rate,
                    total=(item_total + item_tax),
                    unit_cost_ht=amc,
                    effective_cost=amc,
                    price_override_detected=is_override
                )

                # ── Record per-line tax entries (scope guard: no VAT if INTERNAL) ──
                try:
                    from apps.pos.models import OrderLineTaxEntry
                    if item_tax > 0 and _ctx.vat_active:
                        tax_type = 'VAT'
                        cost_ratio = float(Decimal('1') - _ctx.vat_input_recoverability)
                        entry = OrderLineTaxEntry(
                            organization=organization,
                            order_line_id=line_obj.id,
                            transaction_type='SALE',
                            tax_type=tax_type,
                            rate=tax_rate,
                            base_amount=item_total,
                            amount=item_tax,
                            cost_impact_ratio=Decimal(str(cost_ratio)),
                            cost_impact_amount=(item_tax * Decimal(str(cost_ratio))).quantize(Decimal('0.01')),
                            scope=scope,
                        )
                        entry.save()
                except Exception:
                    pass  # Never block a sale due to tax entry failure



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
                if is_override:
                    fire_audit_event(
                        organization=organization,
                        user=user,
                        event_type='PRICE_OVERRIDE',
                        event_name='Price Override Detection',
                        details={
                            'product': product.name,
                            'base_price': str(base_price),
                            'sold_price': str(price),
                            'qty': str(qty)
                        },
                        reference_id=order.ref_code
                    )

            # Apply global discount to the final total amount
            discount_dec = Decimal(str(global_discount or 0))
            order.total_amount = max(Decimal('0'), total_amount - discount_dec)
            order.tax_amount = total_tax
            
            if discount_dec > 0:
                fire_audit_event(
                    organization=organization,
                    user=user,
                    event_type='GLOBAL_DISCOUNT',
                    event_name='Order Global Discount',
                    details={
                        'discount_amount': str(discount_dec),
                        'total_before_discount': str(total_amount)
                    },
                    reference_id=order.ref_code
                )

            # Loyalty & Wallet CRM update (Sync with centralized LoyaltyService)
            (Contact,) = _safe_import('apps.crm.models', ['Contact'])
            (LoyaltyService,) = _safe_import('apps.crm.services.loyalty_service', ['LoyaltyService'])
            contact = None
            wallet_added = Decimal('0')
            if contact_id and Contact:
                contact = Contact.objects.select_for_update().filter(id=contact_id, organization=organization).first()
                if contact:
                    # 1. Redeem Points (Burn)
                    pts_to_redeem = int(points_redeemed)
                    if pts_to_redeem > 0 and LoyaltyService:
                        LoyaltyService.burn_points(contact, pts_to_redeem)

                    # 2. Earn Points & Update Tier (Centralized Logic)
                    if LoyaltyService and order.total_amount > 0:
                        LoyaltyService.earn_points(contact, order.total_amount)

                    # 3. Store Change in Wallet
                    cash_received_dec = Decimal(str(cash_received))
                    change_due = max(Decimal('0'), cash_received_dec - order.total_amount)

                    if store_change_in_wallet and change_due > 0 and payment_method in ['CASH']:
                        wallet_added = change_due
                        contact.wallet_balance += change_due
                        contact.save(update_fields=['wallet_balance'])

            # 5. Cryptographic Seal
            order.receipt_hash = order.calculate_hash()
            order.save(force_audit_bypass=True)

            # 6. Finance Chain Link — Multi-Payment Aware
            rules = ConfigurationService.get_posting_rules(organization)
            rev_acc = rules.get('sales', {}).get('revenue')
            inv_acc = rules.get('sales', {}).get('inventory')
            cogs_acc = rules.get('sales', {}).get('cogs')
            tax_acc = rules.get('purchases', {}).get('tax')
            round_off_acc = rules.get('sales', {}).get('round_off') or rules.get('sales', {}).get('discount') or rev_acc
            receivable_acc = rules.get('sales', {}).get('receivable')

            if not all([rev_acc, inv_acc, cogs_acc]):
                raise ValidationError("Missing sales posting rules mapping.")

            (FinancialAccount,) = _safe_import('apps.finance.models', ['FinancialAccount'])

            # Pre-fetch financial accounts to avoid N+1 queries in the payment loop
            financial_accounts_cache = {}
            fallback_acc_id = payment_account_id
            
            if FinancialAccount:
                primary_fa = FinancialAccount.objects.filter(id=payment_account_id, organization=organization).first()
                fallback_acc_id = primary_fa.ledger_account_id if primary_fa else payment_account_id
                
                for fa in FinancialAccount.objects.filter(organization=organization):
                    if fa.name:
                        financial_accounts_cache[fa.name.lower()] = fa.ledger_account_id or fa.id

            def resolve_payment_account(method_key):
                """Resolve a payment method key to its ledger account ID using O(1) cache."""
                if not FinancialAccount:
                    return fallback_acc_id
                    
                method_key_lower = str(method_key).lower()
                if method_key_lower.startswith('acct:'):
                    try:
                        acc_id = int(method_key_lower.split(':')[1])
                        # Verify the account belongs to organization
                        fa = FinancialAccount.objects.filter(id=acc_id, organization=organization).first()
                        if fa:
                            return fa.ledger_account_id or fa.id
                    except (ValueError, IndexError):
                        pass

                for name, acc_id in financial_accounts_cache.items():
                    if method_key_lower in name:
                        return acc_id
                        
                return fallback_acc_id

            # ── VAT Split Decision: use TaxEngineContext (scope guard aware) ──
            # vat_active = scope==OFFICIAL AND org charges VAT on official sales
            try:
                from apps.finance.tax_calculator import TaxEngineContext as _ctx_cls
                _engine_ctx = _ctx_cls.from_org(organization, scope=scope)
                should_split_vat = _engine_ctx.vat_active and sales_tax_acc and total_tax > Decimal('0')
            except Exception:
                # Graceful fallback to legacy companyType check
                settings = ConfigurationService.get_global_settings(organization)
                company_type = settings.get('companyType', 'REGULAR')
                should_split_vat = company_type in ('REAL', 'MIXED') and sales_tax_acc and total_tax > Decimal('0')



            if should_split_vat:
                # Correct: DR Cash/AR (TTC) → CR Revenue HT + CR TVA Collectée
                lines = [
                    {"account_id": rev_acc, "debit": Decimal('0'), "credit": revenue_credit,
                     "description": "Revenue HT"},
                    {"account_id": sales_tax_acc, "debit": Decimal('0'), "credit": total_tax,
                     "description": "TVA Collectée"},
                    {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0'),
                     "description": "Cost of Goods Sold"},
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs,
                     "description": "Inventory Relief"},
                ]
            else:
                # REGULAR/MICRO or sales.tax not configured: TTC posted to revenue
                lines = [
                    {"account_id": rev_acc, "debit": Decimal('0'), "credit": revenue_credit},
                    {"account_id": rev_acc, "debit": Decimal('0'), "credit": total_tax},
                    {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0')},
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs},
                ]

            # Use structured payment_legs if provided, replacing the old notes parsing
            parsed_legs = []
            if payment_legs and isinstance(payment_legs, list):
                for leg in payment_legs:
                    try:
                        leg_method = leg.get('method') or leg.get('payment_method')
                        leg_amt = Decimal(str(leg.get('amount', 0)))
                        if leg_method and leg_amt > 0:
                            parsed_legs.append((leg_method, leg_amt))
                    except Exception:
                        pass
            elif notes and '|' in notes:
                # Fallback to legacy string parsing just in case
                for leg_str in notes.split('|'):
                    leg_str = leg_str.strip()
                    if ':' in leg_str:
                        parts = leg_str.split(':')
                        leg_method = parts[0].strip()
                        # If the legacy parse gives ACCT:123:500.00
                        if leg_method.upper() == 'ACCT' and len(parts) >= 3:
                            leg_method = f"ACCT:{parts[1].strip()}"
                            amount_part = parts[2].strip()
                        else:
                            amount_part = parts[1].strip()
                        try:
                            leg_amount = Decimal(amount_part)
                            if leg_amount > 0:
                                parsed_legs.append((leg_method, leg_amount))
                        except Exception:
                            pass

            if parsed_legs:
                # Multi-payment: create a debit line per payment leg
                for leg_method, leg_amount in parsed_legs:
                    if leg_method == 'ROUND_OFF':
                        # Round-off is a debit to discount/expense account (contra-revenue)
                        lines.append({
                            "account_id": round_off_acc,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
                    elif leg_method == 'REWARD_POINTS':
                        # Loyalty points: debit loyalty liability / receivable
                        lines.append({
                            "account_id": receivable_acc or rev_acc,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
                    elif leg_method in ('WALLET_DEBIT', 'WALLET_CREDIT'):
                        # Wallet: debit wallet liability
                        wallet_acc = receivable_acc or rev_acc
                        lines.append({
                            "account_id": wallet_acc,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
                    elif leg_method == 'ACCOUNT_DEBIT':
                        # Post to client account (accounts receivable)
                        lines.append({
                            "account_id": receivable_acc or rev_acc,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
                    elif leg_method == 'CREDIT':
                        # Credit sale: debit accounts receivable (client owes this amount)
                        lines.append({
                            "account_id": receivable_acc or rev_acc,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
                    else:
                        # Standard payment method (CASH, CARD, WAVE, OM, etc.)
                        acc_id = resolve_payment_account(leg_method)
                        if not acc_id:
                            raise ValueError(f"No financial account linked for payment method '{leg_method}'. Please configure payment methods in POS Settings.")
                        lines.append({
                            "account_id": acc_id,
                            "debit": leg_amount,
                            "credit": Decimal('0')
                        })
            else:
                # Single payment method — original behavior
                if payment_method == 'CREDIT':
                    # Credit sale: debit accounts receivable (client owes)
                    actual_payment_acc_id = receivable_acc or fallback_acc_id
                else:
                    actual_payment_acc_id = resolve_payment_account(payment_method)

                if not actual_payment_acc_id:
                    raise ValueError(f"No financial account linked for payment method '{payment_method}'. Please configure payment methods in POS Settings.")

                if contact and wallet_added > 0:
                    wallet_liability_acc = receivable_acc or rev_acc
                    lines.append({"account_id": actual_payment_acc_id, "debit": (order.total_amount + wallet_added), "credit": Decimal('0')})
                    lines.append({"account_id": wallet_liability_acc, "debit": Decimal('0'), "credit": wallet_added})
                else:
                    lines.append({"account_id": actual_payment_acc_id, "debit": order.total_amount, "credit": Decimal('0')})

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"POS Sale {invoice_num} | ReceiptHash: {order.receipt_hash[:12]}...",
                reference=f"POS-{order.id}",
                status='POSTED',
                scope=scope,
                site_id=warehouse.parent_id or warehouse.id,
                user=user,
                lines=lines
            )

            # CREDIT_SALE: flag any sale paid via CREDIT method
            is_credit_checkout = (
                payment_method == 'CREDIT' or
                any(m == 'CREDIT' for m, _ in parsed_legs)
            )
            if is_credit_checkout:
                fire_audit_event(
                    organization=organization,
                    user=user,
                    event_type='CREDIT_SALE',
                    event_name='Credit Sale — No Cash Collected',
                    details={
                        'total': str(order.total_amount),
                        'contact_id': str(contact_id) if contact_id else None,
                        'payment_method': payment_method,
                    },
                    reference_id=order.ref_code
                )

            # ── Auto-Task: ORDER_COMPLETED & HIGH_VALUE_SALE ─────────────────
            try:
                from apps.workspace.signals import trigger_finance_event
                trigger_finance_event(
                    organization, 'ORDER_COMPLETED',
                    amount=float(order.total_amount),
                    client_id=contact_id,
                    cashier_id=user.id if user else None,
                    site_id=warehouse.id if warehouse else None,
                    payment_method=payment_method,
                    user=user,
                    reference=invoice_num or f'POS-{order.id}',
                )
                # High-value sale threshold (configurable, default 500k)
                hv_threshold = ConfigurationService.get_setting(organization, 'high_value_sale_threshold', 500000)
                if order.total_amount >= Decimal(str(hv_threshold)):
                    trigger_finance_event(
                        organization, 'HIGH_VALUE_SALE',
                        amount=float(order.total_amount),
                        client_id=contact_id,
                        cashier_id=user.id if user else None,
                        user=user,
                        reference=invoice_num or f'POS-{order.id}',
                    )
            except Exception:
                pass

            return order
