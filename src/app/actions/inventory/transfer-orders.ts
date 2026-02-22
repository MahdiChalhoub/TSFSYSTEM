'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Stock Transfer Orders ──────────────────────────────────────

export async function getTransferOrders(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return await erpFetch(`inventory/transfer-orders/${query}`)
}

export async function getTransferOrder(id: number) {
    return await erpFetch(`inventory/transfer-orders/${id}/`)
}

export type TransferOrderInput = {
    date: string
    from_warehouse: number
    to_warehouse: number
    driver?: string
    supplier?: number
    reason?: string
    notes?: string
}

export async function createTransferOrder(data: TransferOrderInput) {
    const result = await erpFetch('inventory/transfer-orders/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function addTransferLine(orderId: number, data: {
    product: number
    qty_transferred: number
    from_warehouse?: number
    to_warehouse?: number
    reason?: string
    recovered_amount?: number
}) {
    const result = await erpFetch(`inventory/transfer-orders/${orderId}/add_line/`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function removeTransferLine(orderId: number, lineId: number) {
    await erpFetch(`inventory/transfer-orders/${orderId}/remove_line/${lineId}/`, {
        method: 'DELETE'
    })
    revalidatePath('/inventory/transfer-orders')
}

export async function postTransferOrder(id: number) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/post_order/`, {
        method: 'POST'
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

// ─── Lifecycle Actions ──────────────────────────────────────────

export async function lockTransferOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/lock/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function unlockTransferOrder(id: number, comment: string) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/unlock/`, {
        method: 'POST',
        body: JSON.stringify({ comment })
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function verifyTransferOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/verify/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function approveTransferOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/approve/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function cancelTransferOrder(id: number, comment?: string) {
    const result = await erpFetch(`inventory/transfer-orders/${id}/cancel/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' })
    })
    revalidatePath('/inventory/transfer-orders')
    return result
}

export async function getTransferOrderHistory(id: number) {
    return await erpFetch(`inventory/transfer-orders/${id}/lifecycle_history/`)
}
