'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ── Sales Returns ────────────────────────────────────────
export async function getSalesReturns() {
    return await erpFetch('sales-returns/')
}

export async function createSalesReturn(data: {
    original_order_id: number
    reason?: string
    lines: { original_line_id: number; quantity_returned: number }[]
}) {
    const result = await erpFetch('sales-returns/create_return/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/pos/sales-returns')
    return result
}

export async function approveSalesReturn(id: number) {
    const result = await erpFetch(`sales-returns/${id}/approve/`, { method: 'POST' })
    revalidatePath('/pos/sales-returns')
    return result
}

export async function cancelSalesReturn(id: number) {
    const result = await erpFetch(`sales-returns/${id}/cancel/`, { method: 'POST' })
    revalidatePath('/pos/sales-returns')
    return result
}

// ── Credit Notes ─────────────────────────────────────────
export async function getCreditNotes() {
    return await erpFetch('credit-notes/')
}

// ── Purchase Returns ─────────────────────────────────────
export async function getPurchaseReturns() {
    return await erpFetch('purchase-returns/')
}

export async function createPurchaseReturn(data: {
    original_order_id: number
    supplier_id: number
    reason?: string
    lines: { original_line_id: number; quantity_returned: number }[]
}) {
    const result = await erpFetch('purchase-returns/create_return/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/pos/purchase-returns')
    return result
}

export async function completePurchaseReturn(id: number) {
    const result = await erpFetch(`purchase-returns/${id}/complete/`, { method: 'POST' })
    revalidatePath('/pos/purchase-returns')
    return result
}
