/**
 * Procurement Status — single source of truth for the lifecycle vocabulary.
 *
 * Every page that displays a "procurement state" must import from here.
 * Previously each page had its own status config (urgency on /purchases/new,
 * request lifecycle on /inventory/requests, procurement lifecycle on
 * /inventory/products) — three different vocabularies for one concept,
 * confusing users.
 *
 * Canonical values come from the backend's `Product.pipeline_status`
 * SerializerMethodField (apps/inventory). That field aggregates linked
 * ProcurementRequest + PurchaseOrder state into a single product-level
 * lifecycle. This module mirrors that vocabulary exactly.
 *
 * Pages must:
 *   - Import `PIPELINE_STATUS_CONFIG` for label + color
 *   - Use `getPipelineStatus(value)` to safely resolve unknown values to NONE
 *   - When showing for a Product: pass `product.pipeline_status`
 *   - When showing for a ProcurementRequest row: pass
 *     `mapRequestStatusToPipeline(request.status)` so the same vocabulary
 *     renders even though the request's internal status enum is different.
 */

/**
 * Canonical product-pipeline vocabulary — the ONLY words a user sees
 * for procurement state, anywhere in the app. Mirrors the physical
 * journey of a product (no financial noise: invoiced/paid live in
 * Finance, the Product chip stops at "Received").
 *
 *   Available  → nothing is happening
 *   Requested  → someone asked for stock (no PO/TO yet)
 *   Approved   → the request was approved (still no PO/TO)
 *   Ordered    → a PO was sent to the supplier
 *   Supplier Confirmed → supplier accepted the PO
 *   In Transit → goods are physically moving (PO IN_TRANSIT or TO IN_TRANSIT)
 *   Partial Receipt → some units have arrived
 *   Received   → all units arrived (cycle done from a stock perspective)
 *   Failed     → request / PO / TO got rejected, cancelled, or aborted
 */
export type PipelineStatus =
    | 'NONE'                     // no active request, PO, or TO
    | 'REQUESTED'                // generic — request pending/approved
    | 'REQUESTED_PURCHASE'       // qualified — purchase request pending/approved
    | 'REQUESTED_TRANSFER'       // qualified — transfer request pending/approved
    | 'REQUESTED_BOTH'           // both purchase AND transfer active
    | 'APPROVED'                 // request/PO approved, no movement yet
    | 'ORDERED'                  // PO sent to supplier
    | 'SUPPLIER_CONFIRMED'       // supplier accepted the PO
    | 'IN_TRANSIT'               // goods moving (PO or TO)
    | 'PARTIALLY_RECEIVED'       // partial arrival
    | 'RECEIVED'                 // fully received (terminal — cycle done)
    | 'FAILED'                   // rejected / cancelled / aborted

    // ── Aliases kept for back-compat with existing call sites ──
    // PO_SENT was renamed → ORDERED. PO_ACCEPTED → SUPPLIER_CONFIRMED.
    // Imports of these still resolve via PIPELINE_STATUS_CONFIG (old keys
    // alias to the new entry), so no caller breaks during the rename.
    | 'PO_SENT'
    | 'PO_ACCEPTED'

export interface ProcurementStatusMeta {
    label: string
    color: string
}

