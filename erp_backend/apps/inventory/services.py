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
            # Gated — inventory works even without finance module
            from erp.services import ConfigurationService
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')
            if inv_acc and susp_acc:
                try:
                    from apps.finance.services import LedgerService
                    LedgerService.create_journal_entry(organization=organization, transaction_date=timezone.now(), description=f"Stock Reception: {product.name}", reference=reference, status='POSTED', site_id=warehouse.site_id, lines=[
                        {"account_id": inv_acc, "debit": inbound_value, "credit": Decimal('0')},
                        {"account_id": susp_acc, "debit": Decimal('0'), "credit": inbound_value}
                    ])
                except ImportError:
                    import logging
                    logging.getLogger(__name__).warning(f"Finance module unavailable — journal entry skipped for {reference}")
            return inventory

    @staticmethod
    def get_inventory_valuation(organization):
        from apps.inventory.models import Inventory
        result = Inventory.objects.filter(organization=organization).aggregate(
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )
        return {
            "total_value": Decimal(str(result['total_value'] or '0')),
            "item_count": Inventory.objects.filter(organization=organization).count(),
            "timestamp": timezone.now(),
        }

    @staticmethod
    def get_inventory_financial_status(organization):
        """
        Returns a comprehensive financial snapshot of inventory:
        - Total valuation (qty × AMC)
        - Total retail value (qty × selling_price_ttc)
        - Potential margin
        - Low-stock count
        - Movement summary for last 30 days
        """
        from apps.inventory.models import Inventory, InventoryMovement, Product
        from datetime import timedelta

        inv_qs = Inventory.objects.filter(organization=organization)

        # Valuation at cost (AMC)
        agg = inv_qs.aggregate(
            total_cost_value=Sum(F('quantity') * F('product__cost_price')),
            total_retail_value=Sum(F('quantity') * F('product__selling_price_ttc')),
            total_items=Sum('quantity'),
        )
        total_cost = Decimal(str(agg['total_cost_value'] or '0'))
        total_retail = Decimal(str(agg['total_retail_value'] or '0'))
        total_items = Decimal(str(agg['total_items'] or '0'))

        # Low stock count
        low_stock_count = 0
        for inv in inv_qs.select_related('product'):
            if inv.quantity < inv.product.min_stock_level:
                low_stock_count += 1

        # Movement summary (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        movement_agg = InventoryMovement.objects.filter(
            organization=organization,
            created_at__gte=thirty_days_ago,
        ).values('type').annotate(
            total_qty=Sum('quantity'),
            total_value=Sum(F('quantity') * F('cost_price')),
        )

        movements = {}
        for m in movement_agg:
            movements[m['type']] = {
                'quantity': float(m['total_qty'] or 0),
                'value': float(m['total_value'] or 0),
            }

        return {
            "total_cost_value": float(total_cost),
            "total_retail_value": float(total_retail),
            "potential_margin": float(total_retail - total_cost),
            "total_items": float(total_items),
            "low_stock_count": low_stock_count,
            "sku_count": Product.objects.filter(organization=organization, status='ACTIVE').count(),
            "movements_30d": movements,
            "timestamp": timezone.now().isoformat(),
        }

    @staticmethod
    def adjust_stock(organization, product, warehouse, quantity, reason=None, reference=None):
        """
        Performs a manual stock adjustment (gain or loss).
        Positive quantity = gain, negative = loss.
        Creates an ADJUSTMENT movement record for audit trail.
        """
        from apps.inventory.models import Inventory, InventoryMovement

        adj_qty = Decimal(str(quantity))
        if adj_qty == Decimal('0'):
            raise ValidationError("Adjustment quantity cannot be zero.")

        if not reference:
            reference = f"ADJ-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
            inventory, _ = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=warehouse,
                product=product,
            )

            new_quantity = Decimal(str(inventory.quantity)) + adj_qty
            if new_quantity < Decimal('0'):
                raise ValidationError(
                    f"Adjustment would result in negative stock ({new_quantity}) "
                    f"for {product.name} in {warehouse.name}"
                )

            inventory.quantity = new_quantity
            inventory.save()

            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='ADJUSTMENT',
                quantity=adj_qty,
                cost_price=Decimal(str(product.cost_price)),
                cost_price_ht=Decimal(str(product.cost_price_ht)),
                reference=reference,
                reason=reason or '',
            )

            return inventory

    @staticmethod
    def reduce_stock(organization, product, warehouse, quantity, reference=None):
        """Reduces stock and captures AMC for COGS booking."""
        from apps.inventory.models import Inventory, InventoryMovement

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
