import uuid
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .base import InventoryBaseService, logger

class StockService:
    @staticmethod
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, 
                      is_tax_recoverable=True, reference=None, user=None, 
                      scope='OFFICIAL', serials=None, skip_finance=False):
        from apps.inventory.models import Inventory, InventoryMovement, Product
        from django.utils import timezone
        
        if not reference: reference = f"REC-{uuid.uuid4().hex[:8].upper()}"
        inbound_qty = Decimal(str(quantity))
        effective_cost = InventoryBaseService.calculate_effective_cost(cost_price_ht, product.tva_rate, is_tax_recoverable)
        inbound_value = inbound_qty * effective_cost
        
        with transaction.atomic():
            # Professional Audit: Lock product for AMC calculation integrity
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
            product.cost_price_ttc = Decimal(str(cost_price_ht)) * (Decimal('1') + (Decimal(str(product.tva_rate)) / Decimal('100')))
            product.save()
            
            inventory, _ = Inventory.objects.get_or_create(organization=organization, warehouse=warehouse, product=product)
            inventory.quantity = Decimal(str(inventory.quantity)) + inbound_qty
            inventory.save()
            
            InventoryMovement.objects.create(
                organization=organization, product=product, warehouse=warehouse, 
                type='IN', quantity=inbound_qty, cost_price=effective_cost, 
                reference=reference, scope=scope
            )
        
            # Valuation Integration (FIFO/LIFO/AMC)
            from .valuation_service import InventoryValuationService
            InventoryValuationService.record_stock_in(
                organization=organization, product=product, warehouse=warehouse,
                quantity=inbound_qty, unit_cost=effective_cost, reference=reference
            )

            # Serial Tracking Integration
            if product.tracks_serials:
                if not serials or len(serials) != int(inbound_qty):
                    raise ValidationError(f"Product {product.name} requires {int(inbound_qty)} serial numbers.")
                from .serial_service import SerialService
                for sn in serials:
                    SerialService.register_serial_entry(
                        organization, product, warehouse, sn, reference, 
                        cost_price=effective_cost, user_name=user.username if user else None
                    )
            
            # Cross-module: create journal entry for stock reception via ConnectorEngine
            if not skip_finance:
                try:
                    from erp.connector_engine import connector_engine
                    connector_engine.route_write(
                        target_module='finance',
                        endpoint='post_stock_adjustment',
                        data={
                            'organization_id': organization.id,
                            'adjustment_amount': str(inbound_value),
                            'reference': reference,
                            'reason': f"Stock Reception: {product.name}",
                            'scope': scope,
                            'site_id': warehouse.parent_id or warehouse.id,
                            'user_id': user.id if user else None,
                        },
                        organization_id=organization.id,
                        source_module='inventory',
                    )
                except Exception:
                    logger.warning(f"Finance module integration failed for {reference}")

            # Audit via ConnectorEngine
            _log_audit(organization, user, 'StockReception', product.id, 'CREATE',
                       {'qty': str(inbound_qty), 'cost': str(effective_cost), 'ref': reference})

            # Auto-create barcode print session for received products
            try:
                from .print_session_service import PrintSessionService
                if product.barcode:
                    PrintSessionService.on_purchase_received(
                        org_id=organization, products=[product], user=user,
                    )
            except Exception:
                logger.warning(f'PrintSession auto-create failed for receive_stock {reference}')

            return inventory

    @staticmethod
    def adjust_stock(organization, product, warehouse, quantity, reason=None, reference=None, user=None, scope='OFFICIAL', skip_finance=False):
        from apps.inventory.models import Inventory, InventoryMovement, Product
        from django.utils import timezone

        adj_qty = Decimal(str(quantity))
        if adj_qty == Decimal('0'):
            raise ValidationError("Adjustment quantity cannot be zero.")

        if not reference:
            reference = f"ADJ-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
            # Professional Audit: Lock product for cost basis integrity
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
                scope=scope,
                reason=reason or '',
            )
        
            # Valuation Integration
            from .valuation_service import InventoryValuationService
            if adj_qty > 0:
                InventoryValuationService.record_stock_in(
                    organization=organization, product=product, warehouse=warehouse,
                    quantity=adj_qty, unit_cost=cost_basis, reference=reference
                )
            else:
                InventoryValuationService.record_stock_out(
                    organization=organization, product=product, warehouse=warehouse,
                    quantity=abs(adj_qty), reference=reference
                )

            # Cross-module: Financial Sync via ConnectorEngine
            if not skip_finance:
                try:
                    from erp.connector_engine import connector_engine
                    connector_engine.route_write(
                        target_module='finance',
                        endpoint='post_stock_adjustment',
                        data={
                            'organization_id': organization.id,
                            'adjustment_amount': str(adj_value if adj_qty > 0 else -adj_value),
                            'reference': reference,
                            'reason': f"Stock Adjustment ({'Gain' if adj_qty > 0 else 'Loss'}): {product.name}",
                            'scope': scope,
                            'site_id': warehouse.parent_id or warehouse.id,
                            'user_id': user.id if user else None,
                        },
                        organization_id=organization.id,
                        source_module='inventory',
                    )
                except Exception:
                    pass

            # Audit via ConnectorEngine
            _log_audit(organization, user, 'StockAdjustment', product.id, 'UPDATE',
                       {'qty': str(adj_qty), 'reason': reason, 'ref': reference})

            return inventory

    @staticmethod
    def reduce_stock(organization, product, warehouse, quantity, reference=None, 
                     user=None, scope='OFFICIAL', serials=None, skip_finance=False, 
                     allow_negative=False):
        """Reduces stock and captures AMC for COGS booking."""
        from apps.inventory.models import Inventory, InventoryMovement, Product

        qty_to_reduce = Decimal(str(quantity))
        
        with transaction.atomic():
            # Lock product for consistent AMC capture
            product = Product.objects.select_for_update().get(id=product.id)
            current_amc = Decimal(str(product.cost_price))
            inventory, _ = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=warehouse,
                product=product,
                defaults={'quantity': Decimal('0.00')}
            )

            if not allow_negative and inventory.quantity < qty_to_reduce:
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
                reference=reference or f"SALE-{uuid.uuid4().hex[:6].upper()}",
                scope=scope
            )
        
            # Valuation Integration
            from .valuation_service import InventoryValuationService
            InventoryValuationService.record_stock_out(
                organization=organization, product=product, warehouse=warehouse,
                quantity=qty_to_reduce, reference=reference,
                allow_negative=allow_negative
            )

            # Serial Tracking Integration
            if product.tracks_serials:
                if not serials or len(serials) != int(qty_to_reduce):
                    raise ValidationError(f"Product {product.name} requires {int(qty_to_reduce)} serial numbers for exit.")
                from .serial_service import SerialService
                for sn in serials:
                    SerialService.register_serial_exit(
                        organization, product, warehouse, sn, 
                        reference or f"SALE-SERIAL-{product.id}", 
                        user_name=user.username if user else None
                    )

            # Audit via ConnectorEngine
            _log_audit(organization, user, 'StockReduction', product.id, 'UPDATE',
                       {'qty': str(qty_to_reduce), 'ref': reference})

            return current_amc

    @staticmethod
    def transfer_stock(organization, product, source_warehouse, destination_warehouse, 
                       quantity, reference=None, user=None, scope='OFFICIAL'):
        from apps.inventory.models import Inventory, InventoryMovement, Product

        qty = Decimal(str(quantity))
        if qty <= Decimal('0'):
            raise ValidationError("Transfer quantity must be positive.")

        if source_warehouse.id == destination_warehouse.id:
            raise ValidationError("Source and destination warehouse must be different.")

        if not reference:
            reference = f"TRF-{uuid.uuid4().hex[:8].upper()}"

        with transaction.atomic():
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
                scope=scope,
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
                scope=scope,
                reason=f"Transfer IN from {source_warehouse.name}",
            )
        
            # Valuation Integration
            from .valuation_service import InventoryValuationService
            InventoryValuationService.record_stock_out(
                organization=organization, product=product, warehouse=source_warehouse,
                quantity=qty, reference=reference
            )
            InventoryValuationService.record_stock_in(
                organization=organization, product=product, warehouse=destination_warehouse,
                quantity=qty, unit_cost=current_cost, reference=reference
            )

            # Audit via ConnectorEngine
            _log_audit(organization, user, 'StockTransfer', product.id, 'UPDATE',
                       {'qty': str(qty), 'from': source_warehouse.name, 'to': destination_warehouse.name, 'ref': reference})

            # Auto-create barcode print session for transferred products
            try:
                from .print_session_service import PrintSessionService
                if product.barcode:
                    PrintSessionService.on_transfer_completed(
                        org_id=organization, products=[product], user=user,
                    )
            except Exception:
                logger.warning(f'PrintSession auto-create failed for transfer {reference}')

            return {
                "source_remaining": float(source_inv.quantity),
                "destination_total": float(dest_inv.quantity),
            }


# ── Module-level audit helper ────────────────────────────────────────────────

def _log_audit(organization, user, model_name, object_id, change_type, payload):
    """Route audit logging through ConnectorEngine instead of importing ForensicAuditService."""
    try:
        from erp.connector_engine import connector_engine
        connector_engine.route_write(
            target_module='finance',
            endpoint='log_audit_mutation',
            data={
                'organization_id': organization.id,
                'user_id': user.id if user else None,
                'model_name': model_name,
                'object_id': object_id,
                'change_type': change_type,
                'payload': payload,
            },
            organization_id=organization.id,
            source_module='inventory',
        )
    except Exception:
        pass  # Audit logging should never block business operations
