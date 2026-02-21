'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getOrders(filters?: {
    type?: string
    status?: string
    search?: string
    contact_id?: number | string
}) {
    const params = new URLSearchParams()
    if (filters?.type) params.append('type', filters.type)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.contact_id) params.append('contact', String(filters.contact_id))

    const qs = params.toString()
    return await erpFetch(`orders/${qs ? `?${qs}` : ''}`)
}

export async function getOrder(id: number | string) {
    return await erpFetch(`orders/${id}/`)
}

// ─── Lifecycle Actions ──────────────────────────────────────────

export async function lockOrder(id: number | string, comment?: string) {
    const result = await erpFetch(`orders/${id}/lock/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/sales/history')
    return result
}

export async function unlockOrder(id: number | string, comment: string) {
    const result = await erpFetch(`orders/${id}/unlock/`, {
        method: 'POST',
        body: JSON.stringify({ comment })
    })
    revalidatePath('/sales/history')
    return result
}

export async function verifyOrder(id: number | string, comment?: string) {
    const result = await erpFetch(`orders/${id}/verify/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/sales/history')
    return result
}

export async function confirmOrder(id: number | string, comment?: string) {
    const result = await erpFetch(`orders/${id}/confirm/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/sales/history')
    return result
}

export async function getOrderHistory(id: number | string) {
    return await erpFetch(`orders/${id}/lifecycle_history/`)
}