// Permissive `Record<string, ...>` so legacy call sites that index with a
// raw `string` (e.g. `PIPELINE_STATUS_CONFIG[product.pipeline_status]`)
// still type-check. Use `getPipelineStatus()` below for safe lookup with
// fallback.
export const PIPELINE_STATUS_CONFIG: Record<string, ProcurementStatusMeta> = {
    NONE:               { label: 'Available',            color: 'var(--app-success, #22c55e)' },
    REQUESTED:          { label: 'Requested',            color: 'var(--app-warning, #f59e0b)' },
    REQUESTED_PURCHASE: { label: 'Requested · Purchase', color: 'var(--app-warning, #f59e0b)' },
    REQUESTED_TRANSFER: { label: 'Requested · Transfer', color: 'var(--app-warning, #f59e0b)' },
    REQUESTED_BOTH:     { label: 'Requested · P+T',      color: 'var(--app-warning, #f59e0b)' },
    APPROVED:           { label: 'Approved',             color: 'var(--app-info, #3b82f6)' },
    ORDERED:            { label: 'Ordered',              color: 'var(--app-info, #3b82f6)' },
    SUPPLIER_CONFIRMED: { label: 'Supplier Confirmed',   color: 'var(--app-info, #3b82f6)' },
    IN_TRANSIT:         { label: 'In Transit',           color: 'var(--app-accent, #8b5cf6)' },
    PARTIALLY_RECEIVED: { label: 'Partial Receipt',      color: 'var(--app-warning, #f59e0b)' },
    RECEIVED:           { label: 'Received',             color: 'var(--app-success, #22c55e)' },
    FAILED:             { label: 'Failed',               color: 'var(--app-error, #ef4444)' },

    // ── Aliases (legacy keys still used by some callers) ──
    PO_SENT:            { label: 'Ordered',              color: 'var(--app-info, #3b82f6)' },
    PO_ACCEPTED:        { label: 'Supplier Confirmed',   color: 'var(--app-info, #3b82f6)' },
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
const BACKEND_LABEL_TO_ENUM: Record<string, PipelineStatus> = {
    // Procurement Requests
    'Requested to Purchase':  'REQUESTED_PURCHASE',
    'Approved to Purchase':   'APPROVED',
    'Requested to Transfer':  'REQUESTED_TRANSFER',
    'Approved to Transfer':   'APPROVED',
    'Requested · P+T':        'REQUESTED_BOTH',
    'Adjustment Pending':     'REQUESTED',
    'Adjustment Approved':    'APPROVED',
    'Requested':              'REQUESTED',
    'Approved':               'APPROVED',
    // PO lifecycle
    'Pending PO':             'REQUESTED',
    'Pending Approval':       'REQUESTED',
    'PO Approved':            'APPROVED',
    'Ordered':                'ORDERED',
    'Sent':                   'ORDERED',
    'Confirmed':              'SUPPLIER_CONFIRMED',
    'Supplier Confirmed':     'SUPPLIER_CONFIRMED',
    'In Transit':             'IN_TRANSIT',
    'Partially Received':     'PARTIALLY_RECEIVED',
    'Partial Receipt':        'PARTIALLY_RECEIVED',
    // Terminal — physical journey complete
    'Received':               'RECEIVED',
    'Completed':              'RECEIVED',  // PO/TO closure ≡ goods landed
    // Invoice/payment events do NOT change product pipeline (already
    // received once invoice exists). They surface elsewhere in Finance.
    'Invoiced':               'RECEIVED',
    'Paid':                   'RECEIVED',
    'Posted':                 'RECEIVED',
    // Failure terminals
    'Failed':                 'FAILED',
    'Rejected':               'FAILED',
    'PO Rejected':            'FAILED',
    'Cancelled':              'FAILED',
}

/**
 * Translate a Purchase Order's native lifecycle state into the
 * canonical Product/Request pipeline. Use this on the Product detail
 * line breakdown ("3 units PO Sent · 5 units In Transit") and on
 * the Request page when the underlying request was EXECUTED-via-PO.
 *
 * Invoice/Complete states roll up to Received because — from a stock
 * perspective — invoiced means the goods already landed.
 */
const PO_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    DRAFT:               'REQUESTED',
    SUBMITTED:           'REQUESTED',
    APPROVED:            'APPROVED',
    ORDERED:             'ORDERED',
    SENT:                'ORDERED',
    CONFIRMED:           'SUPPLIER_CONFIRMED',
    IN_TRANSIT:          'IN_TRANSIT',
    PARTIALLY_RECEIVED:  'PARTIALLY_RECEIVED',
    RECEIVED:            'RECEIVED',
    INVOICED:            'RECEIVED',  // already received by invoicing time
    PARTIALLY_INVOICED:  'RECEIVED',
    COMPLETED:           'RECEIVED',
    REJECTED:            'FAILED',
    CANCELLED:           'FAILED',
    FAILED:              'FAILED',
}

