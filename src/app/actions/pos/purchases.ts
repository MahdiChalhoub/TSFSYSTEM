'use server'

import { erpFetch } from '@/lib/erp-api'

// ── Purchase Orders ─────────────────────────────────────────
export async function fetchPurchaseOrders(params?: Record<string, string>) {
    const query = new URLSearchParams(params || {})
    const url = `purchase-orders/${query.toString() ? `?${query.toString()}` : ''}`
    return erpFetch(url)
}

export async function fetchPurchaseOrder(id: number | string) {
    return erpFetch(`purchase-orders/${id}/`)
}

export async function deletePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/`, { method: 'DELETE' })
}

export async function fetchPODashboard() {
    try { return await erpFetch('purchase-orders/dashboard/') } catch { return null }
}

// ── PO Workflow Actions ─────────────────────────────────────
export async function submitPO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/submit/`, { method: 'POST' })
}

export async function approvePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/approve/`, { method: 'POST' })
}

export async function rejectPO(id: number | string, reason?: string) {
    return erpFetch(`purchase-orders/${id}/reject/`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export async function sendToSupplier(id: number | string) {
    return erpFetch(`purchase-orders/${id}/send_to_supplier/`, { method: 'POST' })
}

export async function cancelPO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/cancel/`, { method: 'POST' })
}

export async function recordSupplierDeclaration(id: number | string, data: Record<string, any>) {
    return erpFetch(`purchase-orders/${id}/record_supplier_declaration/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function markInvoiced(id: number | string, data?: Record<string, any>) {
    return erpFetch(`purchase-orders/${id}/mark_invoiced/`, { method: 'POST', body: JSON.stringify(data || {}) })
}

export async function completePO(id: number | string) {
    return erpFetch(`purchase-orders/${id}/complete/`, { method: 'POST' })
}

export async function revertToDraft(id: number | string, reason?: string) {
    return erpFetch(`purchase-orders/${id}/revert_to_draft/`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export async function receivePOLine(poId: number | string, data: Record<string, any>) {
    return erpFetch(`purchase-orders/${poId}/receive_line/`, { method: 'POST', body: JSON.stringify(data) })
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
