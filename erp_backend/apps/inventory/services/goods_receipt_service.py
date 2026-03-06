"""
GoodsReceiptService — Decision Engine for Purchase Receiving
============================================================
Computes operational intelligence metrics for receiving decisions:
  - Safe Qty, Safe Qty After Receipt, Receipt Coverage %
  - Sales Performance Score, Adjustment Risk Score
  - Rule-based warnings and recommended actions
  - Finalization: stock intake, PO updates, transfer triggers
"""
import logging
from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction
from django.db.models import Sum, Avg, Q, F
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

ZERO = Decimal('0.00')
ONE = Decimal('1.00')


class GoodsReceiptService:
    """
    Stateless service for goods receipt decision engine and finalization.
    """

    # ── Decision Engine ─────────────────────────────────────────────────────

    @staticmethod
    def compute_decision_metrics(product, warehouse, qty_received, expiry_date=None):
        """
        Compute all decision engine metrics for a product at a receiving location.
        Returns a dict of metric values.
        """
        from apps.inventory.models import Inventory, InventoryMovement

        org = warehouse.organization

        # ── Stock on Location ──
        stock_on_location = Inventory.objects.filter(
            product=product, warehouse=warehouse, organization=org
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        # ── Total Stock across all locations ──
        total_stock = Inventory.objects.filter(
            product=product, organization=org
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        # ── Average Daily Sales (last 90 days) ──
        ninety_days_ago = timezone.now() - timedelta(days=90)
        total_sold = InventoryMovement.objects.filter(
            product=product,
            organization=org,
            type='OUT',
            created_at__gte=ninety_days_ago,
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        avg_daily_sales = total_sold / Decimal('90')

        # ── Remaining Shelf Life ──
        remaining_shelf_life_days = None
        if expiry_date:
            delta = (expiry_date - date.today()).days
            remaining_shelf_life_days = max(delta, 0)

        # ── Safe Qty ──
        if remaining_shelf_life_days is not None and avg_daily_sales > 0:
            safe_qty = (avg_daily_sales * Decimal(str(remaining_shelf_life_days))) - stock_on_location
        else:
            # No expiry or no sales history — use a generous default (30 days coverage)
            safe_qty = (avg_daily_sales * Decimal('30')) - stock_on_location

        qty = Decimal(str(qty_received)) if qty_received else ZERO

        # ── Safe Qty After Receipt ──
        safe_qty_after_receipt = safe_qty - qty

        # ── Receipt Coverage % ──
        denominator = max(safe_qty, ONE)
        receipt_coverage_pct = (qty / denominator) * Decimal('100')

        # ── Sales Performance Score ──
        # recent_sales_value / avg_stock_value
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_sales_value = InventoryMovement.objects.filter(
            product=product, organization=org, type='OUT',
            created_at__gte=thirty_days_ago,
        ).aggregate(
            total=Sum(F('quantity') * F('cost_price_ht'))
        )['total'] or ZERO

        avg_stock_value = stock_on_location * (product.cost_price_ht if hasattr(product, 'cost_price_ht') else ZERO)
        sales_performance_score = recent_sales_value / max(avg_stock_value, ONE)

        # ── Adjustment Risk Score ──
        # total_neg_adjustments / total_purchased
        total_neg_adj = InventoryMovement.objects.filter(
            product=product, organization=org, type='ADJUSTMENT',
            quantity__lt=0,
        ).aggregate(total=Sum('quantity'))['total'] or ZERO
        total_neg_adj = abs(total_neg_adj)

        total_purchased = InventoryMovement.objects.filter(
            product=product, organization=org, type='IN',
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        adjustment_risk_score = total_neg_adj / max(total_purchased, ONE)

        return {
            'stock_on_location': stock_on_location,
            'total_stock': total_stock,
            'avg_daily_sales': avg_daily_sales,
            'remaining_shelf_life_days': remaining_shelf_life_days,
            'safe_qty': safe_qty,
            'safe_qty_after_receipt': safe_qty_after_receipt,
            'receipt_coverage_pct': receipt_coverage_pct,
            'sales_performance_score': sales_performance_score,
            'adjustment_risk_score': adjustment_risk_score,
        }

    @staticmethod
    def evaluate_rules(line, metrics, warehouse):
        """
        Apply decision rules and return warnings + recommended action.

        Args:
            line: GoodsReceiptLine instance (or dict-like with product info)
            metrics: dict from compute_decision_metrics
            warehouse: receiving Warehouse instance

        Returns:
            dict with 'warnings' (list[str]), 'recommended_action' (str),
            'transfer_requirement' (str)
        """
        warnings = []
        recommended_action = 'Safe to receive'
        transfer_requirement = 'NO_TRANSFER'

        safe_qty = metrics['safe_qty']
        safe_qty_after = metrics['safe_qty_after_receipt']
        remaining_days = metrics.get('remaining_shelf_life_days')
        avg_daily = metrics['avg_daily_sales']
        adj_risk = metrics['adjustment_risk_score']

        # ── Expiry Rules ──
        # E1: Short shelf life
        if remaining_days is not None and avg_daily > 0:
            expected_sell_through_days = metrics['stock_on_location'] / avg_daily if avg_daily > 0 else 9999
            if remaining_days < expected_sell_through_days:
                warnings.append('EXPIRY_RISK')
                recommended_action = 'Reject or request manager review — shelf life too short'

        # E2: Older batch exists
        if remaining_days is not None:
            from apps.inventory.models import Inventory
            older_batches = Inventory.objects.filter(
                product=line.product if hasattr(line, 'product') else line.get('product'),
                warehouse=warehouse,
                expiry_date__lt=line.expiry_date if hasattr(line, 'expiry_date') else line.get('expiry_date'),
                quantity__gt=0,
            ).exists()
            if older_batches:
                warnings.append('SHELF_ROTATION_NEEDED')

        # ── Stock Need Rules ──
        # S1: Overstock
        if safe_qty <= 0:
            warnings.append('OVERSTOCK_RISK')
            recommended_action = 'Reject excess or transfer elsewhere'

        # S2: Excess receipt
        elif safe_qty > 0 and safe_qty_after < 0:
            warnings.append('EXCESS_RECEIPT')
            recommended_action = 'Partially receive or transfer surplus'

        # ── Location Rules ──
        is_store = warehouse.location_type == 'STORE'
        is_warehouse = warehouse.location_type == 'WAREHOUSE'

        # L1: Store receiving — stock exceeds need
        if is_store and safe_qty_after < 0:
            warnings.append('TRANSFER_TO_WAREHOUSE')
            transfer_requirement = 'TO_WAREHOUSE'

        # L3: Warehouse receiving — shop demand exists
        if is_warehouse and avg_daily > 0 and safe_qty_after > 0:
            from apps.inventory.models import Inventory
            # Check if any store has low stock
            product_id = line.product_id if hasattr(line, 'product_id') else line.get('product_id')
            store_stock = Inventory.objects.filter(
                product_id=product_id,
                warehouse__location_type='STORE',
                warehouse__organization=warehouse.organization,
            ).aggregate(total=Sum('quantity'))['total'] or ZERO

            if store_stock < (avg_daily * Decimal('7')):  # Less than a week supply in stores
                warnings.append('TRANSFER_TO_STORE')
                transfer_requirement = 'TO_STORE'

        # ── High Risk Item ──
        if adj_risk > Decimal('0.15'):
            warnings.append('HIGH_ADJUSTMENT_RISK')

        # ── Unexpected Item ──
        is_unexpected = getattr(line, 'is_unexpected', False)
        if is_unexpected:
            warnings.append('UNEXPECTED_ITEM')
            warnings.append('APPROVAL_REQUIRED')
            recommended_action = 'Requires manager approval — item not on purchase order'

        # Default good status
        if not warnings:
            warnings.append('SAFE_TO_RECEIVE')

        return {
            'warnings': warnings,
            'recommended_action': recommended_action,
            'transfer_requirement': transfer_requirement,
        }

    @classmethod
    def compute_and_apply(cls, line):
        """
        Full decision engine: compute metrics, evaluate rules, and save on line.
        """
        metrics = cls.compute_decision_metrics(
            product=line.product,
            warehouse=line.receipt.warehouse,
            qty_received=line.qty_received,
            expiry_date=line.expiry_date,
        )
        rules = cls.evaluate_rules(line, metrics, line.receipt.warehouse)

        # Apply metrics to line
        line.stock_on_location = metrics['stock_on_location']
        line.total_stock = metrics['total_stock']
        line.avg_daily_sales = metrics['avg_daily_sales']
        line.remaining_shelf_life_days = metrics['remaining_shelf_life_days']
        line.safe_qty = metrics['safe_qty']
        line.safe_qty_after_receipt = metrics['safe_qty_after_receipt']
        line.receipt_coverage_pct = metrics['receipt_coverage_pct']
        line.sales_performance_score = metrics['sales_performance_score']
        line.adjustment_risk_score = metrics['adjustment_risk_score']

        # Apply rules
        line.decision_warnings = rules['warnings']
        line.recommended_action = rules['recommended_action']
        line.transfer_requirement = rules['transfer_requirement']

        if 'APPROVAL_REQUIRED' in rules['warnings']:
            line.approval_status = 'PENDING'

        line.save()
        return line

    # ── Finalization ────────────────────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def finalize_receipt(cls, goods_receipt, user=None):
        """
        Finalize a receiving session:
        1. Create InventoryMovement records for received items
        2. Update Inventory quantities
        3. Update PO line received quantities (Mode B)
        4. Auto-create transfer requests where needed
        5. Update session status
        """
        from apps.inventory.services.stock_service import StockService
        from apps.inventory.models import GoodsReceiptLine

        lines = goods_receipt.lines.filter(
            line_status__in=['RECEIVED', 'PARTIALLY_RECEIVED']
        )

        for line in lines:
            if line.qty_received <= 0:
                continue

            # 1. Stock intake via StockService
            cost = line.product.cost_price_ht if hasattr(line.product, 'cost_price_ht') else ZERO
            StockService.receive_stock(
                organization=goods_receipt.tenant,
                product=line.product,
                warehouse=goods_receipt.warehouse,
                quantity=line.qty_received,
                cost_price_ht=cost,
                reference=f"GR:{goods_receipt.receipt_number}",
                user=user,
                scope='OFFICIAL',
            )

            # 2. Update PO line if Mode B
            if line.po_line:
                try:
                    line.po_line.receive(line.qty_received)
                except ValidationError as e:
                    logger.warning(
                        f"PO line receive validation for {line.po_line}: {e}"
                    )

            # 3. Close the receipt line
            line.line_status = 'CLOSED'
            line.processed_by = user
            line.processed_at = timezone.now()
            line.save()

        # Create transfer requests where flagged
        cls._create_transfer_requests(goods_receipt, user)

        # Update session status
        goods_receipt.check_completeness()
        if goods_receipt.status == 'COMPLETED':
            goods_receipt.status = 'CLOSED'
            goods_receipt.completed_at = timezone.now()
            goods_receipt.save()

        return goods_receipt

    @staticmethod
    def _create_transfer_requests(goods_receipt, user=None):
        """Auto-create StockMove drafts for lines requiring transfers."""
        from apps.inventory.models import StockMove, StockMoveLine, Warehouse

        transfer_lines = goods_receipt.lines.filter(
            transfer_requirement__in=['TO_STORE', 'TO_WAREHOUSE']
        )

        if not transfer_lines.exists():
            return

        org = goods_receipt.tenant
        source = goods_receipt.warehouse

        for line in transfer_lines:
            # Find destination
            if line.transfer_requirement == 'TO_STORE':
                dest = Warehouse.objects.filter(
                    organization=org,
                    location_type='STORE',
                    is_active=True,
                ).exclude(id=source.id).first()
            else:
                dest = Warehouse.objects.filter(
                    organization=org,
                    location_type='WAREHOUSE',
                    is_active=True,
                ).exclude(id=source.id).first()

            if not dest:
                logger.warning(
                    f"No suitable destination for transfer from {source} "
                    f"(requirement: {line.transfer_requirement})"
                )
                continue

            # Create StockMove
            move = StockMove.objects.create(
                tenant=org,
                from_warehouse=source,
                to_warehouse=dest,
                move_type='TRANSFER',
                status='DRAFT',
                notes=f"Auto-created from Goods Receipt {goods_receipt.receipt_number}",
                requested_by=user,
            )
            StockMoveLine.objects.create(
                tenant=org,
                move=move,
                product=line.product,
                quantity=abs(line.safe_qty_after_receipt) if line.safe_qty_after_receipt < 0 else line.qty_received,
            )

            # Update line status
            line.transfer_requirement = 'REQUEST_CREATED'
            line.save(update_fields=['transfer_requirement'])

            logger.info(
                f"Created transfer request {move.ref_code or move.id} "
                f"for {line.product} from {source} → {dest}"
            )
