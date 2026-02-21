'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// PURCHASE RETURN ACTIONS (Gap 4 Fix)
// Backend: PurchaseReturnViewSet
// =============================================================================

export async function getPurchaseReturns(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/purchase-returns/${query}`)
}

export async function getPurchaseReturn(id: string) {
    return await erpFetch(`pos/purchase-returns/${id}/`)
}

export async function createPurchaseReturn(data: Record<string, unknown>) {
    return await erpFetch('pos/purchase-returns/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updatePurchaseReturn(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/purchase-returns/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}
