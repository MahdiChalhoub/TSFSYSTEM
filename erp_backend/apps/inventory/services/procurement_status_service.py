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
import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from django.apps import apps as django_apps
from django.core.cache import cache
from django.db import transaction, connections

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


def _phase1_op_request_lines(organization, product_ids):
    """Active OperationalRequest lines per product.

    Returns: dict[product_id -> entry]. Empty on query failure (logged).

    Resilience: wrapped in its own savepoint so a schema-drift failure
    (e.g. missing `operational_request_line.tenant_id`) only rolls back
    this phase, leaving 1b and 2 to still produce results.
    """
    out: dict = {}
    try:
        with transaction.atomic(savepoint=True):
            OperationalRequestLine = django_apps.get_model('inventory', 'OperationalRequestLine')
            # Use `all_objects` (the unfiltered manager): the dev DB's
            # operational_request_line is missing `tenant_id`, and the
            # default tenant-scoped manager raises ProgrammingError there.
            # We already filter by request__organization through the FK.
            active_lines = OperationalRequestLine.all_objects.filter(
                product_id__in=product_ids,
                request__organization=organization,
                request__status__in=['PENDING', 'APPROVED', 'REJECTED']
            ).select_related('request').order_by('product_id', '-request__created_at')

            seen_pids: set = set()
            for rl in active_lines:
                pid = rl.product_id
                if pid in seen_pids:
                    continue  # only latest per product
                seen_pids.add(pid)
                req = rl.request
                if req.status == 'REJECTED':
                    label = 'Failed'
                    priority = REQUEST_PRIORITY['REJECTED']
                else:
                    label = REQUEST_LABELS.get((req.request_type, req.status), 'Requested')
                    priority = REQUEST_PRIORITY.get(req.status, 1)
                ref = req.reference or f'REQ-{req.id}'
                out[pid] = {
                    'status': label,
                    'detail': f"{ref} · {int(rl.quantity)} units",
                    'po_number': ref,
                    'qty_ordered': float(rl.quantity),
                    'qty_received': 0,
                    'priority': priority,
                }
    except Exception as exc:
        logger.error('Procurement status: phase1 failed', exc_info=exc)
    return out


def _phase1b_procurement_requests(organization, product_ids):
    """Active ProcurementRequest rows per product, with composite P+T label.

    Returns: dict[product_id -> entry]. Empty on failure.
    """
    out: dict = {}
    try:
        with transaction.atomic(savepoint=True):
            # Direct import — ProcurementRequest is defined in pos but not
            # re-exported from apps.pos.models.__init__, so
            # django_apps.get_model raises LookupError otherwise.
            from apps.pos.models.procurement_request_models import ProcurementRequest

            if not ProcurementRequest:
                return out

            active = ProcurementRequest.objects.filter(
                organization=organization,
                product_id__in=product_ids,
                status__in=['PENDING', 'APPROVED'],
                is_recovered=False,
            ).order_by('product_id', '-requested_at')

            by_pid: dict = {}
            for req in active:
                by_pid.setdefault(req.product_id, []).append(req)

            for pid, reqs in by_pid.items():
                top = max(REQUEST_PRIORITY.get(r.status, 1) for r in reqs)
                types = {r.request_type for r in reqs}
                latest = reqs[0]
                if 'PURCHASE' in types and 'TRANSFER' in types:
                    label = 'Requested · P+T'
                else:
                    label = REQUEST_LABELS.get((latest.request_type, latest.status), 'Requested')
                out[pid] = {
                    'status': label,
                    'detail': f"Requested · {int(latest.quantity)} units"
                              + (f" · +{len(reqs) - 1}" if len(reqs) > 1 else ''),
                    'po_number': f'REQ-{latest.id}',
                    'qty_ordered': float(latest.quantity),
                    'qty_received': 0,
                    'priority': top,
                }
    except Exception as exc:
        logger.error('Procurement status: phase1b failed', exc_info=exc)
    return out


def _phase2_po_lines(organization, product_ids):
    """Active PurchaseOrder lines per product. Highest-priority PO wins.

    Returns: dict[product_id -> entry]. Empty on failure.
    """
    out: dict = {}
    try:
        with transaction.atomic(savepoint=True):
            PurchaseOrderLine = django_apps.get_model('pos', 'PurchaseOrderLine')
            active_statuses = list(PO_STATUS_PRIORITY.keys())
            lines = PurchaseOrderLine.objects.filter(
                organization=organization,
                product_id__in=product_ids,
                order__status__in=active_statuses
            ).select_related('order')

            for pol in lines:
                pid = pol.product_id
                po_status = pol.order.status
                priority = PO_STATUS_PRIORITY.get(po_status, 0)
                existing = out.get(pid)
                if existing and priority <= existing['priority']:
                    continue
                po_ref = pol.order.po_number or f'PO-{pol.order.id}'
                detail = f"{po_ref} · {int(pol.quantity)} ordered"
                if pol.qty_received > 0:
                    detail += f" · {int(pol.qty_received)} received"
                out[pid] = {
                    'status': PO_STATUS_LABELS.get(po_status, 'Ordered'),
                    'detail': detail,
                    'po_number': po_ref,
                    'qty_ordered': float(pol.quantity),
                    'qty_received': float(pol.qty_received),
                    'priority': priority,
                }
    except Exception as exc:
        logger.error('Procurement status: phase2 failed', exc_info=exc)
    return out


