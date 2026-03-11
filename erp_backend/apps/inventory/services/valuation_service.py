from decimal import Decimal
import logging
from django.db import transaction, models
from django.db.models import Sum, F
from django.utils import timezone
from django.core.exceptions import ValidationError
from .base import logger

class InventoryValuationService:
    @staticmethod
    def get_inventory_valuation(organization):
        from apps.inventory.models import Inventory
        result = Inventory.objects.filter(tenant=organization).aggregate(
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )
        return {
            "total_value": Decimal(str(result['total_value'] or '0')),
            "item_count": Inventory.objects.filter(tenant=organization).count(),
            "timestamp": timezone.now(),
        }

    @staticmethod
    def get_inventory_financial_status(organization):
        from apps.inventory.models import Inventory, InventoryMovement, Product
        from datetime import timedelta

        inv_qs = Inventory.objects.filter(tenant=organization)

        agg = inv_qs.aggregate(
            total_cost_value=Sum(F('quantity') * F('product__cost_price')),
            total_retail_value=Sum(F('quantity') * F('product__selling_price_ttc')),
            total_items=Sum('quantity'),
        )
        total_cost = Decimal(str(agg['total_cost_value'] or '0'))
        total_retail = Decimal(str(agg['total_retail_value'] or '0'))
        total_items = Decimal(str(agg['total_items'] or '0'))

        low_stock_count = 0
        for inv in inv_qs.select_related('product'):
            if inv.quantity < inv.product.min_stock_level:
                low_stock_count += 1

        thirty_days_ago = timezone.now() - timedelta(days=30)
        movement_agg = InventoryMovement.objects.filter(
            tenant=organization,
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
            "sku_count": Product.objects.filter(tenant=organization, status='ACTIVE').count(),
            "movements_30d": movements,
            "timestamp": timezone.now().isoformat(),
        }

    @staticmethod
    def reconcile_with_finance(organization):
        from apps.inventory.models import Inventory
        from erp.services import ConfigurationService
        try:
            from apps.finance.models import ChartOfAccount
        except ImportError:
            return {"status": "ERROR", "message": "Finance module required for reconciliation."}

        physical_valuation = Inventory.objects.filter(tenant=organization).aggregate(
            total=Sum(F('quantity') * F('product__cost_price'))
        )['total'] or Decimal('0.00')

        rules = ConfigurationService.get_posting_rules(organization)
        inv_acc_id = rules.get('sales', {}).get('inventory')
        
        if not inv_acc_id:
            return {"status": "CONFIG_MISSING", "message": "Inventory posting rule not configured."}
            
        try:
            inv_acc = ChartOfAccount.objects.get(id=inv_acc_id)
            gl_balance = inv_acc.balance
            discrepancy = physical_valuation - gl_balance
            
            if abs(discrepancy) > Decimal('0.01'):
                return {
                    "status": "DISCREPANCY",
                    "message": f"Inventory discrepancy found: {discrepancy}",
                    "physical_valuation": physical_valuation,
                    "gl_balance": gl_balance,
                    "discrepancy": discrepancy,
                    "timestamp": timezone.now()
                }
                
            return {
                "status": "MATCHED",
                "message": "Physical inventory aligns with General Ledger.",
                "valuation": physical_valuation,
                "timestamp": timezone.now()
            }
        except ChartOfAccount.DoesNotExist:
            return {"status": "ERROR", "message": f"Account {inv_acc_id} not found."}

    @staticmethod
    def sync_inventory_to_ledger(organization, user=None):
        audit = InventoryValuationService.reconcile_with_finance(organization)
        if audit['status'] != 'DISCREPANCY':
            return audit

        discrepancy = audit['discrepancy']
        from erp.services import ConfigurationService
        rules = ConfigurationService.get_posting_rules(organization)
        inv_acc = rules.get('sales', {}).get('inventory')
        adj_acc = rules.get('inventory', {}).get('adjustment')

        if not inv_acc or not adj_acc:
            return {"status": "ERROR", "message": "Rules for inventory/adjustment missing."}

        try:
            from apps.finance.services import LedgerService
            desc = f"Inventory Valuation Sync: {'Gain' if discrepancy > 0 else 'Loss'}"
            if discrepancy > 0:
                lines = [
                    {"account_id": inv_acc, "debit": discrepancy, "credit": Decimal('0')},
                    {"account_id": adj_acc, "debit": Decimal('0'), "credit": discrepancy}
                ]
            else:
                lines = [
                    {"account_id": adj_acc, "debit": abs(discrepancy), "credit": Decimal('0')},
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": abs(discrepancy)}
                ]

            LedgerService.create_journal_entry(
                tenant=organization, transaction_date=timezone.now(),
                description=desc, reference="SYNC-AUTO", status='POSTED',
                user=user, lines=lines
            )
            return {"status": "FIXED", "adjusted_by": discrepancy}
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}

    # FIFO/LIFO/AVG Costing methods from original ValuationService
    @staticmethod
    def record_stock_in(organization, product, warehouse, quantity, unit_cost,
                        reference=None, batch=None, valuation_method='WEIGHTED_AVG'):
        from apps.inventory.models import StockValuationEntry
        quantity = Decimal(str(quantity))
        unit_cost = Decimal(str(unit_cost))
        total_value = (quantity * unit_cost).quantize(Decimal('0.01'))

        with transaction.atomic():
            last_entry = StockValuationEntry.objects.filter(
                tenant=organization, product=product, warehouse=warehouse
            ).order_by('-movement_date', '-created_at').first()

            prev_qty = last_entry.running_quantity if last_entry else Decimal('0')
            prev_val = last_entry.running_value if last_entry else Decimal('0')

            new_qty = prev_qty + quantity
            new_val = prev_val + total_value
            new_avg = (new_val / new_qty).quantize(Decimal('0.01')) if new_qty > 0 else Decimal('0')

            return StockValuationEntry.objects.create(
                tenant=organization, product=product, warehouse=warehouse,
                movement_type='IN', movement_date=timezone.now(),
                quantity=quantity, unit_cost=unit_cost, total_value=total_value,
                valuation_method=valuation_method, reference=reference, batch=batch,
                running_quantity=new_qty, running_value=new_val, running_avg_cost=new_avg
            )

    @staticmethod
    def record_stock_out(organization, product, warehouse, quantity,
                         reference=None, valuation_method='WEIGHTED_AVG', allow_negative=False):
        from apps.inventory.models import StockValuationEntry
        quantity = Decimal(str(quantity))

        with transaction.atomic():
            last_entry = StockValuationEntry.objects.filter(
                tenant=organization, product=product, warehouse=warehouse
            ).order_by('-movement_date', '-created_at').first()

            if not allow_negative and (not last_entry or last_entry.running_quantity < quantity):
                raise ValidationError(f"Insufficient stock: have {last_entry.running_quantity if last_entry else 0}, need {quantity}")

            if valuation_method == 'WEIGHTED_AVG':
                unit_cost = last_entry.running_avg_cost if last_entry else Decimal('0')
            elif valuation_method == 'FIFO':
                oldest = StockValuationEntry.objects.filter(
                    tenant=organization, product=product, warehouse=warehouse,
                    movement_type='IN', running_quantity__gt=0
                ).order_by('movement_date').first()
                unit_cost = oldest.unit_cost if oldest else (last_entry.running_avg_cost if last_entry else Decimal('0'))
            elif valuation_method == 'LIFO':
                newest = StockValuationEntry.objects.filter(
                    tenant=organization, product=product, warehouse=warehouse,
                    movement_type='IN'
                ).order_by('-movement_date').first()
                unit_cost = newest.unit_cost if newest else (last_entry.running_avg_cost if last_entry else Decimal('0'))
            else:
                unit_cost = last_entry.running_avg_cost if last_entry else Decimal('0')

            total_value = (quantity * unit_cost).quantize(Decimal('0.01'))
            new_qty = (last_entry.running_quantity if last_entry else Decimal('0')) - quantity
            new_val = (last_entry.running_value if last_entry else Decimal('0')) - total_value
            new_avg = (new_val / new_qty).quantize(Decimal('0.01')) if new_qty > 0 else Decimal('0')

            return StockValuationEntry.objects.create(
                tenant=organization, product=product, warehouse=warehouse,
                movement_type='OUT', movement_date=timezone.now(),
                quantity=quantity, unit_cost=unit_cost, total_value=total_value,
                valuation_method=valuation_method, reference=reference,
                running_quantity=new_qty, running_value=new_val, running_avg_cost=new_avg
            )

    @staticmethod
    def check_expiry_alerts(organization):
        from apps.inventory.models import ProductBatch, ExpiryAlert
        today = timezone.now().date()
        alerts_created = []

        batches = ProductBatch.objects.filter(
            tenant=organization, status='ACTIVE',
            expiry_date__isnull=False, quantity__gt=0
        )

        for batch in batches:
            days_until = (batch.expiry_date - today).days
            if days_until > 60: continue

            if days_until <= 0:
                severity = 'EXPIRED'
                batch.status = 'EXPIRED'
                batch.save()
            elif days_until <= 30: severity = 'CRITICAL'
            else: severity = 'WARNING'

            if ExpiryAlert.objects.filter(
                tenant=organization, batch=batch,
                severity=severity, is_acknowledged=False
            ).exists(): continue

            value_at_risk = (batch.quantity * batch.cost_price).quantize(Decimal('0.01'))
            alert = ExpiryAlert.objects.create(
                tenant=organization, batch=batch, product=batch.product,
                severity=severity, days_until_expiry=days_until,
                quantity_at_risk=batch.quantity, value_at_risk=value_at_risk
            )
            alerts_created.append(alert)

            # ── Auto-Task: EXPIRY_APPROACHING / PRODUCT_EXPIRED ──
            try:
                from apps.workspace.signals import trigger_inventory_event
                if severity == 'EXPIRED':
                    trigger_inventory_event(
                        organization, 'PRODUCT_EXPIRED',
                        product_name=str(batch.product),
                        product_id=batch.product_id,
                        reference=f'Batch:{batch.batch_number}',
                        extra={'days': days_until, 'qty': float(batch.quantity), 'value': float(value_at_risk)},
                    )
                else:
                    trigger_inventory_event(
                        organization, 'EXPIRY_APPROACHING',
                        product_name=str(batch.product),
                        product_id=batch.product_id,
                        reference=f'Batch:{batch.batch_number}',
                        extra={'days_until': days_until, 'qty': float(batch.quantity), 'severity': severity},
                    )
            except Exception:
                pass

        return alerts_created

    @staticmethod
    def get_stock_valuation_summary(organization, warehouse_id=None):
        from apps.inventory.models import StockValuationEntry, Product
        filters = {'organization': organization}
        if warehouse_id: filters['warehouse_id'] = warehouse_id

        products = Product.objects.filter(tenant=organization, is_active=True)
        summary = []
        for product in products:
            last_entry = StockValuationEntry.objects.filter(
                product=product, **filters
            ).order_by('-movement_date', '-created_at').first()

            if last_entry and last_entry.running_quantity > 0:
                summary.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'product_sku': product.sku,
                    'quantity': float(last_entry.running_quantity),
                    'total_value': float(last_entry.running_value),
                    'avg_cost': float(last_entry.running_avg_cost),
                    'method': last_entry.valuation_method,
                })
        return summary
