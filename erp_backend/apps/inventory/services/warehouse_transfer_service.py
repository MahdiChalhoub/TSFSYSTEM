"""
WarehouseTransferService — Gap 4 (Multi-Warehouse Logic)
=========================================================
Manages the full lifecycle of inter-warehouse stock transfers:

  create_transfer()   → Create DRAFT StockMove + lines
  submit()            → DRAFT → PENDING (validate stock availability)
  dispatch()          → PENDING → IN_TRANSIT (deduct from source warehouse)
  receive()           → IN_TRANSIT → DONE (add to destination warehouse)
  cancel()            → Any open state → CANCELLED (restore source if dispatched)

Stock accounting is done via the existing InventoryService (reduce_stock /
add_stock) and StockLedger for full reservation-aware traceability.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

logger = logging.getLogger('erp.warehouse_transfer')


def _gen_ref(organization) -> str:
    """Generate a gapless TRANSFER-### reference."""
    try:
        from apps.finance.services.base_services import SequenceService
        return SequenceService.get_next_number(organization, 'TRANSFER')
    except Exception:
        import uuid
        return f"TRF-{uuid.uuid4().hex[:8].upper()}"


class WarehouseTransferService:
    """Stateless service — all methods are classmethods."""

    @classmethod
    def create_transfer(
        cls,
        organization,
        from_warehouse,
        to_warehouse,
        lines: list,          # list of {'product_id': int, 'quantity': Decimal}
        move_type: str = 'TRANSFER',
        order=None,
        notes: str = '',
        scheduled_date=None,
        user=None,
    ):
        """
        Create a DRAFT StockMove with one or more product lines.

        Args:
            lines: list of dicts with 'product_id' and 'quantity'.
        Returns:
            StockMove instance (status=DRAFT).
        """
        from apps.inventory.models.stock_move_model import StockMove, StockMoveLine
        from apps.inventory.models import Product

        if from_warehouse.id == to_warehouse.id:
            raise ValidationError("Source and destination warehouses must be different.")
        if not lines:
            raise ValidationError("At least one product line is required.")

        with transaction.atomic():
            ref = _gen_ref(organization)
            move = StockMove.objects.create(
                organization=organization,
                ref_code=ref,
                move_type=move_type,
                status='DRAFT',
                from_warehouse=from_warehouse,
                to_warehouse=to_warehouse,
                order=order,
                notes=notes or '',
                scheduled_date=scheduled_date,
                requested_by=user,
            )

            for line_data in lines:
                product = Product.objects.get(
                    id=line_data['product_id'], organization=organization
                )
                qty = Decimal(str(line_data['quantity']))
                if qty <= Decimal('0'):
                    raise ValidationError(f"Quantity for {product.name} must be positive.")
                StockMoveLine.objects.create(
                    organization=organization,
                    move=move,
                    product=product,
                    quantity=qty,
                    quantity_done=Decimal('0'),
                )

        logger.info(f"[Transfer] Created {ref} ({len(lines)} lines) {from_warehouse} → {to_warehouse}")
        return move

    @classmethod
    def submit(cls, move, user=None):
        """
        DRAFT → PENDING.
        Validates that all products have sufficient available stock at source.
        Raises ValidationError listing all shortfalls.
        """
        from apps.inventory.models import Inventory
        from django.db.models import Sum as _Sum

        if move.status != 'DRAFT':
            raise ValidationError(f"Cannot submit: move is {move.status} (must be DRAFT).")

        shortfalls = []
        for line in move.lines.select_related('product').all():
            available = (
                Inventory.objects.filter(
                    organization=move.organization,
                    product=line.product,
                    warehouse=move.from_warehouse,
                ).aggregate(t=_Sum('quantity'))['t'] or Decimal('0')
            )
            if available < line.quantity:
                shortfalls.append(
                    f"{line.product.name}: need {line.quantity}, available {available}"
                )

        if shortfalls:
            raise ValidationError(
                f"Insufficient stock at {move.from_warehouse.name}: " +
                "; ".join(shortfalls)
            )

        move.status = 'PENDING'
        move.approved_by = user
        move.save(update_fields=['status', 'approved_by'])
        logger.info(f"[Transfer] {move.ref_code} submitted → PENDING")
        return move

    @classmethod
    def dispatch(cls, move, user=None):
        """
        PENDING → IN_TRANSIT.
        Physically deducts stock from source warehouse via StockService.reduce_stock.
        """
        from apps.inventory.services.stock_service import StockService

        if move.status != 'PENDING':
            raise ValidationError(f"Cannot dispatch: move is {move.status} (must be PENDING).")

        with transaction.atomic():
            for line in move.lines.select_related('product').all():
                qty = line.quantity_done if line.quantity_done > 0 else line.quantity
                try:
                    amc = StockService.reduce_stock(
                        organization=move.organization,
                        product=line.product,
                        warehouse=move.from_warehouse,
                        quantity=qty,
                        reference=f"TRF-OUT-{move.ref_code}",
                        user=user,
                    )
                    # Store AMC for COGS accuracy at destination
                    line.unit_cost = amc or Decimal('0')
                    line.quantity_done = qty
                    line.save(update_fields=['unit_cost', 'quantity_done'])
                except Exception as exc:
                    raise ValidationError(
                        f"Failed to deduct {line.product.name} from {move.from_warehouse.name}: {exc}"
                    )

            move.status = 'IN_TRANSIT'
            move.dispatched_at = timezone.now()
            move.save(update_fields=['status', 'dispatched_at'])

        logger.info(f"[Transfer] {move.ref_code} dispatched → IN_TRANSIT")
        return move

    @classmethod
    def receive(cls, move, user=None, quantities: dict = None):
        """
        IN_TRANSIT → DONE.
        Adds stock to destination warehouse via StockService.receive_stock.
        Supports partial receipt via optional `quantities` dict: {product_id: Decimal}.
        """
        from apps.inventory.services.stock_service import StockService

        if move.status != 'IN_TRANSIT':
            raise ValidationError(f"Cannot receive: move is {move.status} (must be IN_TRANSIT).")

        with transaction.atomic():
            for line in move.lines.select_related('product').all():
                qty_to_receive = Decimal('0')
                if quantities and line.product_id in quantities:
                    qty_to_receive = Decimal(str(quantities[line.product_id]))
                else:
                    qty_to_receive = line.quantity_done or line.quantity

                if qty_to_receive <= 0:
                    continue

                try:
                    StockService.receive_stock(
                        organization=move.organization,
                        product=line.product,
                        warehouse=move.to_warehouse,
                        quantity=qty_to_receive,
                        cost_price_ht=line.unit_cost,
                        reference=f"TRF-IN-{move.ref_code}",
                        user=user,
                        skip_finance=True,   # Finance JE handled by SalesAccountingPoster
                    )
                    line.quantity_done = qty_to_receive
                    line.save(update_fields=['quantity_done'])
                except Exception as exc:
                    raise ValidationError(
                        f"Failed to add {line.product.name} to {move.to_warehouse.name}: {exc}"
                    )

            move.status = 'DONE'
            move.received_at = timezone.now()
            move.save(update_fields=['status', 'received_at'])

        logger.info(f"[Transfer] {move.ref_code} received → DONE at {move.to_warehouse}")
        return move

    @classmethod
    def cancel(cls, move, reason: str = '', user=None):
        """Cancel a StockMove. If IN_TRANSIT, restores source warehouse stock."""
        if move.status in ('DONE', 'CANCELLED'):
            raise ValidationError(f"Cannot cancel: move is already {move.status}.")

        with transaction.atomic():
            if move.status == 'IN_TRANSIT':
                # Restore the stock that was deducted at dispatch
                from apps.inventory.services.stock_service import StockService
                for line in move.lines.select_related('product').all():
                    qty_to_restore = line.quantity_done
                    if qty_to_restore > 0:
                        try:
                            StockService.receive_stock(
                                organization=move.organization,
                                product=line.product,
                                warehouse=move.from_warehouse,
                                quantity=qty_to_restore,
                                cost_price_ht=line.unit_cost,
                                reference=f"TRF-CANCEL-{move.ref_code}",
                                user=user,
                                skip_finance=True,
                            )
                        except Exception as exc:
                            logger.error(f"[Transfer] Cancel restore failed for {line.product}: {exc}")

            move.status = 'CANCELLED'
            move.notes = (move.notes or '') + f"\n[CANCELLED: {reason}]"
            move.save(update_fields=['status', 'notes'])

        logger.info(f"[Transfer] {move.ref_code} cancelled. Reason: {reason}")
        return move

    @classmethod
    def get_stock_by_warehouse(cls, organization, product_id: int) -> list:
        """
        Return per-warehouse stock breakdown for a product.
        Useful for the warehouse selector on order confirmation (Gap 4 frontend).
        """
        from apps.inventory.models import Inventory, Warehouse
        from django.db.models import Sum as _Sum

        rows = (
            Inventory.objects.filter(
                organization=organization,
                product_id=product_id,
            )
            .values(
                'warehouse__id', 'warehouse__name',
                'warehouse__code', 'warehouse__location_type',
            )
            .annotate(total_qty=_Sum('quantity'))
            .order_by('-total_qty')
        )

        return [
            {
                'warehouse_id':   r['warehouse__id'],
                'warehouse_name': r['warehouse__name'],
                'warehouse_code': r['warehouse__code'],
                'location_type':  r['warehouse__location_type'],
                'quantity':       float(r['total_qty'] or 0),
            }
            for r in rows
        ]
