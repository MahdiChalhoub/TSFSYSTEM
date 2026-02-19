'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// CONSIGNMENT ACTIONS (Gap 4 Fix)
// Backend: ConsignmentSettlementViewSet
// =============================================================================

export async function getConsignmentSettlements(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/consignment-settlements/${query}`)
}

export async function getConsignmentSettlement(id: string) {
    return await erpFetch(`pos/consignment-settlements/${id}/`)
}

export async function createConsignmentSettlement(data: Record<string, unknown>) {
    return await erpFetch('pos/consignment-settlements/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateConsignmentSettlement(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/consignment-settlements/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}
