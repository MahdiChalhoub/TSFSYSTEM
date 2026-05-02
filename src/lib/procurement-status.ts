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

export const PROCUREMENT_STATUS_CONFIG: Record<ProcurementStatus, ProcurementStatusMeta> = {
    NONE:        { label: '—',           color: 'var(--app-success, #22c55e)' },
    REQUESTED:   { label: 'Requested',   color: 'var(--app-warning, #f59e0b)' },
    PO_SENT:     { label: 'PO Sent',     color: 'var(--app-info, #3b82f6)' },
    PO_ACCEPTED: { label: 'PO Accepted', color: 'var(--app-info, #3b82f6)' },
    IN_TRANSIT:  { label: 'In Transit',  color: 'var(--app-accent)' },
    FAILED:      { label: 'Failed',      color: 'var(--app-error, #ef4444)' },
}

/** Safe resolver — unknown / null / undefined values map to NONE. */
export function getProcurementStatus(value: string | null | undefined): ProcurementStatusMeta {
    if (!value) return PROCUREMENT_STATUS_CONFIG.NONE
    return PROCUREMENT_STATUS_CONFIG[value as ProcurementStatus] ?? PROCUREMENT_STATUS_CONFIG.NONE
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
