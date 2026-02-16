'use server'

import { erpFetch } from '@/lib/erpFetch'

// ─── Delivery Zones ─────────────────────────────────────────────

export async function getDeliveryZones() {
    return erpFetch('/delivery-zones/')
}

export async function createDeliveryZone(data: { name: string; base_fee?: number; estimated_days?: number }) {
    return erpFetch('/delivery-zones/', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Delivery Orders ────────────────────────────────────────────

export async function getDeliveries() {
    return erpFetch('/deliveries/')
}

export async function getDelivery(id: number) {
    return erpFetch(`/deliveries/${id}/`)
}

export async function createDelivery(data: {
    order: number
    zone?: number
    recipient_name?: string
    address_line1?: string
    city?: string
    phone?: string
    delivery_fee?: number
    scheduled_date?: string
    notes?: string
}) {
    return erpFetch('/deliveries/', { method: 'POST', body: JSON.stringify(data) })
}

export async function dispatchDelivery(id: number) {
    return erpFetch(`/deliveries/${id}/dispatch/`, { method: 'POST' })
}

export async function deliverDelivery(id: number) {
    return erpFetch(`/deliveries/${id}/deliver/`, { method: 'POST' })
}

export async function failDelivery(id: number, reason?: string) {
    return erpFetch(`/deliveries/${id}/fail/`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export async function cancelDelivery(id: number) {
    return erpFetch(`/deliveries/${id}/cancel/`, { method: 'POST' })
}
