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

from erp.connector_registry import connector

ZERO = Decimal('0.00')
ONE = Decimal('1.00')


class GoodsReceiptService:
    """
    Stateless service for goods receipt decision engine and finalization.
    """

    # ── Decision Engine ─────────────────────────────────────────────────────

    # ── Decision Engine ─────────────────────────────────────────────────────

    @staticmethod
    def compute_decision_metrics(product, warehouse, qty_received, expiry_date=None, context_mode='BRANCH'):
        """
        Compute all decision engine metrics for a product at a receiving location.
        Returns a dict of metric values based on 11/10 Enterprise Functional Design.
        """
        from apps.inventory.models import Inventory, InventoryMovement

        org = warehouse.organization

        # ── Stock Positioning ──
        # Current Location stock
        stock_on_location = Inventory.objects.filter(
            product=product, warehouse=warehouse, organization=org
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        # Total Network Stock
        total_stock = Inventory.objects.filter(
            product=product, organization=org
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        # ── Relevant Stock Calculation ──
        # Selection based on context_mode (LOCATION, BRANCH, NETWORK)
        if context_mode == 'LOCATION':
            relevant_stock = stock_on_location
        elif context_mode == 'BRANCH':
            branch = getattr(warehouse, 'branch', warehouse)
            relevant_stock = Inventory.objects.filter(
                product=product, warehouse__branch=branch, organization=org
            ).aggregate(total=Sum('quantity'))['total'] or ZERO
        else: # NETWORK
            relevant_stock = total_stock

        # ── Average Daily Sales (last 90 days) ──
        ninety_days_ago = timezone.now() - timedelta(days=90)
        # We compute this across the organization for broad demand sensing
        total_sold = InventoryMovement.objects.filter(
            product=product,
            organization=org,
            type='OUT',
            created_at__gte=ninety_days_ago,
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        avg_daily_sales = total_sold / Decimal('90')

        # ── Remaining Shelf Life ──
        # Use provided expiry or fall back to typical shelf life from product master
        if expiry_date:
            delta = (expiry_date - date.today()).days
            remaining_shelf_life_days = max(delta, 0)
        else:
            # Fallback to product's typical shelf life (avg_available_expiry_days)
            remaining_shelf_life_days = getattr(product, 'avg_available_expiry_days', 30) or 30

        # ── Sell-Through Safe Qty (Rule A) ──
        # Formula: (max(0, Daily Sales Avg × Remaining Shelf Life Days)) - Current Relevant Stock
        sell_through_safe_qty = (
            Decimal(max(0, float(avg_daily_sales) * float(remaining_shelf_life_days)))
            - relevant_stock
        )
        sell_through_safe_qty = max(sell_through_safe_qty, ZERO)

        qty = Decimal(str(qty_received)) if qty_received else ZERO

        # ── Remaining Safe Capacity (Rule B) ──
        # Formula: Sell-Through Safe Qty - Qty Received
        remaining_safe_capacity = sell_through_safe_qty - qty

        # ── Receipt Safety Ratio % (Rule C) ──
        # Formula: (Qty Received ÷ max(1, Sell-Through Safe Qty)) × 100
        safety_ratio = (qty / max(sell_through_safe_qty, ONE)) * Decimal('100')

        # ── Sales Performance Score (Rule 6A) ──
        # Net Sales Value / Purchased Value (last 180 days)
        one_eighty_days = timezone.now() - timedelta(days=180)
        sales_data = InventoryMovement.objects.filter(
            product=product, organization=org, type='OUT',
            created_at__gte=one_eighty_days,
        ).aggregate(
            total_val=Sum(F('quantity') * F('cost_price_ht'))
        )
        net_sales_val = sales_data['total_val'] or ZERO

        purchased_data = InventoryMovement.objects.filter(
            product=product, organization=org, type='IN',
            created_at__gte=one_eighty_days,
        ).aggregate(
            total_val=Sum(F('quantity') * F('cost_price_ht'))
        )
        purchased_val = purchased_data['total_val'] or ZERO
        
        sales_performance_score = net_sales_val / max(purchased_val, ONE)

        # ── Adjustment Risk Score (Rule 6B) ──
        # Total Absolute Stock Adjustments Value / Total Purchased Value
        adj_data = InventoryMovement.objects.filter(
            product=product, organization=org, type='ADJUSTMENT',
            created_at__gte=one_eighty_days,
        ).aggregate(
            total_abs_qty=Sum(F('quantity')) # Note: Sum of absolute values would be better but requires Func('Abs')
            # For simplicity we'll sum negative adjustments
        )
        
        # We'll use a more precise query for absolute sum
        from django.db.models.functions import Abs
        total_abs_adj_qty = InventoryMovement.objects.filter(
            product=product, organization=org, type='ADJUSTMENT',
            created_at__gte=one_eighty_days,
        ).annotate(abs_qty=Abs('quantity')).aggregate(total=Sum('abs_qty'))['total'] or ZERO

        total_purchased_qty = InventoryMovement.objects.filter(
            product=product, organization=org, type='IN',
            created_at__gte=one_eighty_days,
        ).aggregate(total=Sum('quantity'))['total'] or ZERO

        adjustment_risk_score = total_abs_adj_qty / max(total_purchased_qty, ONE)

        # 6. Elite KPIs: Shelf Pressure & Network Coverage
        display_capacity = getattr(product, 'shelf_display_capacity', Decimal('0.00'))
        shelf_pressure = Decimal('0.00')
        if display_capacity > 0:
            shelf_pressure = (qty_received / display_capacity) * 100

        coverage_days = Decimal('0.00')
        if avg_daily_sales > 0:
            coverage_days = total_stock / avg_daily_sales

        # 7. Predictive Expiry Engine
        predicted_expiry_loss = Decimal('0.00')
        if expiry_date and avg_daily_sales > 0:
            # How much will be left when it expires?
            # loss_qty = Received - (Sales Velocity * Days Remaining)
            potential_sales = avg_daily_sales * Decimal(max(0, remaining_shelf_life_days))
            loss_qty = max(Decimal('0.00'), qty_received - potential_sales)
            predicted_expiry_loss = loss_qty * getattr(product, 'cost_price', Decimal('0.00'))

        # 8. Batch Priority & Supplier Score
        batch_priority = Decimal('0.0000')
        if remaining_shelf_life_days and avg_daily_sales > 0:
            batch_priority = Decimal(remaining_shelf_life_days) / avg_daily_sales

        SupplierPerformanceSnapshot = connector.require('pos.procurement.get_supplier_performance_model', org_id=0, source='inventory')
        if not SupplierPerformanceSnapshot:
            raise ValueError('POS module is required.')
        supplier_score = SupplierPerformanceSnapshot.objects.filter(
            organization=warehouse.organization,
            supplier_id=OuterRef('order__supplier_id') if hasattr(product, 'supplier_id') else None
        ).order_by('-period_end').values_list('score', flat=True).first() or Decimal('100.00')

        return {
            'stock_on_location': stock_on_location,
            'total_stock': total_stock,
            'avg_daily_sales': avg_daily_sales,
            'remaining_shelf_life_days': remaining_shelf_life_days,
            'sell_through_safe_qty': sell_through_safe_qty,
            'remaining_safe_capacity': remaining_safe_capacity,
            'safety_ratio': safety_ratio,
            'sales_performance_score': sales_performance_score,
            'adjustment_risk_score': adjustment_risk_score,
            'shelf_pressure': shelf_pressure,
            'coverage_days': coverage_days,
            'predicted_expiry_loss': predicted_expiry_loss,
            'batch_priority': batch_priority,
            'supplier_score': supplier_score,
        }

    @staticmethod
    def evaluate_rules(line, metrics, warehouse):
        """
        Apply 11/10 Enterprise Decision Rules.
        Returns warnings, status, recommendation and automation triggers.
        """
        warnings = []
        recommended_action = 'Receive normally'
        transfer_requirement = 'NO_TRANSFER'
        target_status = 'RECEIVED_SAFE'

        safe_qty = metrics['sell_through_safe_qty']
        safe_capacity = metrics['remaining_safe_capacity']
        safety_ratio = metrics['safety_ratio']
        remaining_days = metrics.get('remaining_shelf_life_days')
        avg_daily = metrics['avg_daily_sales']
        adj_risk = metrics['adjustment_risk_score']
        perf_score = metrics['sales_performance_score']
        shelf_pressure = metrics['shelf_pressure']
        expiry_loss = metrics['predicted_expiry_loss']

        # ── 1. Safety Ratio & Shelf Pressure Classification ──
        if safety_ratio > 100 or shelf_pressure > 100:
            target_status = 'RECEIVED_RISKY'
            recommended_action = 'Receive with caution — high overstock or shelf pressure'
            if shelf_pressure > 100:
                warnings.append('SHELF_PRESSURE_OVERLOAD')
            if safety_ratio > 100:
                warnings.append('HIGH_EXPOSURE_RISK')
        elif safety_ratio > 80:
            target_status = 'RECEIVED_CAUTION'
            recommended_action = 'Receive but monitor inventory turnover'
            warnings.append('CAUTION_RATIO')

        # ── 2. Expiry, FEFO & Forecast (Rule 3, 5) ──
        if remaining_days is not None:
            if remaining_days < 7: # Less than a week
                target_status = 'RECEIVED_RISKY'
                recommended_action = 'Reject — critical expiry risk'
                warnings.append('CRITICAL_EXPIRY')
            elif expiry_loss > Decimal('100.00'):
                warnings.append('EXPIRY_LOSS_FORECAST')
                recommended_action = f"Caution — Predicted loss: {expiry_loss:.2f}"
        
        # Check for older batch (FEFO violation)
        from apps.inventory.models import Inventory
        product_id = line.product_id if hasattr(line, 'product_id') else line.get('product_id')
        expiry = line.expiry_date if hasattr(line, 'expiry_date') else line.get('expiry_date')
        
        if expiry:
            older_batch = Inventory.objects.filter(
                product_id=product_id,
                warehouse=warehouse,
                expiry_date__lt=expiry,
                quantity__gt=0,
            ).exists()
            if older_batch:
                warnings.append('FEFO_CONFLICT')
                recommended_action = 'Receive and rotate shelf stock (Older batch detected)'
                # Automation would trigger a shelf rotation task

        # ── 3. Overstock & Transfers (Rule 1, 2) ──
        is_store = warehouse.location_type == 'STORE'
        is_warehouse = warehouse.location_type == 'WAREHOUSE'
        
        if is_store and (safe_capacity < 0 or shelf_pressure > 100):
            warnings.append('STORE_OVER_CAPACITY')
            recommended_action = 'Receive but transfer excess to warehouse'
            transfer_requirement = 'TO_WAREHOUSE'
        
        elif is_warehouse and avg_daily > 0 and safe_capacity > 0:
            # Check if store needs replenishment
            store_stock = Inventory.objects.filter(
                product_id=product_id,
                warehouse__location_type='STORE',
                warehouse__tenant=warehouse.organization,
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')
            
            if store_stock < (avg_daily * Decimal('3')): # Less than 3 days
                warnings.append('STORE_REPLENISHMENT_NEEDED')
                recommended_action = 'Receive but transfer urgently to store'
                transfer_requirement = 'TO_STORE'

        # ── 4. Business Health (Rule 6, 7) ──
        if adj_risk > Decimal('0.20'):
            warnings.append('HIGH_ADJUSTMENT_RISK')
            recommended_action = 'Receive and isolate for quarantine verification'
        
        if perf_score < Decimal('0.5') and perf_score > 0:
            warnings.append('WEAK_PERFORMER')
            if target_status == 'RECEIVED_SAFE':
                target_status = 'RECEIVED_CAUTION'

        # ── 5. Unplanned Governance (Rule 4, 9) ──
        is_unexpected = getattr(line, 'is_unexpected', False)
        if is_unexpected:
            target_status = 'NEEDS_APPROVAL'
            warnings.append('UNPLANNED_RECEIPT')
            recommended_action = 'Receive and hold for manager approval'

        return {
            'warnings': warnings,
            'recommended_action': recommended_action,
            'transfer_requirement': transfer_requirement,
            'target_status': target_status,
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

        # Apply identity
        line.product_name = line.product.name
        line.barcode = line.product.barcode

        # Apply metrics to line
        line.stock_on_location = metrics['stock_on_location']
        line.total_stock = metrics['total_stock']
        line.avg_daily_sales = metrics['avg_daily_sales']
        line.remaining_shelf_life_days = metrics['remaining_shelf_life_days']
        line.safe_qty = metrics['sell_through_safe_qty']
        line.safe_qty_after_receipt = metrics['remaining_safe_capacity']
        line.receipt_coverage_pct = metrics['safety_ratio']
        line.sales_performance_score = metrics['sales_performance_score']
        line.adjustment_risk_score = metrics['adjustment_risk_score']
        
        # New Elite Metrics
        line.shelf_pressure = metrics['shelf_pressure']
        line.coverage_days = metrics['coverage_days']
        line.predicted_expiry_loss = metrics['predicted_expiry_loss']
        line.batch_priority_index = metrics['batch_priority']
        line.supplier_reliability_score = metrics['supplier_score']

        # Apply rules
        line.decision_warnings = rules['warnings']
        line.recommended_action = rules['recommended_action']
        line.transfer_requirement = rules['transfer_requirement']
        line.line_status = rules['target_status']

        if 'UNPLANNED_RECEIPT' in rules['warnings']:
            line.approval_status = 'PENDING'
            line.is_unexpected = True

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
        3. Update PO line received quantities (PO_BASED)
        4. Auto-create transfer requests and audit tasks
        5. Update session status
        """
        from apps.inventory.services.stock_service import StockService
        from apps.inventory.models import GoodsReceiptLine

        # Lines starting with RECEIVED_* are considered accepted for stock entry
        # PENDING, REJECTED, NEEDS_APPROVAL, etc. are skipped or handled separately
        lines = goods_receipt.lines.filter(
            line_status__startswith='RECEIVED'
        )

        for line in lines:
            if line.qty_received <= 0:
                continue

            # 1. Stock intake via StockService
            # We use the current effective cost for valuation anchoring
            cost = line.product.get_effective_cost()
            StockService.receive_stock(
                organization=goods_receipt.organization,
                product=line.product,
                warehouse=goods_receipt.warehouse,
                quantity=line.qty_received,
                cost_price_ht=cost,
                reference=f"GR:{goods_receipt.receipt_number}",
                user=user,
                scope='OFFICIAL',
            )

            # 2. Update PO line if PO_BASED
            if goods_receipt.mode == 'PO_BASED' and line.po_line:
                try:
                    line.po_line.receive(line.qty_received)
                except ValidationError as e:
                    logger.warning(f"PO line receive validation error for {line.po_line}: {e}")

            # 3. Finalize line status
            line.processed_by = user
            line.processed_at = timezone.now()
            # If it was safe/caution/risky, it stays that way for history but technically "Closed" for ops
            line.save()

        # Build automation triggers: Transfers and Tasks
        cls._trigger_automation(goods_receipt, user)

        # Update session status
        goods_receipt.check_completeness()
        if goods_receipt.status == 'COMPLETED':
            goods_receipt.status = 'CLOSED'
            goods_receipt.completed_at = timezone.now()
            goods_receipt.save()

        return goods_receipt

    @classmethod
    def _trigger_automation(cls, goods_receipt, user=None):
        """Trigger post-receipt automation: Transfers, Tasks, Notifications."""
        from apps.inventory.models import StockMove, StockMoveLine, Warehouse, GoodsReceiptLine
        
        # 1. Transfers
        transfer_lines = goods_receipt.lines.filter(
            transfer_requirement__in=['TO_STORE', 'TO_WAREHOUSE']
        )
        if transfer_lines.exists():
            cls._create_bulk_transfers(goods_receipt, transfer_lines, user)

        # 2. Operational Tasks (FEFO, Audit, etc.)
        for line in goods_receipt.lines.all():
            if 'FEFO_CONFLICT' in line.decision_warnings:
                cls._create_task(
                    goods_receipt, 
                    f"FEFO Rotation Required: {line.product.name}",
                    f"Newer batch received while older stock exists. Rotate shelf for FEFO compliance.",
                    'URGENT',
                    user
                )
            if line.line_status == 'REJECTED':
                cls._task_reason = line.get_rejection_reason_display()
                cls._create_task(
                    goods_receipt,
                    f"Review Rejected Line: {line.product.name}",
                    f"Reason: {cls._task_reason}. Context: {line.rejection_notes}",
                    'NORMAL',
                    user
                )

        # 3. Auto-draft Purchase Returns for Rejected Items (Mode B)
        if goods_receipt.mode == 'PO_BASED' and goods_receipt.purchase_order:
            rejected_lines = goods_receipt.lines.filter(line_status='REJECTED', qty_rejected__gt=0)
            if rejected_lines.exists():
                cls._create_draft_purchase_returns(goods_receipt, rejected_lines, user)
                cls._create_supplier_claims(goods_receipt, rejected_lines, user)

        # 4. Supplier Intelligence Live Update
        if goods_receipt.supplier:
            cls._update_supplier_performance(goods_receipt)

    @staticmethod
    def _create_supplier_claims(receipt, lines, user):
        """Auto-generate formal SupplierClaims for rejected goods."""
        SupplierClaim = connector.require('pos.procurement.get_supplier_claim_model', org_id=0, source='inventory')
        if not SupplierClaim:
            return
        
        for line in lines:
            claim_type = 'QUALITY'
            if line.rejection_reason == 'DAMAGED': claim_type = 'DAMAGED'
            elif line.rejection_reason == 'EXPIRED': claim_type = 'EXPIRED'
            elif line.rejection_reason == 'WRONG_PRODUCT': claim_type = 'WRONG_PRODUCT'
            
            SupplierClaim.objects.create(                organization=organization,
                supplier=receipt.supplier,
                receipt_line=line,
                claim_type=claim_type,
                status='DRAFT',
                claim_value=line.qty_rejected * line.get_effective_cost(),
                description=f"Auto-generated claim from Goods Receipt {receipt.receipt_number}. Reason: {line.get_rejection_reason_display()}. {line.rejection_notes or ''}",
                evidence_urls=[line.evidence_attachment] if line.evidence_attachment else []
            )

    @staticmethod
    def _update_supplier_performance(receipt):
        """Update live supplier reliability scores based on receipt outcome."""
        SupplierPerformanceSnapshot = connector.require('pos.procurement.get_supplier_performance_model', org_id=0, source='inventory')
        if not SupplierPerformanceSnapshot:
            return
        from django.db.models import Count, Sum
        
        # This is a lightweight live update. Comprehensive scoring usually in background.
        stats = receipt.lines.aggregate(
            total_lines=Count('id'),
            rejected_lines=Count('id', filter=models.Q(line_status='REJECTED')),
            total_qty=Sum('qty_received'),
            rejected_qty=Sum('qty_rejected')
        )
        
        # Simple punch: damage rate impact
        total_q = stats['total_qty'] or Decimal('1')
        rej_q = stats['rejected_qty'] or Decimal('0')
        damage_rate = (rej_q / total_q) * 100
        
        # Update or create current month snapshot
        now = timezone.now().date()
        start = now.replace(day=1)
        
        snap, _ = SupplierPerformanceSnapshot.objects.get_or_create(
            organization=receipt.organization,
            supplier=receipt.supplier,
            period_start=start,
            period_end=now, # Running snapshot
            defaults={'score': Decimal('100.00')}
        )
        
        # Penalize score based on damage rate
        penalty = damage_rate * Decimal('2.0') # Harsh penalty for physical rejections
        snap.score = max(Decimal('0.00'), snap.score - penalty)
        snap.damage_rate = (snap.damage_rate + damage_rate) / 2
        snap.save()

    @staticmethod
    def _create_draft_purchase_returns(receipt, lines, user):
        """Auto-draft a purchase return for rejected items in the session."""
        ReturnsService = connector.require('pos.services.get_returns_service', org_id=0, source='inventory')
        if not ReturnsService:
            return
        
        return_lines = []
        for line in lines:
            if line.po_line_id:
                return_lines.append({
                    'po_line_id': line.po_line_id,
                    'quantity_returned': line.qty_rejected,
                    'reason': f"Rejected during GR {receipt.receipt_number}: {line.get_rejection_reason_display()}. {line.rejection_notes or ''}",
                    'batch_number': line.batch_number or ''
                })
        
        if return_lines:
            try:
                ReturnsService.create_purchase_return_v2(
                    organization=receipt.organization,
                    po_id=receipt.purchase_order_id,
                    return_date=timezone.now().date(),
                    lines=return_lines,
                    reason=f"System-generated from Rejections in Goods Receipt {receipt.receipt_number}",
                    return_type='OTHER',
                    user=user
                )
            except Exception as e:
                # Log but dont crash the finalize process
                logger.error(f"Failed to auto-create PurchaseReturn for GR {receipt.id}: {str(e)}")

    @staticmethod
    def _create_bulk_transfers(receipt, lines, user):
        """Logic to create transfer requests."""
        from apps.inventory.models import StockMove, StockMoveLine, Warehouse
        
        # Group by requirement type
        reqs = {}
        for line in lines:
            req = line.transfer_requirement
            if req not in reqs:
                reqs[req] = []
            reqs[req].append(line)
            
        for req_type, group in reqs.items():
            # Resolve destination warehouse
            dest_wh = None
            if req_type == 'TO_STORE':
                dest_wh = Warehouse.objects.filter(
                    organization=receipt.organization,
                    location_type='STORE',
                    is_active=True
                ).first()
            elif req_type == 'TO_WAREHOUSE':
                # Центральный склад или любой другой склад кроме текущего
                dest_wh = Warehouse.objects.filter(
                    organization=receipt.organization,
                    location_type='WAREHOUSE',
                    is_active=True
                ).exclude(id=receipt.warehouse_id).first()
            
            if not dest_wh:
                continue
                
            # Create StockMove
            move = StockMove.objects.create(                organization=organization,
                from_warehouse=receipt.warehouse,
                to_warehouse=dest_wh,
                move_type='TRANSFER',
                status='PENDING',
                requested_by=user,
                notes=f"Auto-generated from Goods Receipt {receipt.receipt_number}"
            )
            
            # Create Lines and mark as created
            for line in group:
                StockMoveLine.objects.create(                    organization=organization,
                    move=move,
                    product=line.product,
                    quantity=line.qty_received,
                    unit_cost=line.get_effective_cost()
                )
                line.transfer_requirement = 'REQUEST_CREATED'
                line.save(update_fields=['transfer_requirement'])

    @staticmethod
    def _create_task(receipt, title, desc, priority, user):
        """Internal helper to create follow-up tasks in the workspace cockpit."""
        Task = connector.require('workspace.tasks.get_model', org_id=0, source='inventory')
        if not Task:
            return
        try:
            Task.objects.create(                organization=organization,
                title=title,
                description=desc,
                priority=priority,
                status='PENDING',
                source='SYSTEM',
                assigned_by=user,
                related_object_type='GoodsReceipt',
                related_object_id=receipt.id,
                related_object_label=receipt.receipt_number
            )
        except Exception:
            # Workspace module might be optional or DB not ready
            pass
