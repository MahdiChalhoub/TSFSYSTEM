'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Operational Requests ───────────────────────────────────────

export async function getOperationalRequests(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return await erpFetch(`inventory/requests/${query}`)
}

export async function getOperationalRequest(id: number) {
    return await erpFetch(`inventory/requests/${id}/`)
}

export type OperationalRequestInput = {
    request_type: string
    date: string
    priority?: string
    description?: string
    notes?: string
}

export async function createOperationalRequest(data: OperationalRequestInput) {
    const result = await erpFetch('inventory/requests/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/requests')
    return result
}

export async function addRequestLine(requestId: number, data: {
    product: number
    quantity: number
    warehouse?: number
    reason?: string
}) {
    const result = await erpFetch(`inventory/requests/${requestId}/add_line/`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/requests')
    return result
}

export async function approveRequest(id: number) {
    const result = await erpFetch(`inventory/requests/${id}/approve/`, {
        method: 'POST'
    })
    revalidatePath('/inventory/requests')
    return result
}

export async function rejectRequest(id: number, reason: string) {
    const result = await erpFetch(`inventory/requests/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    })
    revalidatePath('/inventory/requests')
    return result
}

export async function convertRequest(id: number, data: {
    warehouse?: number
    from_warehouse?: number
    to_warehouse?: number
}) {
    const result = await erpFetch(`inventory/requests/${id}/convert/`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/requests')
    return result
}
