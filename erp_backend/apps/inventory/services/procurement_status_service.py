"""
Procurement Status Service
===========================
System-wide product procurement lifecycle status.

Computes the current procurement status for a batch of products by querying:
  1. OperationalRequest (purchase/transfer/adjustment requests)
  2. PurchaseOrderLine (active PO lifecycle)

PO status always overrides request status (higher priority).

Status Chain:
  Available → Requested to Purchase/Transfer → Approved → Pending PO →
  Pending Approval → PO Approved → Ordered → In Transit →
  Partially Received → Received → Available (cycle complete)
  
  Failed (rejected request — lowest priority, overridden by any active PO)
"""
import logging
from django.apps import apps as django_apps

logger = logging.getLogger(__name__)


# ── Priority constants ──
# Higher number = takes precedence
REQUEST_PRIORITY = {
    'REJECTED': 0,       # Failed — lowest
    'PENDING': 1,        # Requested
    'APPROVED': 1,       # Approved request (same level as pending, before PO)
}

PO_STATUS_PRIORITY = {
    'DRAFT': 2,
    'SUBMITTED': 3,
    'APPROVED': 4,
    'REJECTED': 3,
    'SENT': 5,
    'CONFIRMED': 6,
    'IN_TRANSIT': 7,
    'PARTIALLY_RECEIVED': 8,
    'RECEIVED': 9,
}

PO_STATUS_LABELS = {
    'DRAFT': 'Pending PO',
    'SUBMITTED': 'Pending Approval',
    'APPROVED': 'PO Approved',
    'REJECTED': 'PO Rejected',
    'SENT': 'Ordered',
    'CONFIRMED': 'Ordered',
    'IN_TRANSIT': 'In Transit',
    'PARTIALLY_RECEIVED': 'Partially Received',
    'RECEIVED': 'Received',
}

# Request type → user-facing label mapping
REQUEST_LABELS = {
    ('PURCHASE_ORDER', 'PENDING'): 'Requested to Purchase',
    ('PURCHASE_ORDER', 'APPROVED'): 'Approved to Purchase',
    ('STOCK_TRANSFER', 'PENDING'): 'Requested to Transfer',
    ('STOCK_TRANSFER', 'APPROVED'): 'Approved to Transfer',
    ('STOCK_ADJUSTMENT', 'PENDING'): 'Adjustment Pending',
    ('STOCK_ADJUSTMENT', 'APPROVED'): 'Adjustment Approved',
    # Support for ProcurementRequest system
    ('PURCHASE', 'PENDING'): 'Requested to Purchase',
    ('PURCHASE', 'APPROVED'): 'Approved to Purchase',
    ('TRANSFER', 'PENDING'): 'Requested to Transfer',
    ('TRANSFER', 'APPROVED'): 'Approved to Transfer',
}


