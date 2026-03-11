"""
StockReservationService — Gap 3 (ERP Roadmap)
=============================================
Manages the three-quantity model per product/warehouse:

  on_hand   = from Inventory.quantity (managed by StockService)
  reserved  = sum of active RESERVATION entries in StockLedger
  available = on_hand - reserved

Public API
----------
  reserve(order, warehouse, user)  → called on CONFIRMED
  release(order, warehouse, user)  → called on CANCELLED
  deduct(order, warehouse, user)   → called on DELIVERED (release + on_hand reduction)
  get_stock_summary(product, warehouse, org) → {'on_hand', 'reserved', 'available'}

Design Principles
-----------------
- Uses SELECT FOR UPDATE to prevent race conditions on concurrent orders
- Never raises silently — propagates StockReservationError for insufficient stock
- All writes inside the caller's transaction.atomic() context
"""
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError


class StockReservationError(ValidationError):
    """Raised when stock is insufficient to reserve."""
    pass


class StockReservationService:

    @classmethod
    def reserve(cls, order, warehouse, user=None) -> None:
        """
        Called on confirm_order().
        For each order line: create a RESERVATION ledger entry.
        Raises StockReservationError if any line has insufficient available stock.
        The entire operation is atomic — either all lines reserve or none.
        """
        from apps.inventory.models import Inventory, StockLedger

        with transaction.atomic():
            for line in order.lines.select_related('product').all():
                qty = line.quantity

                # Lock the inventory row to prevent concurrent over-reservation
                inv = (
                    Inventory.objects
                    .select_for_update()
                    .filter(
                        product=line.product,
                        warehouse=warehouse,
                        tenant=order.tenant,
                    )
                    .first()
                )
                on_hand = inv.quantity if inv else Decimal('0')

                # Compute current reserved from StockLedger
                current_reserved = cls._get_reserved(
                    line.product, warehouse, order.organization
                )
                available = on_hand - current_reserved

                if qty > available:
                    raise StockReservationError(
                        f"Insufficient stock for '{line.product.name}': "
                        f"available={available:.3f}, requested={qty:.3f}"
                    )

                # Append reservation entry
                prev = cls._latest_entry(line.product, warehouse, order.organization)
                StockLedger.objects.create(
                    tenant=order.tenant,
                    product=line.product,
                    warehouse=warehouse,
                    order=order,
                    movement_type='RESERVATION',
                    reserved_delta=qty,
                    on_hand_delta=Decimal('0'),
                    running_on_hand=prev['on_hand'],
                    running_reserved=prev['reserved'] + qty,
                    reference=f"WF-RESERVE-{order.id}",
                    note=f"Reservation on order confirm — {line.product.name} × {qty}",
                    created_by=user,
                )

    @classmethod
    def release(cls, order, warehouse, user=None) -> None:
        """
        Called on cancel_order().
        Releases all reservations for lines in this order.
        Safe to call even if no reservation exists (idempotent).
        """
        from apps.inventory.models import StockLedger

        with transaction.atomic():
            for line in order.lines.select_related('product').all():
                # Only release if a reservation exists for this order+product
                reserved_for_order = (
                    StockLedger.objects
                    .filter(
                        tenant=order.tenant,
                        product=line.product,
                        warehouse=warehouse,
                        order=order,
                        movement_type='RESERVATION',
                    )
                    .aggregate(total=models_Sum('reserved_delta'))['total'] or Decimal('0')
                )
                if reserved_for_order <= Decimal('0'):
                    continue

                # Lock the inventory row to serialize StockLedger writes
                from apps.inventory.models import Inventory
                Inventory.objects.select_for_update().filter(
                    product=line.product,
                    warehouse=warehouse,
                    tenant=order.tenant,
                ).first()

                prev = cls._latest_entry(line.product, warehouse, order.organization)
                StockLedger.objects.create(
                    tenant=order.tenant,
                    product=line.product,
                    warehouse=warehouse,
                    order=order,
                    movement_type='RESERVATION_RELEASE',
                    reserved_delta=-reserved_for_order,
                    on_hand_delta=Decimal('0'),
                    running_on_hand=prev['on_hand'],
                    running_reserved=max(Decimal('0'), prev['reserved'] - reserved_for_order),
                    reference=f"WF-RELEASE-{order.id}",
                    note=f"Reservation released on cancel — {line.product.name}",
                    created_by=user,
                )

    @classmethod
    def deduct(cls, order, warehouse, user=None) -> None:
        """
        Called on mark_delivered().
        For each line:
          1. Releases the reservation (reserved_delta = -qty)
          2. Reduces on_hand (on_hand_delta = -qty)
        The actual Inventory.quantity reduction is delegated to StockService
        which already handles this in the POS checkout path.
        """
        from apps.inventory.models import StockLedger

        with transaction.atomic():
            for line in order.lines.select_related('product').all():
                qty = line.quantity

                # Lock the inventory row to serialize StockLedger writes
                from apps.inventory.models import Inventory
                Inventory.objects.select_for_update().filter(
                    product=line.product,
                    warehouse=warehouse,
                    tenant=order.tenant,
                ).first()

                prev = cls._latest_entry(line.product, warehouse, order.organization)

                # How much is currently reserved for THIS order?
                reserved_for_order = (
                    StockLedger.objects
                    .filter(
                        tenant=order.tenant,
                        product=line.product,
                        warehouse=warehouse,
                        order=order,
                        movement_type='RESERVATION',
                    )
                    .aggregate(total=models_Sum('reserved_delta'))['total'] or Decimal('0')
                )
                release_qty = min(qty, reserved_for_order)

                StockLedger.objects.create(
                    tenant=order.tenant,
                    product=line.product,
                    warehouse=warehouse,
                    order=order,
                    movement_type='DELIVERY_DEDUCTION',
                    reserved_delta=-release_qty,
                    on_hand_delta=-qty,
                    running_on_hand=max(Decimal('0'), prev['on_hand'] - qty),
                    running_reserved=max(Decimal('0'), prev['reserved'] - release_qty),
                    reference=f"WF-DELIVER-{order.id}",
                    note=f"Delivery deduction — {line.product.name} × {qty}",
                    created_by=user,
                )

    @classmethod
    def get_stock_summary(cls, product, warehouse, organization) -> dict:
        """
        Returns {'on_hand', 'reserved', 'available'} for a product/warehouse.
        Fast: reads from Inventory + last StockLedger entry.
        """
        from apps.inventory.models import Inventory
        inv = Inventory.objects.filter(
            product=product, warehouse=warehouse, tenant=organization
        ).first()
        on_hand  = inv.quantity if inv else Decimal('0')
        reserved = cls._get_reserved(product, warehouse, organization)
        return {
            'on_hand':   on_hand,
            'reserved':  reserved,
            'available': max(Decimal('0'), on_hand - reserved),
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    @classmethod
    def _get_reserved(cls, product, warehouse, organization) -> Decimal:
        """Sum of all active reservation deltas (can be negative from releases)."""
        from apps.inventory.models import StockLedger
        from django.db.models import Sum
        total = (
            StockLedger.objects
            .filter(tenant=organization, product=product, warehouse=warehouse)
            .aggregate(total=Sum('reserved_delta'))['total']
        )
        return max(Decimal('0'), total or Decimal('0'))

    @classmethod
    def _latest_entry(cls, product, warehouse, organization) -> dict:
        """Returns the running balances from the most recent ledger row."""
        from apps.inventory.models import Inventory, StockLedger
        last = (
            StockLedger.objects
            .filter(tenant=organization, product=product, warehouse=warehouse)
            .order_by('-created_at')
            .first()
        )
        if last:
            return {'on_hand': last.running_on_hand, 'reserved': last.running_reserved}
        # Bootstrap from raw Inventory quantity
        inv = Inventory.objects.filter(
            product=product, warehouse=warehouse, tenant=organization
        ).first()
        return {'on_hand': inv.quantity if inv else Decimal('0'), 'reserved': Decimal('0')}


def models_Sum(field):
    """Lazy import of Django Sum to avoid circular import at module level."""
    from django.db.models import Sum
    return Sum(field)