def _run_in_thread(fn, organization, product_ids):
    """Worker wrapper.

    Each phase runs on its own DB connection because Django's
    `connections['default']` is thread-local — first ORM call in a fresh
    thread allocates a new connection. We close it explicitly when the
    phase returns so connections don't accumulate (the executor keeps
    workers alive across calls, so a leak here would compound).
    """
    try:
        return fn(organization, product_ids)
    finally:
        connections.close_all()


# Module-level executor — created once per Python process and reused
# across requests. Avoids the ~50ms startup cost of `with
# ThreadPoolExecutor()` per call. Three workers (one per phase) is the
# steady-state need; concurrent requests serialize at the pool, but the
# phases of a SINGLE request still run in parallel which is the win.
_PHASE_EXECUTOR = ThreadPoolExecutor(max_workers=3, thread_name_prefix='procstat')


# Cache TTL for the procurement-status batch. Short enough that PR/PO state
# changes propagate quickly to the chip ("Available" → "Requested") without
# requiring explicit invalidation; long enough to absorb a burst of concurrent
# requests on the same product set (the typical pattern: a user pages through
# the products list, scope-toggles, opens a side panel — each render hits this
# function with the same tenant + product page).
_PROCUREMENT_CACHE_TTL_SEC = 30


def _cache_key_for(organization_id, pids):
    """Deterministic cache key for (org, product_id set).

    `hash()` of a tuple is salted per-process (PYTHONHASHSEED), so different
    gunicorn workers would compute different keys for the same input —
    defeating cross-worker cache sharing. md5 of the canonical comma-joined
    id list is process-stable.
    """
    digest = hashlib.md5(','.join(map(str, pids)).encode('ascii')).hexdigest()
    return f'procstat:{organization_id}:{digest}'


def get_procurement_status_batch(organization, product_ids):
    """
    Compute procurement status for a batch of product IDs.

    Runs the three phases (OperationalRequest, ProcurementRequest, PO)
    in parallel on separate DB connections, then merges by priority. The
    serialized version was 3× ~10ms = ~30ms; parallel cuts it to
    ~max(q1,q2,q3) ≈ ~12ms.

    Result is cached in Redis for `_PROCUREMENT_CACHE_TTL_SEC` so repeated
    calls with the same tenant + product set (e.g. user paging through the
    list, scope-toggling, scrolling) skip the DB round-trip entirely.

    Returns:
        dict: {product_id: {status, detail, po_number, qty_ordered, qty_received, priority}}
        Products without active procurement return None (not in dict).
    """
    if not product_ids:
        return {}

    # Resolve product_ids once — sort so cache key is order-independent and
    # force a tuple so the threads don't share a mutable reference.
    pids = tuple(sorted(product_ids))

    # Cache lookup. `cache.get` returns None on miss OR on stored None —
    # we never store None (always a dict, possibly empty), so a None
    # return unambiguously means "miss".
    cache_key = _cache_key_for(organization.id, pids)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    ex = _PHASE_EXECUTOR
    f1 = ex.submit(_run_in_thread, _phase1_op_request_lines, organization, pids)
    f1b = ex.submit(_run_in_thread, _phase1b_procurement_requests, organization, pids)
    f2 = ex.submit(_run_in_thread, _phase2_po_lines, organization, pids)
    ph1 = f1.result()
    ph1b = f1b.result()
    ph2 = f2.result()

    # Merge — higher priority wins. Order matters when priorities tie:
    # Phase 1 (OpRequest) first, then 1b (ProcurementRequest), then 2 (PO).
    # That mirrors the original sequential semantics where Phase 1 sets the
    # baseline and 1b only overrides on strictly higher priority.
    result: dict = {}
    for entries in (ph1, ph1b, ph2):
        for pid, entry in entries.items():
            existing = result.get(pid)
            if not existing or entry['priority'] > existing['priority']:
                result[pid] = entry

    logger.debug('Procurement status: %d entries for %d products (parallel)',
                 len(result), len(product_ids))
    # Store the (possibly empty) dict so a tenant with zero active procurement
    # also gets a cache hit on the next call instead of re-firing 3 queries.
    try:
        cache.set(cache_key, result, timeout=_PROCUREMENT_CACHE_TTL_SEC)
    except Exception:  # noqa: BLE001 — cache backend down shouldn't kill the request
        pass
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