def get_procurement_status_batch(organization, product_ids):
    """
    Compute procurement status for a batch of product IDs.
    
    Returns:
        dict: {product_id: {status, detail, po_number, qty_ordered, qty_received, priority}}
        Products without active procurement return None (not in dict).
    """
    if not product_ids:
        return {}

    result = {}

    # ── Phase 1: Operational Requests ──
    try:
        OperationalRequestLine = django_apps.get_model('inventory', 'OperationalRequestLine')
        # `request__organization=...` is the actual Django field on
        # TenantOwnedModel. The previous `request__tenant=...` matched a
        # Python @property (TenantOwnedModel.tenant), which Django ORM
        # cannot resolve — it raised FieldError silently swallowed by the
        # surrounding try/except, so this entire phase produced no results.
        # Symptom: products with active OperationalRequests showed em-dash
        # because the request data never reached the pipeline_status
        # serializer.
        # Use `all_objects` (the unfiltered manager) instead of the
        # default tenant-scoped manager — the operational_request_line table
        # in the dev DB is missing the `tenant_id` column the default
        # manager expects (TenantOwnedModel writes db_column='tenant_id'),
        # and the resulting ProgrammingError aborts the surrounding
        # transaction, which then poisons Phase 1b and Phase 2 queries
        # too. We don't need the auto tenant scope on the line because we
        # already filter by request__organization through the FK.
        active_request_lines = OperationalRequestLine.all_objects.filter(
            product_id__in=product_ids,
            request__organization=organization,
            request__status__in=['PENDING', 'APPROVED', 'REJECTED']
        ).select_related('request').order_by('product_id', '-request__created_at')

        seen_pids = set()
        for rl in active_request_lines:
            pid = rl.product_id
            if pid in seen_pids:
                continue  # only latest request per product
            seen_pids.add(pid)

            req = rl.request
            if req.status == 'REJECTED':
                label = 'Failed'
                priority = REQUEST_PRIORITY['REJECTED']
            else:
                key = (req.request_type, req.status)
                label = REQUEST_LABELS.get(key, 'Requested')
                priority = REQUEST_PRIORITY.get(req.status, 1)

            ref = req.reference or f'REQ-{req.id}'
            result[pid] = {
                'status': label,
                'detail': f"{ref} · {int(rl.quantity)} units",
                'po_number': ref,
                'qty_ordered': float(rl.quantity),
                'qty_received': 0,
                'priority': priority,
            }
    except Exception as exc:
        logger.error('Procurement status: failed to query OperationalRequest', exc_info=exc)

    # ── Phase 1b: Procurement Requests (POS module system) ──
    # Earlier this used the ConnectorFacade, but that gates the lookup on
    # OrganizationModule.is_enabled('pos') — when the row didn't exist or
    # wasn't toggled on, the facade returned a fallback (None) and Phase 1b
    # silently produced nothing. Result: products with an active
    # ProcurementRequest showed as "Available" even though the create-PR
    # endpoint, which queries the same model directly, correctly rejected
    # the duplicate. Both callsites need to agree, so query the model
    # directly here too — matches Phase 1's pattern.
    try:
        # Direct import — ProcurementRequest is defined in pos but not
        # re-exported from apps.pos.models.__init__, so django_apps.get_model
        # raises LookupError. Match the create-PR view's import pattern.
        from apps.pos.models.procurement_request_models import ProcurementRequest
        
        if ProcurementRequest:
            active_reqs = ProcurementRequest.objects.filter(
                organization=organization,
                product_id__in=product_ids,
                status__in=['PENDING', 'APPROVED']
            ).order_by('product_id', '-requested_at')

            # Group by product so we can detect "both purchase AND transfer
            # are active" and emit a composite label instead of dropping one.
            by_pid = {}
            for req in active_reqs:
                by_pid.setdefault(req.product_id, []).append(req)

            for pid, reqs in by_pid.items():
                # Skip if Phase 1 (OperationalRequest) already set a higher-
                # or equal-priority status for this product.
                top_status = max(REQUEST_PRIORITY.get(r.status, 1) for r in reqs)
                if pid in result and result[pid]['priority'] >= top_status:
                    continue

                types = {r.request_type for r in reqs}
                latest = reqs[0]  # already ordered by -requested_at
                if 'PURCHASE' in types and 'TRANSFER' in types:
                    label = 'Requested · P+T'
                else:
                    label = REQUEST_LABELS.get((latest.request_type, latest.status), 'Requested')

                result[pid] = {
                    'status': label,
                    'detail': f"Requested · {int(latest.quantity)} units"
                              + (f" · +{len(reqs) - 1}" if len(reqs) > 1 else ''),
                    'po_number': f'REQ-{latest.id}',
                    'qty_ordered': float(latest.quantity),
                    'qty_received': 0,
                    'priority': top_status,
                }
    except Exception as exc:
        logger.error('Procurement status: failed to query ProcurementRequest via connector', exc_info=exc)

    # ── Phase 2: PO Lifecycle (overrides requests) ──
    try:
        PurchaseOrderLine = django_apps.get_model('pos', 'PurchaseOrderLine')
        active_statuses = list(PO_STATUS_PRIORITY.keys())
        active_po_lines = PurchaseOrderLine.objects.filter(
            organization=organization,
            product_id__in=product_ids,
            order__status__in=active_statuses
        ).select_related('order')

        for pol in active_po_lines:
            pid = pol.product_id
            po_status = pol.order.status
            priority = PO_STATUS_PRIORITY.get(po_status, 0)
            existing = result.get(pid)
            if not existing or priority > existing['priority']:
                label = PO_STATUS_LABELS.get(po_status, 'Ordered')
                po_ref = pol.order.po_number or f'PO-{pol.order.id}'
                detail = f"{po_ref} · {int(pol.quantity)} ordered"
                if pol.qty_received > 0:
                    detail += f" · {int(pol.qty_received)} received"
                result[pid] = {
                    'status': label,
                    'detail': detail,
                    'po_number': po_ref,
                    'qty_ordered': float(pol.quantity),
                    'qty_received': float(pol.qty_received),
                    'priority': priority,
                }
        logger.debug('Procurement status: found %d PO line entries for %d products',
                     len(result), len(product_ids))
    except Exception as exc:
        logger.error('Procurement status: failed to query PurchaseOrderLine', exc_info=exc)

    return result


def get_product_display_status(procurement_entry, stock_here, stock_transit, min_stock_level):
    """
    Resolve the final display status for a product.
    
    Args:
        procurement_entry: Entry from get_procurement_status_batch() or None
        stock_here: Local stock level
        stock_transit: Stock in transit
        min_stock_level: Product's min stock level
    
    Returns:
        tuple: (product_status: str, status_detail: str | None)
    """
    if procurement_entry:
        return procurement_entry['status'], procurement_entry.get('detail', '')

    if stock_here == 0 and stock_transit > 0:
        return 'In Transit', f'{int(stock_transit)} in transit'
    elif stock_here == 0:
        return 'Out of Stock', None
    elif stock_here < (min_stock_level or 0):
        return 'Low Stock', None

    return 'Available', None