/** Transfer Order → canonical pipeline. Same idea as the PO mapper. */
const TO_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    DRAFT:               'REQUESTED',
    SUBMITTED:           'REQUESTED',
    APPROVED:            'APPROVED',
    IN_TRANSIT:          'IN_TRANSIT',
    PARTIALLY_RECEIVED:  'PARTIALLY_RECEIVED',
    RECEIVED:            'RECEIVED',
    COMPLETED:           'RECEIVED',
    REJECTED:            'FAILED',
    CANCELLED:           'FAILED',
    FAILED:              'FAILED',
}

/** Procurement Request → canonical pipeline. Pure status (no type
 *  qualifier). Use the type-aware variant below if you need
 *  "Requested · Purchase" vs "Requested · Transfer". */
const REQUEST_STATUS_TO_PIPELINE: Record<string, PipelineStatus> = {
    PENDING:    'REQUESTED',
    APPROVED:   'APPROVED',
    EXECUTED:   'ORDERED',  // PO created — caller may bump to IN_TRANSIT etc.
    REJECTED:   'FAILED',
    CANCELLED:  'FAILED',
    FAILED:     'FAILED',
}

/** Translate a single underlying entity's state into the canonical
 *  pipeline. Pass the entity kind so we pick the right table. */
export function entityStatusToPipeline(
    entity: 'request' | 'po' | 'to' | 'receipt' | 'invoice',
    status: string | null | undefined,
): PipelineStatus {
    if (!status) return 'NONE'
    const s = status.toUpperCase()
    switch (entity) {
        case 'request': return REQUEST_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'po':      return PO_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'to':      return TO_STATUS_TO_PIPELINE[s] || 'NONE'
        case 'receipt':
            // GRN is a thin event: it exists → goods landed.
            if (s === 'POSTED' || s === 'RECEIVED' || s === 'COMPLETED') return 'RECEIVED'
            if (s === 'PARTIALLY_RECEIVED') return 'PARTIALLY_RECEIVED'
            if (s === 'CANCELLED' || s === 'REJECTED' || s === 'FAILED') return 'FAILED'
            return 'IN_TRANSIT'
        case 'invoice':
            // Invoice doesn't move product state — its existence implies
            // the goods landed earlier, so we map all live invoice states
            // (DRAFT/POSTED/PAID) to RECEIVED. Cancelled invoices don't
            // un-receive the goods either; treat as RECEIVED too.
            return 'RECEIVED'
    }
}

/**
 * Safe resolver — accepts either:
 *   - a canonical enum key ('REQUESTED', 'PO_SENT', ...)
 *   - a backend human label ('Requested to Purchase', 'Ordered', ...)
 *   - null / undefined / unknown → NONE fallback
 *
 * Always returns a valid ProcurementStatusMeta.
 */
export function getPipelineStatus(value: string | null | undefined): ProcurementStatusMeta {
    if (!value) return PIPELINE_STATUS_CONFIG.NONE
    // First try direct enum-key match (frontend-only paths use this)
    const direct = PIPELINE_STATUS_CONFIG[value]
    if (direct) return direct
    // Then try backend-label mapping (most API responses go through this)
    const mapped = BACKEND_LABEL_TO_ENUM[value]
    if (mapped) return PIPELINE_STATUS_CONFIG[mapped]
    return PIPELINE_STATUS_CONFIG.NONE
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

export function mapRequestStatusToPipeline(
    requestStatus: ProcurementRequestStatus | string | null | undefined,
): PipelineStatus {
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
