'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export interface DeliveryZone {
    id: number
    name: string
    base_fee: string
    estimated_days: number
    is_active: boolean
}

export interface ShippingRate {
    id: number
    zone: number
    zone_name: string
    min_order_value: string
    max_order_value: string | null
    min_weight_kg: string
    max_weight_kg: string | null
    fee: string
    estimated_days: number | null
    is_active: boolean
    sort_order: number
}

export interface ShippingRatePayload {
    zone: number
    min_order_value?: string
    max_order_value?: string | null
    min_weight_kg?: string
    max_weight_kg?: string | null
    fee: string
    estimated_days?: number | null
    is_active?: boolean
    sort_order?: number
}

/** Fetch all delivery zones from the POS module */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
    const res = await erpFetch('pos/delivery-zones/', { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

/** Fetch all shipping rate tiers, optionally filtered by zone */
export async function getShippingRates(zoneId?: number): Promise<ShippingRate[]> {
    const params = zoneId ? `?zone_id=${zoneId}` : ''
    const res = await erpFetch(`client-portal/shipping-rates/${params}`, { method: 'GET' })
    if (!res.ok) return []
    const data = await res.json()
    return data.results ?? data
}

export async function createShippingRate(
    payload: ShippingRatePayload
): Promise<{ ok: boolean; rate?: ShippingRate; error?: string }> {
    const res = await erpFetch('client-portal/shipping-rates/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.detail || JSON.stringify(data) }
    revalidatePath('/ecommerce/shipping')
    return { ok: true, rate: data }
}

export async function updateShippingRate(
    id: number,
    payload: Partial<ShippingRatePayload>
): Promise<{ ok: boolean; error?: string }> {
    const res = await erpFetch(`client-portal/shipping-rates/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.detail || JSON.stringify(data) }
    }
    revalidatePath('/ecommerce/shipping')
    return { ok: true }
}

export async function deleteShippingRate(id: number): Promise<{ ok: boolean }> {
    const res = await erpFetch(`client-portal/shipping-rates/${id}/`, { method: 'DELETE' })
    if (res.ok) revalidatePath('/ecommerce/shipping')
    return { ok: res.ok }
}
