'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// SOURCING ACTIONS (Gap 4 Fix)
// Backend: SourcingViewSet + SupplierPricingViewSet
// =============================================================================

export async function getSourcingRequests(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/sourcing/${query}`)
}

export async function getSourcingRequest(id: string) {
    return await erpFetch(`pos/sourcing/${id}/`)
}

export async function createSourcingRequest(data: Record<string, unknown>) {
    return await erpFetch('pos/sourcing/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateSourcingRequest(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/sourcing/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

// ── Supplier Pricing ────────────────────────────────────────────────────

export async function getSupplierPricings(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/supplier-pricing/${query}`)
}

export async function getSupplierPricing(id: string) {
    return await erpFetch(`pos/supplier-pricing/${id}/`)
}

export async function createSupplierPricing(data: Record<string, unknown>) {
    return await erpFetch('pos/supplier-pricing/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateSupplierPricing(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/supplier-pricing/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

export async function deleteSupplierPricing(id: string) {
    return await erpFetch(`pos/supplier-pricing/${id}/`, {
        method: 'DELETE',
    })
}
