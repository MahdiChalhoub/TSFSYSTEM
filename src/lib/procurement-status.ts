/**
 * Procurement Status — single source of truth for the lifecycle vocabulary.
 *
 * Every page that displays a "procurement state" must import from here.
 * Previously each page had its own status config (urgency on /purchases/new,
 * request lifecycle on /inventory/requests, procurement lifecycle on
 * /inventory/products) — three different vocabularies for one concept,
 * confusing users.
 *
 * Canonical values come from the backend's `Product.procurement_status`
 * SerializerMethodField (apps/inventory). That field aggregates linked
 * ProcurementRequest + PurchaseOrder state into a single product-level
 * lifecycle. This module mirrors that vocabulary exactly.
 *
 * Pages must:
 *   - Import `PROCUREMENT_STATUS_CONFIG` for label + color
 *   - Use `getProcurementStatus(value)` to safely resolve unknown values to NONE
 *   - When showing for a Product: pass `product.procurement_status`
 *   - When showing for a ProcurementRequest row: pass
 *     `mapRequestStatusToProcurement(request.status)` so the same vocabulary
 *     renders even though the request's internal status enum is different.
 */

export type ProcurementStatus =
    | 'NONE'         // no active request or PO
    | 'REQUESTED'    // request pending or approved, no PO yet
    | 'PO_SENT'      // PO created and sent to supplier
    | 'PO_ACCEPTED'  // supplier accepted the PO
    | 'IN_TRANSIT'   // goods in transit
    | 'FAILED'       // request rejected/cancelled or PO failed

export interface ProcurementStatusMeta {
    label: string
    color: string
}

// Permissive `Record<string, ...>` so legacy call sites that index with a
// raw `string` (e.g. `PROCUREMENT_STATUS_CONFIG[product.procurement_status]`)
// still type-check. Use `getProcurementStatus()` below for safe lookup with
// fallback.
export const PROCUREMENT_STATUS_CONFIG: Record<string, ProcurementStatusMeta> = {
    NONE:        { label: '—',           color: 'var(--app-success, #22c55e)' },
    REQUESTED:   { label: 'Requested',   color: 'var(--app-warning, #f59e0b)' },
    PO_SENT:     { label: 'PO Sent',     color: 'var(--app-info, #3b82f6)' },
    PO_ACCEPTED: { label: 'PO Accepted', color: 'var(--app-info, #3b82f6)' },
    IN_TRANSIT:  { label: 'In Transit',  color: 'var(--app-accent)' },
    FAILED:      { label: 'Failed',      color: 'var(--app-error, #ef4444)' },
}

/**
 * Backend-label → canonical enum mapping.
 *
 * The Python service `apps/inventory/services/procurement_status_service.py`
 * returns human-friendly strings like "Requested to Purchase" / "Pending PO"
 * / "Ordered" / "In Transit" / "Received" — NOT the enum keys above. We
 * normalize those into our canonical vocabulary so the UI shows consistent
 * labels everywhere. The mapping mirrors the priority chain in the service
 * (request lifecycle → PO lifecycle → received).
 */
const BACKEND_LABEL_TO_ENUM: Record<string, ProcurementStatus> = {
    // Operational / Procurement requests
    'Requested to Purchase':  'REQUESTED',
    'Approved to Purchase':   'REQUESTED',
    'Requested to Transfer':  'REQUESTED',
    'Approved to Transfer':   'REQUESTED',
    'Adjustment Pending':     'REQUESTED',
    'Adjustment Approved':    'REQUESTED',
    'Requested':              'REQUESTED',
    // PO lifecycle
    'Pending PO':             'PO_SENT',
    'Pending Approval':       'PO_SENT',
    'PO Approved':            'PO_ACCEPTED',
    'Ordered':                'PO_SENT',
    'In Transit':             'IN_TRANSIT',
    'Partially Received':     'IN_TRANSIT',
    // Terminal states
    'Received':               'NONE',         // cycle complete — back to baseline
    'Failed':                 'FAILED',
    'PO Rejected':            'FAILED',
}

/**
 * Safe resolver — accepts either:
 *   - a canonical enum key ('REQUESTED', 'PO_SENT', ...)
 *   - a backend human label ('Requested to Purchase', 'Ordered', ...)
 *   - null / undefined / unknown → NONE fallback
 *
 * Always returns a valid ProcurementStatusMeta.
 */
export function getProcurementStatus(value: string | null | undefined): ProcurementStatusMeta {
    if (!value) return PROCUREMENT_STATUS_CONFIG.NONE
    // First try direct enum-key match (frontend-only paths use this)
    const direct = PROCUREMENT_STATUS_CONFIG[value]
    if (direct) return direct
    // Then try backend-label mapping (most API responses go through this)
    const mapped = BACKEND_LABEL_TO_ENUM[value]
    if (mapped) return PROCUREMENT_STATUS_CONFIG[mapped]
    return PROCUREMENT_STATUS_CONFIG.NONE
}

/**
 * Map a ProcurementRequest's internal status enum to the canonical
 * product-level procurement vocabulary. Used by /inventory/requests so each
 * row displays the same status labels as /inventory/products.
 *
 * Internal request lifecycle → product procurement state:
 *   PENDING   → REQUESTED   (waiting for approval)
 *   APPROVED  → REQUESTED   (approved but PO not yet sent)
 *   EXECUTED  → PO_SENT     (request closed because a PO was created)
 *   REJECTED  → FAILED      (request denied; product no longer being procured via this path)
 *   CANCELLED → FAILED      (operator cancelled; same effect)
 */
export type ProcurementRequestStatus =
    | 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED'

export function mapRequestStatusToProcurement(
    requestStatus: ProcurementRequestStatus | string | null | undefined,
): ProcurementStatus {
    switch (requestStatus) {
        case 'PENDING':
        case 'APPROVED':
            return 'REQUESTED'
        case 'EXECUTED':
            return 'PO_SENT'
        case 'REJECTED':
        case 'CANCELLED':
            return 'FAILED'
        default:
            return 'NONE'
    }
}
