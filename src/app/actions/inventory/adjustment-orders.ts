'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Stock Adjustment Orders ────────────────────────────────────

export async function getAdjustmentOrders(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return await erpFetch(`inventory/adjustment-orders/${query}`)
}

export async function getAdjustmentOrder(id: number) {
    return await erpFetch(`inventory/adjustment-orders/${id}/`)
}

export type AdjustmentOrderInput = {
    date: string
    warehouse: number
    supplier?: number
    reason?: string
    notes?: string
}

export async function createAdjustmentOrder(data: AdjustmentOrderInput) {
    const result = await erpFetch('inventory/adjustment-orders/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

export async function addAdjustmentLine(orderId: number, data: {
    product: number
    qty_adjustment: number
    amount_adjustment?: number
    warehouse?: number
    reason?: string
    recovered_amount?: number
}) {
    const result = await erpFetch(`inventory/adjustment-orders/${orderId}/add_line/`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

export async function removeAdjustmentLine(orderId: number, lineId: number) {
    await erpFetch(`inventory/adjustment-orders/${orderId}/remove_line/${lineId}/`, {
        method: 'DELETE'
    })
    revalidatePath('/inventory/adjustment-orders')
}

export async function postAdjustmentOrder(id: number) {
    const result = await erpFetch(`inventory/adjustment-orders/${id}/post_order/`, {
        method: 'POST'
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

// ─── Lifecycle Actions ──────────────────────────────────────────

export async function lockAdjustmentOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/adjustment-orders/${id}/lock/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

export async function unlockAdjustmentOrder(id: number, comment: string) {
    const result = await erpFetch(`inventory/adjustment-orders/${id}/unlock/`, {
        method: 'POST',
        body: JSON.stringify({ comment })
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

export async function verifyAdjustmentOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/adjustment-orders/${id}/verify/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/adjustment-orders')
    return result
}

export async function getAdjustmentOrderHistory(id: number) {
    return await erpFetch(`inventory/adjustment-orders/${id}/lifecycle_history/`)
}
