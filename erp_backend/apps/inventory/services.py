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
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, is_tax_recoverable=True, reference=None, user=None):
        from apps.inventory.models import Inventory, InventoryMovement
        from apps.finance.services import ForensicAuditService
        
        if not reference: reference = f"REC-{uuid.uuid4().hex[:8].upper()}"
        inbound_qty = Decimal(str(quantity))
        effective_cost = InventoryService.calculate_effective_cost(cost_price_ht, product.tva_rate, is_tax_recoverable)
        inbound_value = inbound_qty * effective_cost
        
        with transaction.atomic():
            # Professional Audit: Lock product for AMC calculation integrity
            from apps.inventory.models import Product
            product = Product.objects.select_for_update().get(id=product.id)
            
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
                try:
                    from apps.finance.services import LedgerService
                    LedgerService.create_journal_entry(organization=organization, transaction_date=timezone.now(), description=f"Stock Reception: {product.name}", reference=reference, status='POSTED', site_id=warehouse.site_id, user=user, lines=[
                        {"account_id": inv_acc, "debit": inbound_value, "credit": Decimal('0')},
                        {"account_id": susp_acc, "debit": Decimal('0'), "credit": inbound_value}
                    ])
                except ImportError:
                    logger.warning(f"Finance module unavailable — journal entry skipped for {reference}")

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockReception",
                object_id=product.id,
                change_type="CREATE",
                payload={"qty": str(inbound_qty), "cost": str(effective_cost), "ref": reference}
            )
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
    def adjust_stock(organization, product, warehouse, quantity, reason=None, reference=None, user=None):
        from apps.inventory.models import Inventory, InventoryMovement
        from apps.finance.services import ForensicAuditService

        adj_qty = Decimal(str(quantity))
        if adj_qty == Decimal('0'):
            raise ValidationError("Adjustment quantity cannot be zero.")

        if not reference:
            reference = f"ADJ-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
            # Professional Audit: Lock product for cost basis integrity
            from apps.inventory.models import Product
            product = Product.objects.select_for_update().get(id=product.id)
            
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

            cost_basis = Decimal(str(product.cost_price))
            adj_value = abs(adj_qty * cost_basis)

            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='ADJUSTMENT',
                quantity=adj_qty,
                cost_price=cost_basis,
                cost_price_ht=Decimal(str(product.cost_price_ht)),
                reference=reference,
                reason=reason or '',
            )
            
            # Cross-module: Financial Sync
            from erp.services import ConfigurationService
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            adj_acc = rules.get('inventory', {}).get('adjustment')
            
            if inv_acc and adj_acc:
                try:
                    from apps.finance.services import LedgerService
                    desc = f"Stock Adjustment ({'Gain' if adj_qty > 0 else 'Loss'}): {product.name}"
                    if adj_qty > 0:
                        lines = [
                            {"account_id": inv_acc, "debit": adj_value, "credit": Decimal('0')},
                            {"account_id": adj_acc, "debit": Decimal('0'), "credit": adj_value}
                        ]
                    else:
                        lines = [
                            {"account_id": adj_acc, "debit": adj_value, "credit": Decimal('0')},
                            {"account_id": inv_acc, "debit": Decimal('0'), "credit": adj_value}
                        ]
                    
                    LedgerService.create_journal_entry(
                        organization=organization, transaction_date=timezone.now(),
                        description=desc, reference=reference, status='POSTED',
                        site_id=warehouse.site_id, user=user, lines=lines
                    )
                except ImportError:
                    pass

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockAdjustment",
                object_id=product.id,
                change_type="UPDATE",
                payload={"qty": str(adj_qty), "reason": reason, "ref": reference}
            )

            return inventory

    @staticmethod
    def reduce_stock(organization, product, warehouse, quantity, reference=None, user=None):
        """Reduces stock and captures AMC for COGS booking."""
        from apps.inventory.models import Inventory, InventoryMovement
        from apps.finance.services import ForensicAuditService

        qty_to_reduce = Decimal(str(quantity))
        
        with transaction.atomic():
            # Lock product for consistent AMC capture
            from apps.inventory.models import Product
            product = Product.objects.select_for_update().get(id=product.id)
            current_amc = Decimal(str(product.cost_price))
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

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockReduction",
                object_id=product.id,
                change_type="UPDATE",
                payload={"qty": str(qty_to_reduce), "ref": reference}
            )

            return current_amc

    @staticmethod
    def transfer_stock(organization, product, source_warehouse, destination_warehouse, quantity, reference=None, user=None):
        """
        Transfers stock between warehouses within the same organization.
        Creates paired TRANSFER movements for full audit trail.
        """
        from apps.inventory.models import Inventory, InventoryMovement
        from apps.finance.services import ForensicAuditService

        qty = Decimal(str(quantity))
        if qty <= Decimal('0'):
            raise ValidationError("Transfer quantity must be positive.")

        if source_warehouse.id == destination_warehouse.id:
            raise ValidationError("Source and destination warehouse must be different.")

        if not reference:
            reference = f"TRF-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
            from apps.inventory.models import Product
            product = Product.objects.select_for_update().get(id=product.id)
            current_cost = Decimal(str(product.cost_price))
            # Deduct from source
            source_inv = Inventory.objects.filter(
                organization=organization,
                warehouse=source_warehouse,
                product=product,
            ).first()

            if not source_inv or source_inv.quantity < qty:
                raise ValidationError(
                    f"Insufficient stock for {product.name} in {source_warehouse.name} "
                    f"(available: {source_inv.quantity if source_inv else 0})"
                )

            source_inv.quantity = Decimal(str(source_inv.quantity)) - qty
            source_inv.save()

            # Add to destination
            dest_inv, _ = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=destination_warehouse,
                product=product,
            )
            dest_inv.quantity = Decimal(str(dest_inv.quantity)) + qty
            dest_inv.save()

            # Create paired movements
            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=source_warehouse,
                type='TRANSFER',
                quantity=-qty,
                cost_price=current_cost,
                cost_price_ht=Decimal(str(product.cost_price_ht)),
                reference=reference,
                reason=f"Transfer OUT to {destination_warehouse.name}",
            )
            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=destination_warehouse,
                type='TRANSFER',
                quantity=qty,
                cost_price=current_cost,
                cost_price_ht=Decimal(str(product.cost_price_ht)),
                reference=reference,
                reason=f"Transfer IN from {source_warehouse.name}",
            )

            ForensicAuditService.log_mutation(
                organization=organization,
                user=user,
                model_name="StockTransfer",
                object_id=product.id,
                change_type="UPDATE",
                payload={"qty": str(qty), "from": source_warehouse.name, "to": destination_warehouse.name, "ref": reference}
            )

            return {
                "source_remaining": float(source_inv.quantity),
                "destination_total": float(dest_inv.quantity),
            }
