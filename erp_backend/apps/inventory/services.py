"""
Inventory Module Services
Canonical home for all inventory/stock management business logic.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid


class InventoryService:
    @staticmethod
    def calculate_effective_cost(cost_price_ht, tva_rate, is_tax_recoverable):
        ht = Decimal(str(cost_price_ht))
        rate = Decimal(str(tva_rate))
        if is_tax_recoverable: return ht
        return ht * (Decimal('1') + rate)

    @staticmethod
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, is_tax_recoverable=True, reference=None):
        from apps.inventory.models import Inventory, InventoryMovement
        if not reference: reference = f"REC-{uuid.uuid4().hex[:8].upper()}"
        inbound_qty = Decimal(str(quantity))
        effective_cost = InventoryService.calculate_effective_cost(cost_price_ht, product.tva_rate, is_tax_recoverable)
        inbound_value = inbound_qty * effective_cost
        with transaction.atomic():
            agg = Inventory.objects.filter(organization=organization, product=product).aggregate(total=Sum('quantity'))['total']
            current_total_qty = Decimal(str(agg or '0'))
            current_avg_cost = Decimal(str(product.cost_price))
            current_total_value = current_total_qty * current_avg_cost
            new_total_qty = current_total_qty + inbound_qty
            if new_total_qty > Decimal('0'): new_amc = (current_total_value + inbound_value) / new_total_qty
            else: new_amc = effective_cost
            product.cost_price = new_amc
            product.cost_price_ht = Decimal(str(cost_price_ht))
            product.cost_price_ttc = Decimal(str(cost_price_ht)) * (Decimal('1') + Decimal(str(product.tva_rate)))
            product.save()
            inventory, _ = Inventory.objects.get_or_create(organization=organization, warehouse=warehouse, product=product)
            inventory.quantity = Decimal(str(inventory.quantity)) + inbound_qty
            inventory.save()
            InventoryMovement.objects.create(organization=organization, product=product, warehouse=warehouse, type='IN', quantity=inbound_qty, cost_price=effective_cost, reference=reference)
            
            # Cross-module: create journal entry for stock reception
            from erp.services import ConfigurationService
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')
            if inv_acc and susp_acc:
                from apps.finance.services import LedgerService
                LedgerService.create_journal_entry(organization=organization, transaction_date=timezone.now(), description=f"Stock Reception: {product.name}", reference=reference, status='POSTED', site_id=warehouse.site_id, lines=[
                    {"account_id": inv_acc, "debit": inbound_value, "credit": Decimal('0')},
                    {"account_id": susp_acc, "debit": Decimal('0'), "credit": inbound_value}
                ])
            return inventory

    @staticmethod
    def get_inventory_valuation(organization):
        from apps.inventory.models import Inventory
        result = Inventory.objects.filter(organization=organization).aggregate(total_value=Sum(F('quantity') * F('product__cost_price')))
        return {"total_value": Decimal(str(result['total_value'] or '0')), "item_count": Inventory.objects.filter(organization=organization).count(), "timestamp": timezone.now()}

    @staticmethod
    def reduce_stock(organization, product, warehouse, quantity, reference=None):
        from apps.inventory.models import Inventory, InventoryMovement
        """
        Reduces stock and captures AMC for COGS booking.
        """
        qty_to_reduce = Decimal(str(quantity))
        current_amc = Decimal(str(product.cost_price))
        
        with transaction.atomic():
            inventory = Inventory.objects.filter(
                organization=organization,
                warehouse=warehouse,
                product=product
            ).first()
            
            if not inventory or inventory.quantity < qty_to_reduce:
                raise ValidationError(f"Insufficient stock for {product.name} in {warehouse.name}")
            
            inventory.quantity = Decimal(str(inventory.quantity)) - qty_to_reduce
            inventory.save()
            
            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='OUT',
                quantity=qty_to_reduce,
                cost_price=current_amc,
                reference=reference or f"SALE-{uuid.uuid4().hex[:6].upper()}"
            )
            
            return current_amc
