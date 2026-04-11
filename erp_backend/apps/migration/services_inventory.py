"""
Migration Service — Orchestrates the full UltimatePOS → TSF migration.
Runs entity imports in dependency order with transaction safety and progress tracking.
"""
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.parsers import SQLDumpParser, DirectDBReader
from apps.migration.mappers import (
    UnitMapper, CategoryMapper, BrandMapper, ProductMapper,
    ContactMapper, TransactionMapper, SellLineMapper, PurchaseLineMapper,
    AccountMapper, SiteMapper, ExpenseMapper, TransactionPaymentMapper,
    safe_int, safe_bool, safe_decimal, safe_str
)

logger = logging.getLogger(__name__)



class MigrationInventoryMixin:

    def _migrate_products(self):
        """Migrate products + all variations → Product entries."""
        from apps.inventory.models import Product

        # Index variations by product_id
        variations_by_product = {}
        for v in self._get_rows('variations'):
            pid = safe_int(v.get('product_id'))
            if pid:
                variations_by_product.setdefault(pid, []).append(v)

        # Pre-load tax mapping
        tax_rate_mapping = {}
        try:
            from apps.finance.models import TaxGroup
            reverse_tax_map = {v: k for k, v in self.id_maps['TAX_GROUP'].items()}
            if reverse_tax_map:
                mapped_taxes = TaxGroup.objects.filter(id__in=reverse_tax_map.keys())
                for tg in mapped_taxes:
                    sid = reverse_tax_map.get(tg.id)
                    if sid:
                        tax_rate_mapping[sid] = tg.rate / Decimal('100')
        except Exception: pass

        product_rows = self._get_rows('products')
        count = 0
        for row in product_rows:
            source_id = safe_int(row.get('id'))
            if not source_id or row.get('deleted_at'):
                continue

            product_variations = variations_by_product.get(source_id, [])
            for i, v in enumerate(product_variations):
                v_id = safe_int(v.get('id'))
                if v.get('deleted_at'): continue

                existing = self._get_or_create_mapping('PRODUCT', v_id, 'variations')
                if existing:
                    self.id_maps['PRODUCT'][v_id] = existing
                    continue

                try:
                    mapped = ProductMapper.map_row(
                        row,
                        variation_data=v,
                        brand_mapping=self.id_maps['BRAND'],
                        category_mapping=self.id_maps['CATEGORY'],
                        unit_mapping=self.id_maps['UNIT'],
                        tax_mapping=tax_rate_mapping,
                    )

                    suffix = f" - {v.get('name')}" if v.get('name') and v.get('name') != 'DUMMY' else ""
                    
                    product_kwargs = {
                        'organization_id': self.organization_id,
                        'sku': mapped['sku'],
                        'name': f"{mapped['name']}{suffix}",
                        'product_type': mapped.get('type', 'STANDARD'),
                        'selling_price_ht': mapped.get('sell_price_ht', Decimal('0.00')),
                        'selling_price_ttc': mapped.get('sell_price_ttc', Decimal('0.00')),
                        'cost_price_ht': mapped.get('purchase_price_ht', Decimal('0.00')),
                        'cost_price_ttc': mapped.get('purchase_price_ttc', Decimal('0.00')),
                        'is_active': mapped.get('is_active', True),
                        'tva_rate': mapped.get('tax_rate', Decimal('0.00')) * 100,
                        'manage_stock': mapped.get('manage_stock', True),
                        'is_expiry_tracked': mapped.get('is_expiry_tracked', False),
                    }

                    for field in ['barcode', 'brand_id', 'category_id', 'unit_id', 'description', 'image_url']:
                        if mapped.get(field): product_kwargs[field] = mapped[field]
                        elif field == 'image_url' and mapped.get('image'):
                            product_kwargs[field] = mapped['image']

                    product, created = Product.objects.get_or_create(
                        organization_id=self.organization_id,
                        sku=mapped['sku'],
                        defaults=product_kwargs
                    )
                    
                    if not created:
                        # Update important fields if it already existed (e.g. from previous partial run)
                        for k, v in product_kwargs.items():
                            setattr(product, k, v)
                        product.save()

                    self.id_maps['PRODUCT'][v_id] = product.id
                    self._save_mapping('PRODUCT', v_id, product.id, 'variations', 
                                       {**ProductMapper.extra_data(row, variation_data=v), 'original_product_id': source_id, 'is_variation': True})
                    count += 1
                    if count % 100 == 0: self._heartbeat(sub_progress=f"{count:,} products")
                except Exception as e:
                    self._log_error(f"Product {source_id} Var {v_id}: {str(e)}")

        self.job.total_products = count
        logger.info(f"Migrated {count} products/variations")


    def _migrate_combo_links(self):
        """Link combo product components after all products are imported."""
        from apps.inventory.models import Product, ComboComponent
        import json

        count = 0
        # 1. JSON-based combos (stored in variations.combo_variations)
        for v_row in self._get_rows('variations'):
            combo_json = v_row.get('combo_variations')
            if not combo_json:
                continue

            v_id = safe_int(v_row.get('id'))
            combo_product_id = self.id_maps['PRODUCT'].get(v_id)
            if not combo_product_id:
                continue

            # Parse the combo_variations JSON
            try:
                if isinstance(combo_json, str):
                    components = json.loads(combo_json)
                elif isinstance(combo_json, list):
                    components = combo_json
                else:
                    continue

                if not isinstance(components, list):
                    continue

                for comp in components:
                    comp_variation_id = safe_int(comp.get('variation_id'))
                    comp_qty = safe_decimal(comp.get('quantity', '1'))
                    comp_price = safe_decimal(comp.get('unit_price')) if comp.get('unit_price') else None

                    if not comp_variation_id:
                        continue

                    component_product_id = self.id_maps['PRODUCT'].get(comp_variation_id)
                    if not component_product_id:
                        self._log_error(f"Combo link: variation {comp_variation_id} not found for combo product {v_id}")
                        continue

                    try:
                        link, created = ComboComponent.objects.get_or_create(
                            organization_id=self.organization_id,
                            combo_product_id=combo_product_id,
                            component_product_id=component_product_id,
                            defaults={
                                'quantity': comp_qty,
                                'price_override': comp_price,
                                'sort_order': count,
                            }
                        )
                        if created:
                            self._save_mapping('COMBO_LINK', v_id * 10000 + comp_variation_id,
                                               link.id, 'variations',
                                               {'combo_product': combo_product_id, 'component': component_product_id})
                            count += 1
                    except Exception as e:
                        self._log_error(f"Combo link {v_id}->{comp_variation_id}: {str(e)}")

            except (json.JSONDecodeError, TypeError) as e:
                self._log_error(f"Combo JSON parse for variation {v_id}: {str(e)}")

        # 2. Table-based combos (fallback if combo_variations table exists)
        for cv_row in self._get_rows('combo_variations'):
            v_id = safe_int(cv_row.get('variation_id'))
            comp_variation_id = safe_int(cv_row.get('variation_id_comp'))
            comp_qty = safe_decimal(cv_row.get('quantity', '1'))
            comp_price = safe_decimal(cv_row.get('unit_price')) if cv_row.get('unit_price') else None

            combo_product_id = self.id_maps['PRODUCT'].get(v_id)
            component_product_id = self.id_maps['PRODUCT'].get(comp_variation_id)

            if not combo_product_id or not component_product_id:
                continue

            try:
                link, created = ComboComponent.objects.get_or_create(
                    organization_id=self.organization_id,
                    combo_product_id=combo_product_id,
                    component_product_id=component_product_id,
                    defaults={
                        'quantity': comp_qty,
                        'price_override': comp_price,
                        'sort_order': count,
                    }
                )
                if created:
                    self._save_mapping('COMBO_LINK', v_id * 10000 + comp_variation_id,
                                       link.id, 'combo_variations',
                                       {'combo_product': combo_product_id, 'component': component_product_id})
                    count += 1
            except Exception as e:
                self._log_error(f"Table Combo link {v_id}->{comp_variation_id}: {str(e)}")

        logger.info(f"Linked {count} combo components")


    def _migrate_inventory(self):
        """Migrate UltimatePOS variation_location_details → TSF Inventory."""
        from apps.inventory.models import Inventory
        
        rows = self._get_rows('variation_location_details')
        count = 0
        skipped = 0
        
        # Pre-resolve default warehouse (fallback)
        default_warehouse_id = None
        warehouses = list(self.id_maps.get('WAREHOUSE', {}).values())
        if warehouses:
            default_warehouse_id = warehouses[0]
        
        if not warehouses:
            self._log_error("Inventory: No warehouses found! Cannot import stock levels.")
            return
        
        for row in rows:
            source_pid = safe_int(row.get('product_id'))
            source_loc_id = safe_int(row.get('location_id'))
            qty = safe_decimal(row.get('qty_available'))
            
            # Don't skip zero — zero stock is valid (product exists in warehouse)
            # Only skip if we can't resolve the product
            target_product_id = self.id_maps['PRODUCT'].get(source_pid)
            if not target_product_id:
                skipped += 1
                continue
            
            # Resolve warehouse with fallback
            target_warehouse_id = self.id_maps.get('WAREHOUSE', {}).get(source_loc_id)
            if not target_warehouse_id:
                target_warehouse_id = default_warehouse_id
                
            if not target_warehouse_id:
                skipped += 1
                continue
                
            try:
                Inventory.objects.update_or_create(
                    organization_id=self.organization_id,
                    product_id=target_product_id,
                    warehouse_id=target_warehouse_id,
                    variant=None,
                    defaults={'quantity': qty}
                )
                self._save_mapping('INVENTORY', safe_int(row.get('id', 0)) or count + 1,
                                   target_product_id, 'variation_location_details',
                                   f"qty={qty}")
                count += 1
                if count % 100 == 0:
                    self._heartbeat(sub_progress=f"{count:,} stock records")
            except Exception as e:
                self._log_error(f"Inventory {source_pid}/{source_loc_id}: {str(e)}")
                
        if skipped > 0:
            self._log_error(f"Inventory: {skipped} rows skipped (unmapped product or warehouse)")
        self.job.total_inventory = count
        self.job.save()
        logger.info(f"Migrated {count} inventory records ({skipped} skipped)")


    def _migrate_stock_adjustments(self):
        """Migrate UPOS stock_adjustment transactions + stock_adjustment_lines → StockAdjustmentOrder."""
        from apps.inventory.models import StockAdjustmentOrder, StockAdjustmentLine

        # Pre-load stock_adjustment_lines by transaction_id
        adj_lines_by_tx = {}
        for line_row in self._get_rows('stock_adjustment_lines'):
            tx_id = safe_int(line_row.get('transaction_id'))
            if tx_id:
                adj_lines_by_tx.setdefault(tx_id, []).append(line_row)

        rows = self._get_rows('transactions')
        total_rows = self.job.discovered_data.get('global_counts', {}).get('transactions', 0)
        count = 0
        line_count = 0

        for row in rows:
            tx_type = safe_str(row.get('type')).lower()
            if tx_type != 'stock_adjustment':
                continue

            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TRANSACTION', source_id, 'transactions')
            if existing:
                continue

            try:
                location_id = safe_int(row.get('location_id'))
                warehouse_id = self.id_maps.get('WAREHOUSE', {}).get(location_id)

                if not warehouse_id:
                    warehouses = list(self.id_maps.get('WAREHOUSE', {}).values())
                    warehouse_id = warehouses[0] if warehouses else None

                if not warehouse_id:
                    self._log_error(f"Stock adjustment {source_id}: No warehouse found")
                    continue

                t_date = row.get('transaction_date', '')
                if isinstance(t_date, str) and len(t_date) >= 10:
                    t_date = t_date[:10]
                else:
                    t_date = timezone.now().date().isoformat()

                adj_type = safe_str(row.get('adjustment_type')).lower()  # 'normal' or 'abnormal'

                adj_order = StockAdjustmentOrder.objects.create(
                    organization_id=self.organization_id,
                    reference=safe_str(row.get('ref_no') or row.get('invoice_no'), max_length=100) or f"ADJ-UPOS-{source_id}",
                    date=t_date,
                    warehouse_id=warehouse_id,
                    reason=f"Imported from UltimatePOS ({adj_type} adjustment)",
                    notes=safe_str(row.get('additional_notes')),
                    total_amount_adjustment=safe_decimal(row.get('final_total')),
                    is_posted=False,  # Always draft for review
                    created_at=row.get('transaction_date') or row.get('created_at'),
                )

                self._save_mapping('STOCK_ADJUSTMENT', source_id, adj_order.id, 'transactions',
                                   {'original_type': 'stock_adjustment', 'adjustment_type': adj_type})
                count += 1

                # Import adjustment lines
                for a_line in adj_lines_by_tx.get(source_id, []):
                    variation_id = safe_int(a_line.get('variation_id'))
                    product_id = self.id_maps['PRODUCT'].get(variation_id)
                    qty = safe_decimal(a_line.get('quantity'))

                    if not product_id:
                        continue

                    try:
                        StockAdjustmentLine.objects.create(
                            order=adj_order,
                            product_id=product_id,
                            qty_adjustment=qty,
                            amount_adjustment=safe_decimal(a_line.get('unit_price')) * qty,
                            warehouse_id=warehouse_id,
                            reason=f"Auto-imported line (UPOS adj {source_id})",
                            expiry_date=safe_str(a_line.get('exp_date'))[:10] if a_line.get('exp_date') else None,
                            batch_number=safe_str(a_line.get('lot_number'), max_length=100),
                        )
                        line_count += 1
                    except Exception as e:
                        self._log_error(f"Adjustment line {a_line.get('id')}: {str(e)}")

            except Exception as e:
                self._log_error(f"Stock adjustment {source_id}: {str(e)}")

        logger.info(f"Migrated {count} stock adjustments with {line_count} lines (all as draft)")


    def _migrate_stock_transfers(self):
        """Migrate UPOS purchase_transfer/sell_transfer transactions → StockTransferOrder."""
        from apps.inventory.models import StockTransferOrder, StockTransferLine

        rows = self._get_rows('transactions')
        count = 0

        for row in rows:
            tx_type = safe_str(row.get('type')).lower()
            if tx_type not in ('purchase_transfer', 'sell_transfer'):
                continue

            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('TRANSACTION', source_id, 'transactions')
            if existing:
                continue

            try:
                location_id = safe_int(row.get('location_id'))
                transfer_parent_id = safe_int(row.get('transfer_parent_id'))
                
                # Resolve warehouses
                from_wh = self.id_maps.get('WAREHOUSE', {}).get(location_id)
                # For the destination, we need to look at the linked transfer transaction
                to_wh = None
                if transfer_parent_id:
                    # The parent transfer might have a different location
                    # For now, use fallback
                    pass

                # If we can't resolve warehouses, still import as draft
                if not from_wh:
                    # Use first available warehouse as fallback
                    warehouses = list(self.id_maps.get('WAREHOUSE', {}).values())
                    from_wh = warehouses[0] if warehouses else None
                if not to_wh:
                    warehouses = list(self.id_maps.get('WAREHOUSE', {}).values())
                    to_wh = warehouses[1] if len(warehouses) > 1 else (warehouses[0] if warehouses else None)

                if not from_wh or not to_wh:
                    self._log_error(f"Transfer {source_id}: No warehouses found, skipping")
                    continue

                # Parse date
                t_date = row.get('transaction_date', '')
                if isinstance(t_date, str) and len(t_date) >= 10:
                    t_date = t_date[:10]
                else:
                    from django.utils import timezone as tz
                    t_date = tz.now().date().isoformat()

                transfer = StockTransferOrder.objects.create(
                    organization_id=self.organization_id,
                    reference=safe_str(row.get('ref_no') or row.get('invoice_no'), max_length=100) or f"TRF-UPOS-{source_id}",
                    date=t_date,
                    from_warehouse_id=from_wh,
                    to_warehouse_id=to_wh,
                    reason=f"Imported from UltimatePOS (type={tx_type})",
                    notes=safe_str(row.get('additional_notes')),
                    is_posted=False,  # Always draft so user reviews
                    created_at=row.get('transaction_date') or row.get('created_at'),
                )

                self._save_mapping('STOCK_TRANSFER', source_id, transfer.id, 'transactions',
                                   {'original_type': tx_type, 'is_stock_transfer': True})
                
                # Migrate Transfer Lines
                target_table = 'transaction_sell_lines' if tx_type == 'sell_transfer' else 'purchase_lines'
                transfer_lines = self._get_rows(target_table)
                for l_row in transfer_lines:
                    if safe_int(l_row.get('transaction_id')) == source_id:
                        v_id = safe_int(l_row.get('variation_id'))
                        p_id = self.id_maps['PRODUCT'].get(v_id)
                        if p_id:
                            StockTransferLine.objects.create(
                                order=transfer,
                                product_id=p_id,
                                qty_transferred=safe_decimal(l_row.get('quantity')),
                                from_warehouse_id=from_wh,
                                to_warehouse_id=to_wh,
                                expiry_date=safe_str(l_row.get('exp_date'))[:10] if l_row.get('exp_date') else None,
                                batch_number=safe_str(l_row.get('lot_number'), max_length=100),
                            )

                count += 1
            except Exception as e:
                self._log_error(f"Transfer {source_id}: {str(e)}")

        logger.info(f"Migrated {count} stock transfers (all as draft for review)")

