"""
Valuation Service
=================
FIFO, LIFO, and Weighted Average costing for inventory valuation.
Includes expiry alert generation.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class ValuationService:
    """Centralized inventory valuation with FIFO/LIFO/AVG and expiry alerts."""

    # ── Stock In ─────────────────────────────────────────────────────

    @staticmethod
    def record_stock_in(
        organization, product, warehouse, quantity, unit_cost,
        reference=None, batch=None, valuation_method='WEIGHTED_AVG'
    ):
        """
        Record a stock-in movement and update running valuation.

        Args:
            organization: Organization instance
            product: Product instance
            warehouse: Warehouse instance
            quantity: Decimal quantity received
            unit_cost: Decimal cost per unit
            reference: str reference (e.g., "PUR-123")
            batch: Optional ProductBatch instance
            valuation_method: 'FIFO', 'LIFO', or 'WEIGHTED_AVG'
        """
        from apps.inventory.advanced_models import StockValuationEntry

        quantity = Decimal(str(quantity))
        unit_cost = Decimal(str(unit_cost))
        total_value = (quantity * unit_cost).quantize(Decimal('0.01'))

        with transaction.atomic():
            # Get current running balance
            last_entry = StockValuationEntry.objects.filter(
                organization=organization,
                product=product,
                warehouse=warehouse,
            ).order_by('-movement_date', '-created_at').first()

            prev_qty = last_entry.running_quantity if last_entry else Decimal('0')
            prev_val = last_entry.running_value if last_entry else Decimal('0')

            new_qty = prev_qty + quantity
            new_val = prev_val + total_value
            new_avg = (new_val / new_qty).quantize(Decimal('0.01')) if new_qty > 0 else Decimal('0')

            entry = StockValuationEntry.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                movement_type='IN',
                movement_date=timezone.now(),
                quantity=quantity,
                unit_cost=unit_cost,
                total_value=total_value,
                valuation_method=valuation_method,
                reference=reference,
                batch=batch,
                running_quantity=new_qty,
                running_value=new_val,
                running_avg_cost=new_avg,
            )
            return entry

    # ── Stock Out ────────────────────────────────────────────────────

    @staticmethod
    def record_stock_out(
        organization, product, warehouse, quantity,
        reference=None, valuation_method='WEIGHTED_AVG',
        allow_negative=False
    ):
        """
        Record a stock-out movement.
        Cost is determined by the valuation method:
        - FIFO: use oldest batch cost
        - LIFO: use newest batch cost
        - WEIGHTED_AVG: use current average cost
        
        If allow_negative is True, the insufficient stock check is skipped.
        """
        from apps.inventory.advanced_models import StockValuationEntry

        quantity = Decimal(str(quantity))

        with transaction.atomic():
            last_entry = StockValuationEntry.objects.filter(
                organization=organization,
                product=product,
                warehouse=warehouse,
            ).order_by('-movement_date', '-created_at').first()

            if not allow_negative and (not last_entry or last_entry.running_quantity < quantity):
                raise ValidationError(
                    f"Insufficient stock: have {last_entry.running_quantity if last_entry else 0}, need {quantity}"
                )

            # Determine unit cost based on method
            if valuation_method == 'WEIGHTED_AVG':
                unit_cost = last_entry.running_avg_cost
            elif valuation_method == 'FIFO':
                oldest = StockValuationEntry.objects.filter(
                    organization=organization, product=product, warehouse=warehouse,
                    movement_type='IN', running_quantity__gt=0
                ).order_by('movement_date').first()
                unit_cost = oldest.unit_cost if oldest else last_entry.running_avg_cost
            elif valuation_method == 'LIFO':
                newest = StockValuationEntry.objects.filter(
                    organization=organization, product=product, warehouse=warehouse,
                    movement_type='IN'
                ).order_by('-movement_date').first()
                unit_cost = newest.unit_cost if newest else last_entry.running_avg_cost
            else:
                unit_cost = last_entry.running_avg_cost

            total_value = (quantity * unit_cost).quantize(Decimal('0.01'))

            new_qty = last_entry.running_quantity - quantity
            new_val = last_entry.running_value - total_value
            new_avg = (new_val / new_qty).quantize(Decimal('0.01')) if new_qty > 0 else Decimal('0')

            entry = StockValuationEntry.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                movement_type='OUT',
                movement_date=timezone.now(),
                quantity=quantity,
                unit_cost=unit_cost,
                total_value=total_value,
                valuation_method=valuation_method,
                reference=reference,
                running_quantity=new_qty,
                running_value=new_val,
                running_avg_cost=new_avg,
            )
            return entry

    # ── Expiry Alerts ────────────────────────────────────────────────

    @staticmethod
    def check_expiry_alerts(organization):
        """
        Scan all active batches and generate ExpiryAlerts.
        - EXPIRED: already past expiry
        - CRITICAL: 0-30 days until expiry
        - WARNING: 31-60 days until expiry
        """
        from apps.inventory.advanced_models import ProductBatch, ExpiryAlert

        today = timezone.now().date()
        alerts_created = []

        batches = ProductBatch.objects.filter(
            organization=organization,
            status='ACTIVE',
            expiry_date__isnull=False,
            quantity__gt=0,
        )

        for batch in batches:
            days_until = (batch.expiry_date - today).days

            if days_until > 60:
                continue  # No alert needed

            if days_until <= 0:
                severity = 'EXPIRED'
                batch.status = 'EXPIRED'
                batch.save()
            elif days_until <= 30:
                severity = 'CRITICAL'
            else:
                severity = 'WARNING'

            # Avoid duplicate alerts
            existing = ExpiryAlert.objects.filter(
                organization=organization,
                batch=batch,
                severity=severity,
                is_acknowledged=False,
            ).exists()
            if existing:
                continue

            value_at_risk = (batch.quantity * batch.cost_price).quantize(Decimal('0.01'))

            alert = ExpiryAlert.objects.create(
                organization=organization,
                batch=batch,
                product=batch.product,
                severity=severity,
                days_until_expiry=days_until,
                quantity_at_risk=batch.quantity,
                value_at_risk=value_at_risk,
            )
            alerts_created.append(alert)
            logger.info(f"[EXPIRY] {severity}: {batch.product.name} — Batch {batch.batch_number} expires in {days_until} days")

        return alerts_created

    # ── Valuation Summary ────────────────────────────────────────────

    @staticmethod
    def get_stock_valuation_summary(organization, warehouse_id=None):
        """
        Get current stock valuation summary per product, optionally filtered by warehouse.
        Returns total quantity, total value, and average cost per product.
        """
        from apps.inventory.advanced_models import StockValuationEntry

        # Get latest valuation entry per product/warehouse
        filters = {'organization': organization}
        if warehouse_id:
            filters['warehouse_id'] = warehouse_id

        # Get the latest entry for each product
        from apps.inventory.models import Product
        products = Product.objects.filter(organization=organization, is_active=True)

        summary = []
        for product in products:
            entry_filters = {**filters, 'product': product}
            last_entry = StockValuationEntry.objects.filter(
                **entry_filters
            ).order_by('-movement_date', '-created_at').first()

            if last_entry and last_entry.running_quantity > 0:
                summary.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'product_sku': product.sku if hasattr(product, 'sku') else None,
                    'quantity': float(last_entry.running_quantity),
                    'total_value': float(last_entry.running_value),
                    'avg_cost': float(last_entry.running_avg_cost),
                    'method': last_entry.valuation_method,
                })

        return summary
