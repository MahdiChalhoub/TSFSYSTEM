'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// QUOTATION ACTIONS (Gap 4 Fix)
// Backend: QuotationViewSet
// =============================================================================

export async function getQuotations(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/quotations/${query}`)
}

export async function getQuotation(id: string) {
    return await erpFetch(`pos/quotations/${id}/`)
}

export async function createQuotation(data: Record<string, unknown>) {
    return await erpFetch('pos/quotations/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateQuotation(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/quotations/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

export async function deleteQuotation(id: string) {
    return await erpFetch(`pos/quotations/${id}/`, {
        method: 'DELETE',
    })
}

export async function convertQuotationToOrder(id: string) {
    return await erpFetch(`pos/quotations/${id}/convert/`, {
        method: 'POST',
    })
}
