"""
POS Module Services
Canonical home for all POS/sales/purchase business logic.

Cross-module imports are gated with try/except to prevent crashes
when dependent modules are removed. Side-effects (journal entries,
stock adjustments) are dispatched via ConnectorEngine events.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import uuid
import logging

logger = logging.getLogger(__name__)


def _safe_import(module_path, names):
    """
    Safely import names from a module. Returns None for each
    name if the module is not installed.
    """
    try:
        mod = __import__(module_path, fromlist=names)
        return tuple(getattr(mod, n) for n in names)
    except ImportError:
        logger.warning(f"Module '{module_path}' not installed — import skipped")
        return tuple(None for _ in names)


class POSService:
    @staticmethod
    def checkout(organization, user, warehouse, payment_account_id, items, scope='OFFICIAL'):
        from apps.pos.models import Order, OrderLine
        from erp.services import ConfigurationService
        
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
            # Separate sequence for each scope (e.g. SALE_OFFICIAL, SALE_INTERNAL)
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
                previous_hash=prev_hash
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
                
                amc = InventoryService.reduce_stock(
                    organization=organization,
                    product=product,
                    warehouse=warehouse,
                    quantity=qty,
                    reference=f"POS-{order.id}"
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

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"POS Sale {invoice_num} | ReceiptHash: {order.receipt_hash[:12]}...",
                reference=f"POS-{order.id}",
                status='POSTED',
                scope='INTERNAL',
                site_id=warehouse.site_id,
                user=user,
                lines=[
                    {"account_id": actual_payment_acc_id, "debit": total_amount, "credit": Decimal('0')},
                    {"account_id": rev_acc, "debit": Decimal('0'), "credit": (total_amount - total_tax)},
                    {"account_id": tax_acc or rev_acc, "debit": Decimal('0'), "credit": total_tax},
                    {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0')},
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs},
                ]
            )
            
            return order


class PurchaseService:
    @staticmethod
    def authorize_po(organization, order_id):
        from apps.pos.models import Order
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            if order.status != 'DRAFT':
                raise ValidationError(f"Cannot authorize order in status {order.status}")
            order.status = 'AUTHORIZED'
            order.save()
            return order

    @staticmethod
    def receive_po(organization, order_id, warehouse_id, is_tax_recoverable=True):
        from apps.pos.models import Order
        
        # Gated cross-module imports
        (Warehouse,) = _safe_import('apps.inventory.models', ['Warehouse'])
        (InventoryService,) = _safe_import('apps.inventory.services', ['InventoryService'])
        
        if not Warehouse or not InventoryService:
            raise ValidationError("Inventory module is required for PO reception.")
        """
        Processes physical reception of all items in the PO.
        """
        scope = kwargs.get('scope', 'OFFICIAL')
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            
            if order.status not in ['AUTHORIZED', 'PARTIAL_RECEIVED']:
                raise ValidationError(f"Order status {order.status} is not eligible for reception.")

            for line in order.lines.all():
                InventoryService.receive_stock(
                    organization=organization,
                    product=line.product,
                    warehouse=warehouse,
                    quantity=line.quantity,
                    cost_price_ht=line.unit_price,
                    is_tax_recoverable=is_tax_recoverable,
                    reference=f"PO-REC-{order.id}",
                    scope=scope
                )
            
            order.status = 'RECEIVED'
            order.save()
            return order

    @staticmethod
    def create_purchase_order(organization, supplier_id, site_id, warehouse_id, lines, scope='OFFICIAL', notes=None, ref_code=None, user=None):
        from apps.pos.models import Order, OrderLine
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
                    total=line_total
                )
            
            order.total_amount = total_amount
            order.save()
            return order

    @staticmethod
    def quick_purchase(organization, supplier_id, warehouse_id, site_id, scope, invoice_price_type, vat_recoverable, lines, notes=None, ref_code=None, user=None):
        from apps.pos.models import Order, OrderLine
        from erp.services import ConfigurationService
        from erp.models import StockBatch
        
        # Gated cross-module imports
        (Product, Inventory) = _safe_import('apps.inventory.models', ['Product', 'Inventory'])
        (Contact,) = _safe_import('apps.crm.models', ['Contact'])
        (ChartOfAccount,) = _safe_import('apps.finance.models', ['ChartOfAccount'])
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])
        
        if not Product or not Inventory:
            raise ValidationError("Inventory module is required for purchases.")
        if not Contact:
            raise ValidationError("CRM module is required for supplier purchases.")
        if not LedgerService:
            raise ValidationError("Finance module is required for purchase accounting.")

        with transaction.atomic():
            settings = ConfigurationService.get_global_settings(organization)
            pricing_cost_basis = settings.get('pricingCostBasis', 'AUTO')
            company_type = settings.get('companyType', 'REGULAR')
            
            if company_type in ['MIXED', 'REGULAR', 'MICRO']:
                vat_recoverable = False
            
            supplier = Contact.objects.get(id=supplier_id, organization=organization)
            global_airsi_rate = Decimal(str(settings.get('airsi_tax_percentage', 0))) / 100
            
            apply_airsi = False
            airsi_rate = Decimal('0')
            
            if global_airsi_rate > 0:
                if supplier.is_airsi_subject:
                    apply_airsi = True
                    airsi_rate = supplier.airsi_tax_rate if supplier.airsi_tax_rate is not None else global_airsi_rate

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
                airsi_amount=Decimal('0')
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
                
                line_airsi = Decimal('0')
                if apply_airsi:
                    line_airsi = (line_total_ht * airsi_rate).quantize(Decimal('0.01'))
                
                total_amount_ht += line_total_ht
                total_tax += line_tax
                total_airsi += line_airsi
                
                base_effective_cost = Decimal('0')
                if pricing_cost_basis == 'FORCE_HT':
                    base_effective_cost = unit_cost_ht
                elif pricing_cost_basis == 'FORCE_TTC':
                    base_effective_cost = unit_cost_ttc
                else:
                    base_effective_cost = unit_cost_ht if vat_recoverable else unit_cost_ttc
                
                airsi_capitalized = True
                if company_type == 'REAL': airsi_capitalized = False
                
                final_effective_cost = base_effective_cost
                if apply_airsi and airsi_capitalized and qty > 0:
                    final_effective_cost += (line_airsi / qty).quantize(Decimal('0.01'))

                OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=final_effective_cost,
                    unit_cost_ht=unit_cost_ht,
                    unit_cost_ttc=unit_cost_ttc,
                    vat_amount=line_tax / qty if qty > 0 else 0,
                    airsi_amount=line_airsi / qty if qty > 0 else 0,
                    effective_cost=final_effective_cost,
                    tax_rate=tax_rate,
                    total=line_total_ttc
                )
                
                batch = StockBatch.objects.create(
                    organization=organization,
                    product=product,
                    batch_code=f"PUR-{order.id}-{product.id}",
                    cost_price=final_effective_cost,
                    expiry_date=line.get('expiryDate')
                )
                
                inv, _ = Inventory.objects.get_or_create(
                    organization=organization,
                    warehouse_id=warehouse_id,
                    product=product,
                    batch=batch,
                    defaults={'quantity': Decimal('0')}
                )
                inv.quantity += qty
                inv.save()
                
                # 2. Scope-Aware Inventory Movement (Missing in original quick_purchase)
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
                
                product.cost_price = final_effective_cost
                product.cost_price_ht = unit_cost_ht
                product.cost_price_ttc = unit_cost_ttc
                if line.get('sellingPriceHT'): product.selling_price_ht = Decimal(str(line['sellingPriceHT']))
                if line.get('sellingPriceTTC'): product.selling_price_ttc = Decimal(str(line['sellingPriceTTC']))
                product.save()

            order.total_amount = total_amount_ht + total_tax + total_airsi
            order.tax_amount = total_tax
            order.airsi_amount = total_airsi
            order.save()
            
            rules = ConfigurationService.get_posting_rules(organization)
            
            ap_account_id = supplier.linked_account_id or rules['purchases']['payable']
            stock_account_id = rules['purchases']['inventory']
            tax_account_id = rules['purchases']['tax']
            airsi_account_id = rules['purchases'].get('airsi')
            
            if not ap_account_id or not stock_account_id:
                raise ValidationError("Finance mapping missing: Accounts Payable or Inventory account not configured.")
                
            inventory_debit_amount = total_amount_ht
            if not vat_recoverable: inventory_debit_amount += total_tax
            
            airsi_ledger_treatment = 'CAPITALIZE'
            if company_type == 'REAL': airsi_ledger_treatment = 'RECOVER'
            elif company_type == 'MICRO': airsi_ledger_treatment = 'EXPENSE'
            
            if apply_airsi:
                if airsi_ledger_treatment == 'CAPITALIZE':
                    inventory_debit_amount += total_airsi
            
            posting_lines = [
                {"account_id": ap_account_id, "debit": Decimal('0'), "credit": order.total_amount, "description": f"Payable to {supplier.name}"},
                {"account_id": stock_account_id, "debit": inventory_debit_amount, "credit": Decimal('0'), "description": "Inventory Value"}
            ]
            
            if vat_recoverable and total_tax > 0:
                posting_lines.append({
                    "account_id": tax_account_id,
                    "debit": total_tax,
                    "credit": Decimal('0'),
                    "description": "VAT Recoverable"
                })
                
            if apply_airsi and airsi_ledger_treatment != 'CAPITALIZE':
                 target_acc = airsi_account_id or tax_account_id
                 posting_lines.append({
                    "account_id": target_acc,
                    "debit": total_airsi,
                    "credit": Decimal('0'),
                    "description": f"AIRSI ({airsi_ledger_treatment})"
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
            
            return order

    @staticmethod
    def invoice_po(organization, order_id, invoice_number, invoice_date=None):
        from apps.pos.models import Order
        from erp.services import ConfigurationService
        
        # Gated cross-module import
        (LedgerService,) = _safe_import('apps.finance.services', ['LedgerService'])
        if not LedgerService:
            raise ValidationError("Finance module is required for invoice processing.")
        """
        Converts the 'Accrued Reception' liability into a formal 'Accounts Payable'.
        """
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            if order.status != 'RECEIVED':
                raise ValidationError("Order must be RECEIVED before it can be INVOICED.")

            rules = ConfigurationService.get_posting_rules(organization)
            susp_acc = rules.get('suspense', {}).get('reception')
            ap_acc = rules.get('purchases', {}).get('payable')

            if not susp_acc or not ap_acc:
                raise ValidationError("Finance mapping missing: Accrued Reception or Accounts Payable not configured.")

            total_invoice = order.total_amount

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=invoice_date or timezone.now(),
                description=f"Purchase Invoice: {invoice_number} (PO #{order.id})",
                reference=invoice_number,
                status='POSTED',
                scope=order.scope,
                site_id=order.site_id,
                lines=[
                    {
                        "account_id": susp_acc,
                        "debit": total_invoice,
                        "credit": Decimal('0'),
                        "description": "Clearing Accrued Reception"
                    },
                    {
                        "account_id": ap_acc,
                        "debit": Decimal('0'),
                        "credit": total_invoice,
                        "description": "Establishing Accounts Payable"
                    }
                ]
            )

            order.status = 'INVOICED'
            order.notes = f"{order.notes or ''}\nInvoice ref: {invoice_number}".strip()
            order.save()
            return order
