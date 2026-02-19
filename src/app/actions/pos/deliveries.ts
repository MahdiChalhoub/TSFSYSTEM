'use server'

import { erpFetch } from "@/lib/erp-api"

// =============================================================================
// DELIVERY ACTIONS (Gap 4 Fix)
// Backend: DeliveryViewSet + DeliveryZoneViewSet
// =============================================================================

export async function getDeliveries(params?: string) {
    const query = params ? `?${params}` : ''
    return await erpFetch(`pos/deliveries/${query}`)
}

export async function getDelivery(id: string) {
    return await erpFetch(`pos/deliveries/${id}/`)
}

export async function createDelivery(data: Record<string, unknown>) {
    return await erpFetch('pos/deliveries/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateDelivery(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/deliveries/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

// ── Delivery Zones ──────────────────────────────────────────────────────

export async function getDeliveryZones() {
    return await erpFetch('pos/delivery-zones/')
}

export async function getDeliveryZone(id: string) {
    return await erpFetch(`pos/delivery-zones/${id}/`)
}

export async function createDeliveryZone(data: Record<string, unknown>) {
    return await erpFetch('pos/delivery-zones/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateDeliveryZone(id: string, data: Record<string, unknown>) {
    return await erpFetch(`pos/delivery-zones/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

export async function deleteDeliveryZone(id: string) {
    return await erpFetch(`pos/delivery-zones/${id}/`, {
        method: 'DELETE',
    })
}
