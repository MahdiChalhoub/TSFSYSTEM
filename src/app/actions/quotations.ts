'use server'

import { erpFetch } from '@/lib/erpFetch'

// ─── Quotation CRUD ─────────────────────────────────────────────

export async function getQuotations() {
    return erpFetch('/quotations/')
}

export async function getQuotation(id: number) {
    return erpFetch(`/quotations/${id}/`)
}

export async function createQuotation(data: {
    reference?: string
    contact?: number
    valid_until?: string
    notes?: string
    terms?: string
}) {
    return erpFetch('/quotations/', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateQuotation(id: number, data: Record<string, unknown>) {
    return erpFetch(`/quotations/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteQuotation(id: number) {
    return erpFetch(`/quotations/${id}/`, { method: 'DELETE' })
}

// ─── Line Management ────────────────────────────────────────────

export async function addQuotationLine(quotationId: number, data: {
    product_id: number
    quantity?: number
    unit_price_ttc?: number
    discount?: number
}) {
    return erpFetch(`/quotations/${quotationId}/add-line/`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function removeQuotationLine(quotationId: number, lineId: number) {
    return erpFetch(`/quotations/${quotationId}/remove-line/${lineId}/`, { method: 'DELETE' })
}

// ─── Lifecycle Actions ──────────────────────────────────────────

export async function sendQuotation(id: number) {
    return erpFetch(`/quotations/${id}/send/`, { method: 'POST' })
}

export async function acceptQuotation(id: number) {
    return erpFetch(`/quotations/${id}/accept/`, { method: 'POST' })
}

export async function rejectQuotation(id: number) {
    return erpFetch(`/quotations/${id}/reject/`, { method: 'POST' })
}

export async function convertQuotationToOrder(id: number) {
    return erpFetch(`/quotations/${id}/convert-to-order/`, { method: 'POST' })
}
