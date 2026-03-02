from .base import Decimal, ValidationError, transaction, timezone, _safe_import
from apps.pos.models import Order, OrderLine
from erp.services import ConfigurationService

class PurchaseService:
    @staticmethod
    def authorize_po(organization, order_id):
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            if order.status != 'DRAFT':
                raise ValidationError(f"Cannot authorize order in status {order.status}")
            order.status = 'AUTHORIZED'
            order.save()
            return order

    @staticmethod
    def receive_po(organization, order_id, warehouse_id, receptions=None, is_tax_recoverable=True, scope='OFFICIAL', user=None):
        # Gated cross-module imports
        (Warehouse,) = _safe_import('apps.inventory.models', ['Warehouse'])
        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])

        if not Warehouse or not InventoryService:
            raise ValidationError("Inventory module is required for PO reception.")
        if not LedgerService:
            raise ValidationError("Finance module is required for PO reception accounting.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(id=order_id, organization=organization, type='PURCHASE')
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)

            if order.status not in ['AUTHORIZED', 'PARTIAL_RECEIVED']:
                raise ValidationError(f"Order status {order.status} is not eligible for reception.")

            total_received_value = Decimal('0')

            # Map of line_id -> received_quantity
            reception_map = {}
            if receptions:
                for r in receptions:
                    reception_map[int(r['lineId'])] = Decimal(str(r['quantity']))
            else:
                # Default: receive all remaining
                for line in order.lines.all():
                    reception_map[line.id] = line.quantity - line.qty_received

            for line in order.lines.all():
                qty_to_receive = reception_map.get(line.id, Decimal('0'))
                if qty_to_receive <= 0: continue

                if line.qty_received + qty_to_receive > line.quantity:
                    raise ValidationError(f"Cannot receive more than ordered for product {line.product.name}")

                InventoryService.receive_stock(
                    organization=organization,
                    product=line.product,
                    warehouse=warehouse,
                    quantity=qty_to_receive,
                    cost_price_ht=line.unit_price,
                    is_tax_recoverable=is_tax_recoverable,
                    reference=f"PO-REC-{order.id}",
                    scope=scope
                )

                line.qty_received += qty_to_receive
                line.save()

                total_received_value += (qty_to_receive * line.unit_price)

                # ── Sourcing Intelligence Update ───────────────────────
                from apps.pos.models import ProductSupplier, SupplierPriceHistory
                sourcing_link, _ = ProductSupplier.objects.get_or_create(
                    organization=organization,
                    product=line.product,
                    supplier=order.contact
                )
                sourcing_link.last_purchased_price = line.unit_price
                sourcing_link.last_purchased_date = timezone.now()
                sourcing_link.save()

                SupplierPriceHistory.objects.create(
                    organization=organization,
                    product=line.product,
                    supplier=order.contact,
                    price=line.unit_price,
                    reference_order=order,
                    notes=f"Reception via PO #{order.id}"
                )

            # Update Order Status
            all_received = all(line.qty_received >= line.quantity for line in order.lines.all())
            order.status = 'RECEIVED' if all_received else 'PARTIAL_RECEIVED'
            order.save()

            # ── Accounting Accrual ─────────────────────────────────────
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('purchases', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')

            # BUG 4 FIX: Never silently skip accounting — raise if accounts not configured
            if not inv_acc or not susp_acc:
                raise ValidationError(
                    "Cannot post stock reception to ledger: 'purchases.inventory' or 'suspense.reception' "
                    "account not configured in Finance → Posting Rules Settings."
                )

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Stock Reception: PO #{order.id} | Warehouse: {warehouse.name}",
                reference=f"PO-REC-{order.id}",
                status='POSTED',
                scope=scope,
                site_id=warehouse.parent_id or warehouse.id,
                user=user,
                lines=[
                    {"account_id": inv_acc, "debit": total_received_value, "credit": Decimal('0'), "description": "Inventory Value increase"},
                    {"account_id": susp_acc, "debit": Decimal('0'), "credit": total_received_value, "description": "Accrued Reception Liaison"},
                ]
            )

            return order

    @staticmethod
    def create_purchase_order(organization, supplier_id, site_id, warehouse_id, lines, scope='OFFICIAL', notes=None, ref_code=None, user=None):
        (Product,) = _safe_import('apps.inventory.models', ['Product'])
        (Contact,) = _safe_import('apps.crm.models', ['Contact'])

        if not Product: raise ValidationError("Inventory module required.")
        if not Contact: raise ValidationError("CRM module required.")

        with transaction.atomic():
            supplier = Contact.objects.get(id=supplier_id, organization=organization)

            order = Order.objects.create(
                organization=organization,
                type='PURCHASE',
                status='DRAFT', # RFQ initial state
                scope=scope,
                contact=supplier,
                user=user,
                site_id=site_id,
                ref_code=ref_code,
                notes=notes,
                payment_method='CREDIT',
                total_amount=Decimal('0')
            )

            total_amount = Decimal('0')
            for line in lines:
                product = Product.objects.get(id=line['productId'], organization=organization)
                qty = Decimal(str(line['quantity']))
                price = Decimal(str(line['unitPrice']))

                line_total = qty * price
                total_amount += line_total

                OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=price,
                    subtotal=line_total
                )

            order.total_amount = total_amount
            order.save()
            return order

    @staticmethod
    def quick_purchase(organization, supplier_id, warehouse_id, site_id, scope, invoice_price_type, vat_recoverable, lines, notes=None, ref_code=None, user=None, **kwargs):
        from apps.inventory.models.advanced_models import ProductBatch
        from apps.inventory.models import InventoryMovement

        # Gated cross-module imports
        (Product, Inventory) = _safe_import('apps.inventory.models', ['Product', 'Inventory'])
        (Contact,) = _safe_import('apps.crm.models', ['Contact'])
        (ChartOfAccount, FinancialAccount) = _safe_import('apps.finance.models', ['ChartOfAccount', 'FinancialAccount'])
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])
        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])

        if not Product or not Inventory:
            raise ValidationError("Inventory module is required for purchases.")
        if not Contact:
            raise ValidationError("CRM module is required for supplier purchases.")
        if not LedgerService:
            raise ValidationError("Finance module is required for purchase accounting.")

        with transaction.atomic():
            settings = ConfigurationService.get_global_settings(organization)
            pricing_cost_basis = settings.get('pricingCostBasis', 'AUTO')

            supplier = Contact.objects.get(id=supplier_id, organization=organization)

            # ── New Tax Engine Context (scope guard + OrgTaxPolicy) ───────────
            from apps.finance.tax_calculator import TaxEngineContext, TaxCalculator, _SupplierProfile
            _is_export = kwargs.get('is_export', False)
            _ctx = TaxEngineContext.from_org(organization, scope=scope, is_export=_is_export)
            _supplier_profile = _SupplierProfile.from_contact(supplier)

            # Derive vat_recoverable from engine (replaces companyType/supplier_regime sniff)
            if not _ctx.vat_active:
                vat_recoverable = False  # INTERNAL scope or org not VAT-registered
            elif not _supplier_profile.vat_registered:
                vat_recoverable = False  # Supplier doesn't charge VAT
            else:
                vat_recoverable = float(_ctx.vat_input_recoverability) > 0

            global_airsi_rate = Decimal(str(settings.get('airsi_tax_percentage', 0))) / 100

            apply_airsi = False
            airsi_rate = Decimal('0')

            if global_airsi_rate > 0:
                if supplier.is_airsi_subject:
                    apply_airsi = True
                    airsi_rate = supplier.airsi_tax_rate if supplier.airsi_tax_rate else global_airsi_rate

            discount_amount = Decimal(str(kwargs.get('discountAmount', 0)))
            extra_fees = kwargs.get('extraFees', [])
            total_extra_fees = sum(Decimal(str(f.get('amount', 0))) for f in extra_fees)

            order = Order.objects.create(
                organization=organization,
                type='PURCHASE',
                status='COMPLETED',
                scope=scope,
                invoice_price_type=invoice_price_type,
                vat_recoverable=vat_recoverable,
                contact_id=supplier_id,
                user=user,
                site_id=site_id,
                ref_code=ref_code,
                notes=notes,
                payment_method='CREDIT',
                total_amount=Decimal('0'),
                tax_amount=Decimal('0'),
                airsi_amount=Decimal('0'),
                discount_amount=discount_amount,
                extra_fees=extra_fees,
            )

            total_amount_ht = Decimal('0')
            total_tax = Decimal('0')
            total_airsi = Decimal('0')

            for line in lines:
                product = Product.objects.get(id=line['productId'], organization=organization)
                qty = Decimal(str(line['quantity']))
                unit_cost_ht = Decimal(str(line['unitCostHT']))
                unit_cost_ttc = Decimal(str(line['unitCostTTC']))
                tax_rate = Decimal(str(line['taxRate']))

                if unit_cost_ht > 0 and unit_cost_ttc == 0:
                    unit_cost_ttc = (unit_cost_ht * (Decimal('1') + tax_rate)).quantize(Decimal('0.01'))
                elif unit_cost_ttc > 0 and unit_cost_ht == 0:
                    unit_cost_ht = (unit_cost_ttc / (Decimal('1') + tax_rate)).quantize(Decimal('0.01'))

                line_total_ht = qty * unit_cost_ht
                line_tax = line_total_ht * tax_rate
                line_total_ttc = line_total_ht + line_tax

                # ── Engine-driven cost resolution ──────────────────────────
                _costs = TaxCalculator.resolve_purchase_costs(
                    base_ht=line_total_ht,
                    vat_rate=tax_rate,
                    airsi_rate=airsi_rate if apply_airsi else Decimal('0'),
                    ctx=_ctx,
                    supplier_vat_registered=_supplier_profile.vat_registered,
                    supplier_reverse_charge=_supplier_profile.reverse_charge,
                    supplier_airsi_subject=_supplier_profile.airsi_subject and apply_airsi,
                )

                line_airsi = _costs['airsi_amount']
                line_tax   = _costs['vat_amount']

                total_amount_ht += line_total_ht
                total_tax += line_tax
                total_airsi += line_airsi

                # cost_official is the correct inventory value (HT + non-recoverable VAT + AIRSI capitalize + purchase_tax)
                if pricing_cost_basis == 'FORCE_HT':
                    final_effective_cost = unit_cost_ht
                elif pricing_cost_basis == 'FORCE_TTC':
                    final_effective_cost = unit_cost_ttc
                else:
                    final_effective_cost = (_costs['cost_official'] / qty).quantize(Decimal('0.01')) if qty > 0 else _costs['cost_official']

                line_obj = OrderLine(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=final_effective_cost,
                    unit_cost_ht=unit_cost_ht,
                    effective_cost=final_effective_cost,
                    tax_rate=tax_rate,
                    airsi_rate=airsi_rate if apply_airsi else Decimal('0'),
                    subtotal=_costs['ttc']
                )
                line_obj.save(force_audit_bypass=True)

                # ── Record per-line tax entries (Step 3) ───────────────────
                try:
                    from apps.pos.models import OrderLineTaxEntry
                    for tl in _costs['tax_lines']:
                        entry = OrderLineTaxEntry.from_tax_line_dict(
                            tax_line_dict={**tl, 'base_amount': float(line_total_ht)},
                            order_line_id=line_obj.id,
                            transaction_type='PURCHASE',
                            scope=scope,
                            organization=organization,
                        )
                        entry.save()
                except Exception:
                    pass  # Never block a purchase due to tax entry failure

                batch = ProductBatch.objects.create(
                    organization=organization,
                    product=product,
                    batch_number=f"PUR-{order.id}-{product.id}",
                    cost_price=final_effective_cost,
                    expiry_date=line.get('expiryDate')
                )

                inv, _ = Inventory.objects.get_or_create(
                    organization=organization,
                    warehouse_id=warehouse_id,
                    product=product,
                    defaults={'quantity': Decimal('0'), 'batch_number': batch.batch_number}
                )
                inv.quantity += qty
                inv.save()

                InventoryMovement.objects.create(
                    organization=organization,
                    product=product,
                    warehouse_id=warehouse_id,
                    type='IN',
                    quantity=qty,
                    cost_price=final_effective_cost,
                    cost_price_ht=unit_cost_ht,
                    reference=f"PUR-{order.id}",
                    scope=scope
                )

                if product.tracks_serials and InventoryService:
                    current_serials = line.get('serials', [])
                    if len(current_serials) != int(qty):
                        raise ValidationError(f"Product {product.name} requires {int(qty)} serials.")
                    for sn in current_serials:
                        InventoryService.register_serial_entry(
                            organization, product, warehouse_id, sn,
                            f"PUR-{order.id}", cost_price=final_effective_cost,
                            user_name=user.username if user else None
                        )

                product.cost_price = final_effective_cost
                product.cost_price_ht = unit_cost_ht
                product.cost_price_ttc = unit_cost_ttc
                if line.get('sellingPriceHT'): product.selling_price_ht = Decimal(str(line['sellingPriceHT']))
                if line.get('sellingPriceTTC'): product.selling_price_ttc = Decimal(str(line['sellingPriceTTC']))
                product.save()

                from apps.pos.models import ProductSupplier, SupplierPriceHistory
                sourcing_link, _ = ProductSupplier.objects.get_or_create(
                    organization=organization,
                    product=product,
                    supplier=supplier
                )
                sourcing_link.last_purchased_price = final_effective_cost
                sourcing_link.last_purchased_date = timezone.now()
                sourcing_link.save()

                SupplierPriceHistory.objects.create(
                    organization=organization,
                    product=product,
                    supplier=supplier,
                    price=final_effective_cost,
                    reference_order=order,
                    notes=f"Quick Purchase #{order.id}"
                )

            order.total_amount = total_amount_ht + total_tax + total_airsi + total_extra_fees - discount_amount
            order.tax_amount = total_tax
            order.airsi_amount = total_airsi
            order.save(force_audit_bypass=True)

            rules = ConfigurationService.get_posting_rules(organization)

            ap_account_id = supplier.linked_account_id or rules['purchases']['payable']
            stock_account_id = rules['purchases']['inventory']
            tax_account_id = rules['purchases']['tax']
            airsi_account_id = rules['purchases'].get('airsi')
            discount_earned_account_id = rules['purchases'].get('discount_earned') # e.g. 7xxx

            if not ap_account_id or not stock_account_id:
                raise ValidationError("Finance mapping missing: Accounts Payable or Inventory account not configured.")

            # ── Inventory debit = cost_official (all non-recoverable taxes already included) ──
            # cost_official = HT + (VAT * non_recov_ratio) + AIRSI_if_capitalize + purchase_tax
            # We can sum up from the per-line OrderLineTaxEntry, but for simplicity:
            inventory_debit_amount = total_amount_ht
            if not vat_recoverable:
                inventory_debit_amount += total_tax

            # AIRSI ledger treatment from engine context
            airsi_ledger_treatment = _ctx.airsi_treatment

            if apply_airsi and total_airsi > 0:
                if airsi_ledger_treatment == 'CAPITALIZE':
                    inventory_debit_amount += total_airsi

            # Canonical AP credit:
            # If AIRSI withheld → AP = TTC - AIRSI (net owed to supplier)
            if apply_airsi and total_airsi > 0:
                ap_credit = order.total_amount  # already has -AIRSI effect after totals
            else:
                ap_credit = order.total_amount

            posting_lines = [
                {"account_id": ap_account_id, "debit": Decimal('0'), "credit": ap_credit,
                 "description": f"Payable to {supplier.name}"},
                {"account_id": stock_account_id, "debit": inventory_debit_amount, "credit": Decimal('0'),
                 "description": "Inventory Value (cost_official)"},
            ]

            # Extra Fees
            for fee in extra_fees:
                fee_acc = fee.get('accountId') or rules['purchases'].get('delivery_fees') or stock_account_id
                posting_lines.append({
                    "account_id": fee_acc, "debit": Decimal(str(fee['amount'])), "credit": Decimal('0'),
                    "description": f"Fee: {fee['name']}"
                })

            # Discount Earned
            if discount_amount > 0:
                target_disc_acc = discount_earned_account_id or stock_account_id
                posting_lines.append({
                    "account_id": target_disc_acc, "debit": Decimal('0'), "credit": discount_amount,
                    "description": "Purchase Discount Earned"
                })

            # VAT Recoverable (only when vat_active AND org can reclaim)
            if _ctx.vat_active and vat_recoverable and total_tax > 0:
                if not tax_account_id:
                    raise ValidationError(
                        "Cannot post VAT-recoverable purchase: 'purchases.tax' (TVA Récupérable) "
                        "account not configured in Finance → Posting Rules Settings."
                    )
                posting_lines.append({
                    "account_id": tax_account_id, "debit": total_tax, "credit": Decimal('0'),
                    "description": "TVA Récupérable"
                })

            # VAT Reverse Charge (supplier.reverse_charge=True + vat_active)
            if _ctx.vat_active and _supplier_profile.reverse_charge and total_tax > 0:
                reverse_charge_acc = rules.get('purchases', {}).get('reverse_charge_vat') or tax_account_id
                sales_tax_acc_rc = rules.get('sales', {}).get('tax')
                if reverse_charge_acc and sales_tax_acc_rc:
                    posting_lines.append({
                        "account_id": reverse_charge_acc, "debit": total_tax, "credit": Decimal('0'),
                        "description": "VAT Reverse Charge — Input"
                    })
                    posting_lines.append({
                        "account_id": sales_tax_acc_rc, "debit": Decimal('0'), "credit": total_tax,
                        "description": "VAT Reverse Charge — Output"
                    })

            # AIRSI non-capitalize
            if apply_airsi and total_airsi > 0 and airsi_ledger_treatment != 'CAPITALIZE':
                target_acc = airsi_account_id or tax_account_id
                if target_acc:
                    posting_lines.append({
                        "account_id": target_acc, "debit": total_airsi, "credit": Decimal('0'),
                        "description": f"AIRSI ({airsi_ledger_treatment})"
                    })
                # Canonical: CR AP net (supplier gets TTC - AIRSI) + CR AIRSI Payable
                airsi_payable_acc = rules.get('purchases', {}).get('airsi_payable')
                if airsi_payable_acc:
                    posting_lines.append({
                        "account_id": airsi_payable_acc, "debit": Decimal('0'), "credit": total_airsi,
                        "description": "AIRSI Payable to tax authority"
                    })

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Purchase: {supplier.name} | Basis: {pricing_cost_basis} | Recoverable: {vat_recoverable}",
                reference=f"ORD-{order.id}",
                status='POSTED',
                scope=scope,
                site_id=site_id,
                lines=posting_lines
            )

            # Handling Initial Payment
            initial_payment = kwargs.get('initialPayment')
            if initial_payment and Decimal(str(initial_payment.get('amount', 0))) > 0:
                pay_amount = Decimal(str(initial_payment['amount']))
                pay_account_id = initial_payment['accountId']

                # Check if pay_account_id is a FinancialAccount, get its Ledger ID
                if FinancialAccount:
                    fin_acc = FinancialAccount.objects.filter(id=pay_account_id, organization=organization).first()
                    if fin_acc: pay_account_id = fin_acc.ledger_account_id

                pay_lines = [
                    {"account_id": ap_account_id, "debit": pay_amount, "credit": Decimal('0'), "description": f"Payment for Purchase #{order.id}"},
                    {"account_id": pay_account_id, "debit": Decimal('0'), "credit": pay_amount, "description": "Cash/Bank Payment"}
                ]

                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Initial Payment for Purchase #{order.id} | {supplier.name}",
                    reference=f"PAY-PUR-{order.id}",
                    status='POSTED',
                    scope=scope,
                    site_id=site_id,
                    lines=pay_lines
                )

            return order

    @staticmethod
    def invoice_po(organization, order_id, invoice_number, invoice_date=None, user=None):
        # Gated cross-module import
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])
        if not LedgerService:
            raise ValidationError("Finance module is required for invoice processing.")

        with transaction.atomic():
            order = Order.objects.select_for_update().get(id=order_id, organization=organization, type='PURCHASE')

            # Check if there is anything received but not invoiced
            total_invoiced_value = Decimal('0')
            for line in order.lines.all():
                qty_to_invoice = line.qty_received - line.qty_invoiced
                if qty_to_invoice > 0:
                    total_invoiced_value += (qty_to_invoice * line.unit_price)
                    line.qty_invoiced += qty_to_invoice
                    line.save()

            if total_invoiced_value <= 0:
                raise ValidationError("There are no received items pending invoicing on this order.")

            rules = ConfigurationService.get_posting_rules(organization)
            susp_acc = rules.get('suspense', {}).get('reception')
            ap_acc = order.contact.linked_account_id or rules.get('purchases', {}).get('payable')

            if not susp_acc or not ap_acc:
                raise ValidationError("Finance mapping missing: Accrued Reception or Accounts Payable not configured.")

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=invoice_date or timezone.now(),
                description=f"Purchase Invoice: {invoice_number} (PO #{order.id})",
                reference=invoice_number,
                status='POSTED',
                scope=order.scope,
                site_id=order.site_id,
                user=user,
                lines=[
                    {
                        "account_id": susp_acc,
                        "debit": total_invoiced_value,
                        "credit": Decimal('0'),
                        "description": "Clearing Accrued Reception"
                    },
                    {
                        "account_id": ap_acc,
                        "debit": Decimal('0'),
                        "credit": total_invoiced_value,
                        "description": f"Establishing Accounts Payable to {order.contact.name}"
                    }
                ]
            )

            # Update Order Status
            all_invoiced = all(line.qty_invoiced >= line.quantity for line in order.lines.all())
            order.status = 'INVOICED' if all_invoiced else 'PARTIAL_RECEIVED'
            order.notes = f"{order.notes or ''}\nInvoice ref: {invoice_number} | Value: {total_invoiced_value}".strip()
            order.save()
            return order
