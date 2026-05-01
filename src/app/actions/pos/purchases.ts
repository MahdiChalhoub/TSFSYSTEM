'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'

// ── Purchase Orders ─────────────────────────────────────────

/**
 * Result envelope. Lets callers distinguish "loaded an empty list" from
 * "auth/session/network failure" — without a 500. The previous version
 * threw on auth errors, and because this is a `'use server'` function
 * called from the client, an unhandled throw became a `POST 500` in the
 * browser console (Next.js server-action contract). Wrapping the call
 * here keeps the UI in graceful-failure territory.
 */
export interface FetchResult<T> {
    data: T
    error?: string
    /** Set to true on 401 so the consumer can prompt the user to re-login. */
    auth?: boolean
}

export async function fetchPurchaseOrders(
    params?: Record<string, string>,
): Promise<FetchResult<any[]>> {
    const query = new URLSearchParams(params || {})
    const url = `purchase-orders/${query.toString() ? `?${query.toString()}` : ''}`
    try {
        const data: any = await erpFetch(url)
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        return { data: list }
    } catch (e: any) {
        const msg = e?.message || 'Failed to fetch purchase orders'
        const isAuth = /token|auth|401/i.test(msg) || e?.status === 401
        return { data: [], error: msg, auth: isAuth }
    }
}

export async function fetchPurchaseOrder(id: number | string) {
    return erpFetch(`purchase-orders/${id}/`)
}

/**
 * PATCH a Purchase Order. Used by the `/purchases/new?edit=<id>` flow so
 * the New Order screen can double as an editor for an existing PO
 * (header fields + lines). The backend's `purchase-orders/{id}/` endpoint
 * accepts a partial body — we mirror that here without re-validating
 * shape (the page-level zod schema already did that).
 */
export async function updatePurchaseOrder(
    id: number | string,
    data: Record<string, unknown>,
) {
    return erpFetch(`purchase-orders/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function deletePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/`, { method: 'DELETE' })
}

export async function fetchPODashboard() {
    try { return await erpFetch('purchase-orders/dashboard/') } catch (error) {        handleAuthError(error)
 return null }
}

// ── PO Workflow Actions ─────────────────────────────────────
export async function submitPO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/submit/`, { method: 'POST' })
}

export async function approvePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/approve/`, { method: 'POST' })
}

export type PORejectCategory =
    | 'PRICE_HIGH'
    | 'NO_STOCK'
    | 'EXPIRY_TOO_SOON'
    | 'DAMAGED'
    | 'NEEDS_REVISION'
    | 'OTHER'

export async function rejectPO(
    id: number | string,
    reason?: string,
    category: PORejectCategory = 'OTHER',
) {
    return erpFetch(`purchase-orders/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason, category }),
    })
}

export async function sendToSupplier(id: number | string) {
    return erpFetch(`purchase-orders/${id}/send-to-supplier/`, { method: 'POST' })
}

export async function cancelPO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/cancel/`, { method: 'POST' })
}

export async function recordSupplierDeclaration(id: number | string, data: Record<string, any>) {
    return erpFetch(`purchase-orders/${id}/record-supplier-declaration/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function markInvoiced(id: number | string, data?: Record<string, any>) {
    return erpFetch(`purchase-orders/${id}/mark-invoiced/`, { method: 'POST', body: JSON.stringify(data || {}) })
}

export async function completePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/complete/`, { method: 'POST' })
}

export async function revertToDraft(id: number | string, reason?: string) {
    return erpFetch(`purchase-orders/${id}/revert-to-draft/`, { method: 'POST', body: JSON.stringify({ reason }) })
}

/**
 * Generic status transition. Calls the backend's
 * `purchase-orders/{id}/transition/` action which routes through the
 * model's `transition_to()` validator — honors VALID_TRANSITIONS and
 * sets per-stage timestamps.
 *
 * Use this for transitions that don't have their own dedicated endpoint:
 * CONFIRMED, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED, INVOICED,
 * PARTIALLY_INVOICED. Transitions that DO have a dedicated endpoint
 * (submit, approve, sendToSupplier, reject, cancel, complete,
 * revertToDraft) should keep using their specific helper because the
 * dedicated endpoints carry richer side effects (number promotion,
 * notifications, task creation).
 */
export async function transitionPO(id: number | string, to: string, reason?: string) {
    return erpFetch(`purchase-orders/${id}/transition/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { to, reason } : { to }),
    })
}

export async function receivePOLine(poId: number | string, data: Record<string, any>) {
    return erpFetch(`purchase-orders/${poId}/receive-line/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function addPOLine(poId: number | string, data: Record<string, any>) {
    return erpFetch(`purchase-orders/${poId}/add_line/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function removePOLine(poId: number | string, lineId: number | string) {
    return erpFetch(`purchase-orders/${poId}/remove_line/${lineId}/`, { method: 'DELETE' })
}

export async function printPO(id: number | string) {
    return erpFetch(`purchases/${id}/print/`, { method: 'POST' })
}

// ── Quick Purchase ──────────────────────────────────────────
export async function createQuickPurchase(data: Record<string, any>) {
    return erpFetch('purchases/quick_purchase/', { method: 'POST', body: JSON.stringify(data) })
}

// ── Quotations ──────────────────────────────────────────────
export async function fetchQuotations(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {})
    return erpFetch(`quotations/${query.toString() ? `?${query.toString()}` : ''}`)
}

export async function fetchQuotation(id: number | string) {
    return erpFetch(`quotations/${id}/`)
}

export async function createQuotation(data: Record<string, any>) {
    return erpFetch('quotations/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateQuotation(id: number | string, data: Record<string, any>) {
    return erpFetch(`quotations/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Consignment Settlements ─────────────────────────────────
export async function fetchConsignments(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {})
    return erpFetch(`consignment-settlements/${query.toString() ? `?${query.toString()}` : ''}`)
}

export async function fetchConsignment(id: number | string) {
    return erpFetch(`consignment-settlements/${id}/`)
}

// ── Credit Notes ────────────────────────────────────────────
export async function fetchCreditNotes(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {})
    return erpFetch(`credit-notes/${query.toString() ? `?${query.toString()}` : ''}`)
}

export async function fetchCreditNote(id: number | string) {
    return erpFetch(`credit-notes/${id}/`)
}

// ── Sourcing ────────────────────────────────────────────────
export async function fetchProductSuppliers(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {})
    return erpFetch(`product-suppliers/${query.toString() ? `?${query.toString()}` : ''}`)
}

export async function fetchSupplierPriceHistory(supplierId: number | string) {
    return erpFetch(`supplier-price-history/?supplier=${supplierId}`)
}
