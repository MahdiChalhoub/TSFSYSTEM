"""
POS Module Signals
==================
Event-driven signal handlers for:
  - Sales lifecycle and supplier balance updates
  - Order → CRM analytics auto-compute (Gap 8)
  - PO → Inventory stock receipt (Gap 10)
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# ORDER LIFECYCLE
# =============================================================================

@receiver(post_save, sender='pos.Order')
def handle_order_status_change(sender, instance, **kwargs):
    """
    Fires when an Order is saved. Handles lifecycle transitions:
    - SALE + COMPLETED → Update CRM analytics (Gap 8) + supplier balance
    - PURCHASE + COMPLETED → Update supplier balance
    """
    if not instance.pk:
        return

    if instance.type == 'SALE' and instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] Sale #{instance.id} finalized for org {instance.organization_id}")

        # ── Gap 8 Fix: Update CRM Customer Analytics ─────────────────────
        if instance.contact_id:
            try:
                from apps.crm.models import Contact
                from django.utils import timezone
                contact = Contact.objects.get(pk=instance.contact_id)

                # Update analytics fields
                contact.total_orders += 1
                contact.lifetime_value += instance.total_amount

                now = timezone.now()
                if not contact.first_purchase_date:
                    contact.first_purchase_date = now
                contact.last_purchase_date = now

                # Recalculate average
                contact.recalculate_analytics()

                contact.save(update_fields=[
                    'total_orders', 'lifetime_value',
                    'first_purchase_date', 'last_purchase_date',
                    'average_order_value'
                ])
                logger.info(
                    f"[SIGNAL] CRM analytics updated for contact {contact.id}: "
                    f"orders={contact.total_orders}, ltv={contact.lifetime_value}"
                )
            except Exception as e:
                logger.error(f"[SIGNAL] Failed to update CRM analytics: {e}")

    elif instance.type == 'PURCHASE' and instance.status == 'COMPLETED':
        try:
            from apps.finance.payment_models import SupplierBalance
            if instance.contact_id:
                balance, _ = SupplierBalance.objects.get_or_create(
                    organization=instance.organization,
                    contact_id=instance.contact_id,
                    defaults={'current_balance': 0}
                )
                balance.current_balance += instance.total_amount
                balance.last_invoice_date = instance.created_at.date() if instance.created_at else None
                balance.save()
                logger.info(f"[SIGNAL] Supplier balance updated for contact {instance.contact_id}: +{instance.total_amount}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed to update supplier balance: {e}")


# =============================================================================
# RETURNS LIFECYCLE (existing)
# =============================================================================

@receiver(post_save, sender='pos.SalesReturn')
def handle_sales_return_status_change(sender, instance, **kwargs):
    """
    Fires when a SalesReturn status changes.
    - APPROVED → Log credit note creation
    - COMPLETED → Log final settlement
    """
    if instance.status == 'APPROVED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} approved — CreditNote created")
    elif instance.status == 'COMPLETED':
        logger.info(f"[SIGNAL] SalesReturn #{instance.id} completed")


@receiver(post_save, sender='pos.PurchaseReturn')
def handle_purchase_return_status_change(sender, instance, **kwargs):
    """
    Fires when a PurchaseReturn status changes.
    - COMPLETED → Reduce supplier balance
    """
    if instance.status == 'COMPLETED':
        try:
            from apps.finance.payment_models import SupplierBalance
            if instance.supplier_id:
                total_return = sum(
                    line.total_amount for line in instance.lines.all()
                )
                balance, _ = SupplierBalance.objects.get_or_create(
                    organization=instance.organization,
                    contact_id=instance.supplier_id,
                    defaults={'current_balance': 0}
                )
                balance.current_balance -= total_return
                balance.save()
                logger.info(f"[SIGNAL] Supplier balance reduced by {total_return} for purchase return #{instance.id}")
        except Exception as e:
            logger.error(f"[SIGNAL] Failed to update supplier balance on return: {e}")


# =============================================================================
# GAP 10 FIX: PO → Inventory Stock Receipt
# When a PurchaseOrder transitions to RECEIVED/PARTIALLY_RECEIVED,
# create inventory movements to adjust stock quantities
# =============================================================================

@receiver(post_save, sender='pos.PurchaseOrder')
def handle_po_receipt(sender, instance, **kwargs):
    """
    When a PO status transitions to RECEIVED or PARTIALLY_RECEIVED,
    create InventoryMovement records for each received line to update stock.
    Also updates supplier performance metrics on completion.
    """
    if instance.status not in ('RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED'):
        return

    # ── Stock Receipt: Create inventory movements for received lines ──
    if instance.status in ('RECEIVED', 'PARTIALLY_RECEIVED'):
        try:
            from apps.inventory.models import InventoryMovement, Inventory
            from django.utils import timezone

            for line in instance.lines.all():
                if line.qty_received <= 0:
                    continue

                # Check if movement already exists for this PO line
                existing = InventoryMovement.objects.filter(
                    organization=instance.organization,
                    reference=f"PO-{instance.po_number}-L{line.id}"
                ).exists()
                if existing:
                    continue

                # Create incoming stock movement
                InventoryMovement.objects.create(
                    organization=instance.organization,
                    product=line.product,
                    movement_type='IN',
                    quantity=line.qty_received,
                    reference=f"PO-{instance.po_number}-L{line.id}",
                    description=f"Goods received from PO {instance.po_number}",
                    site=instance.delivery_site if hasattr(instance, 'delivery_site') else None,
                )
                logger.info(
                    f"[SIGNAL] Stock movement created: +{line.qty_received} "
                    f"of product {line.product_id} from PO {instance.po_number}"
                )

        except Exception as e:
            logger.error(f"[SIGNAL] Failed to create stock movements for PO {instance.id}: {e}")

    # ── Supplier Performance: Update metrics on PO completion ──
    if instance.status == 'COMPLETED' and instance.supplier_id:
        try:
            from apps.crm.models import Contact
            supplier = Contact.objects.get(pk=instance.supplier_id)

            supplier.supplier_total_orders += 1
            supplier.total_purchase_amount += instance.total_amount

            # Calculate lead time if dates available
            if hasattr(instance, 'order_date') and instance.order_date:
                from django.utils import timezone
                days = (timezone.now().date() - instance.order_date).days
                if supplier.avg_lead_time_days > 0:
                    # Rolling average
                    n = supplier.supplier_total_orders
                    supplier.avg_lead_time_days = (
                        (supplier.avg_lead_time_days * (n - 1) + days) / n
                    )
                else:
                    supplier.avg_lead_time_days = days

            supplier.recalculate_supplier_rating()
            supplier.save(update_fields=[
                'supplier_total_orders', 'total_purchase_amount',
                'avg_lead_time_days', 'overall_rating'
            ])
            logger.info(f"[SIGNAL] Supplier {supplier.id} metrics updated from PO {instance.id}")

        except Exception as e:
            logger.error(f"[SIGNAL] Failed to update supplier metrics: {e}")


# =============================================================================
# PURCHASE ORDER REJECTED / CANCELLED → AUTO-REISSUE PROCUREMENT REQUEST
# =============================================================================

@receiver(post_save, sender='pos.PurchaseOrder')
def auto_reissue_request_on_po_failure(sender, instance, created, **kwargs):
    """When a PurchaseOrder transitions to REJECTED or CANCELLED, find the
    source ProcurementRequest (linked via `source_po`) and auto-create a NEW
    request that carries forward the original product/quantity/priority +
    a note explaining the failure. This lets the requester see what failed
    and decide what to change without losing the request thread.

    Guards against re-issuing for the same PO twice (the new request stores
    `source_po_id=NULL` so we don't recursively trigger).
    """
    if created:
        return
    if instance.status not in ('REJECTED', 'CANCELLED'):
        return

    try:
        from apps.pos.models.procurement_request_models import ProcurementRequest
        from apps.pos.services.procurement_notifications import (
            notify_assignees, create_review_task, update_review_task,
        )

        # Find the originating request (one where source_po points to THIS PO).
        original = ProcurementRequest.objects.filter(source_po=instance).first()
        if original is None:
            return

        # Close the original request's task on the board — the PO it spawned has
        # failed, the operator's attention is moving to the reissue (or to the
        # already-received goods if guard 1 trips below).
        try:
            update_review_task(
                original, event='cancelled', actor=None,
                note=(
                    f"Source PO #{instance.id} {instance.status.lower()} — "
                    f"closing original task; reissue task will follow."
                ),
            )
        except Exception as e:
            logger.warning(f"[SIGNAL] update_review_task close failed for #{original.id}: {e}")

        # GUARD 1 — partial receipt suppresses reissue.
        # If any PO line had goods physically received before the rejection,
        # the original need was at least partially fulfilled. Don't pile a new
        # request on top — the operator can submit a fresh one if the residual
        # quantity matters.
        any_received = any(
            (line.qty_received or 0) > 0
            for line in instance.lines.all()
        )
        if any_received:
            logger.info(
                f"[SIGNAL] PO #{instance.id} {instance.status} but had partial "
                f"receipt — skipping auto-reissue of request #{original.id}"
            )
            return

        # GUARD 2 — avoid double-reissue: if any later request already references
        # this original via notes ("[Reissue of #N]"), bail out.
        marker = f"[Reissue of #{original.id}]"
        already = ProcurementRequest.objects.filter(
            organization=instance.organization,
            product=original.product,
            notes__contains=marker,
        ).exists()
        if already:
            return

        # Parse the structured category from rejection_reason if present.
        # Format written by PurchaseViewSet.reject is `[CATEGORY] free text`.
        rej = (instance.rejection_reason or '').strip()
        category = 'OTHER'
        free_text = rej
        if rej.startswith('['):
            close = rej.find(']')
            if close > 1:
                category = rej[1:close].strip().upper() or 'OTHER'
                free_text = rej[close + 1:].strip()

        # NEEDS_REVISION should never reach here (the reject endpoint reverts
        # the PO to DRAFT instead of REJECTED) but guard defensively anyway.
        if category == 'NEEDS_REVISION':
            return

        category_hints = {
            'PRICE_HIGH':       'Negotiate with the supplier or pick a different one — quoted price was too high.',
            'NO_STOCK':         'Supplier had no stock — try a different supplier or wait for replenishment.',
            'EXPIRY_TOO_SOON':  'Batch expiry was too close to delivery — request a fresher batch.',
            'DAMAGED':          'Goods or packaging arrived damaged — request a replacement or change supplier.',
            'OTHER':            'Adjust supplier / quantity / price and resubmit.',
        }
        hint = category_hints.get(category, category_hints['OTHER'])

        why = (
            "rejected by reviewer" if instance.status == 'REJECTED'
            else "cancelled before fulfilment"
        )
        po_tail = f"\nReviewer note: {free_text}" if free_text else ''
        new_notes = (
            f"{marker}\n"
            f"Previous purchase #{original.id} was promoted to PO #{instance.id} which was {why} ({category}).\n"
            f"{hint}"
            f"{po_tail}"
        )

        new_req = ProcurementRequest.objects.create(
            organization=instance.organization,
            request_type=original.request_type,
            status='PENDING',
            priority=original.priority,
            product=original.product,
            quantity=original.quantity,
            from_warehouse=original.from_warehouse,
            to_warehouse=original.to_warehouse,
            supplier=original.supplier,
            suggested_unit_price=original.suggested_unit_price,
            reason=original.reason,
            notes=new_notes,
            source_po=None,  # Fresh thread; not yet linked to a PO
            requested_by=original.requested_by,
        )
        logger.info(
            f"[SIGNAL] Auto-reissued procurement request #{new_req.id} "
            f"(was #{original.id}) after PO #{instance.id} {instance.status}"
        )

        # Notify assignees + requester so they see the failure context immediately.
        try:
            notify_assignees(
                new_req, kind='created',
                actor=None,
                reason=f"Auto-reissued after PO #{instance.id} {instance.status.lower()}",
                also_requester=True,
            )
        except Exception as e:
            logger.warning(f"[SIGNAL] notify_assignees failed for reissue #{new_req.id}: {e}")

        # Add to the workspace task board so the reissue is followable like any
        # other procurement request. Non-fatal — board write must not roll back
        # the new request.
        try:
            create_review_task(new_req, event='reissued')
        except Exception as e:
            logger.warning(f"[SIGNAL] create_review_task failed for reissue #{new_req.id}: {e}")

    except Exception as e:
        logger.error(f"[SIGNAL] auto_reissue_request_on_po_failure failed for PO {instance.id}: {e}")
