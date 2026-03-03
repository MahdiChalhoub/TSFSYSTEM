'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"


// ── Purchase Order CRUD ──────────────────────────────────────

export async function getPurchaseOrders(status?: string, priority?: string, supplierId?: string, purchaseSubType?: string) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (priority) params.append('priority', priority)
    if (supplierId) params.append('supplier', supplierId)
    if (purchaseSubType) params.append('purchase_sub_type', purchaseSubType)
    const qs = params.toString()
    return await erpFetch(`purchase-orders/${qs ? `?${qs}` : ''}`)
}

export async function getPurchaseOrder(id: number | string) {
    return await erpFetch(`purchase-orders/${id}/`)
}

export async function createPurchaseOrder(data: {
    supplier: number | string
    warehouse?: number | string
    site?: number | string
    priority?: string
    purchase_sub_type?: string
    currency?: string
    expected_date?: string
    notes?: string
    shipping_address?: string
    shipping_method?: string
    payment_terms?: string
}) {
    const result = await erpFetch('purchase-orders/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/purchases')
    return result
}

export async function updatePurchaseOrder(id: number | string, data: Record<string, unknown>) {
    const result = await erpFetch(`purchase-orders/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
    revalidatePath('/purchases')
    return result
}

export async function deletePurchaseOrder(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/`, {
        method: 'DELETE'
    })
    revalidatePath('/purchases')
    return result
}

export async function autoReplenish() {
    const result = await erpFetch('purchase-orders/auto-replenish/', {
        method: 'POST'
    })
    revalidatePath('/purchases')
    return result
}


// ── PO Lifecycle Actions ─────────────────────────────────────

export async function submitPO(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/submit/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}

export async function approvePO(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/approve/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}

export async function rejectPO(id: number | string, reason?: string) {
    const result = await erpFetch(`purchase-orders/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || '' })
    })
    revalidatePath('/purchases')
    return result
}

export async function sendPOToSupplier(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/send-to-supplier/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}

export async function receivePOLine(
    id: number | string,
    lineId: number | string,
    quantity: number,
    discrepancies?: { qty_damaged?: number; qty_rejected?: number; qty_missing?: number; receipt_notes?: string }
) {
    const result = await erpFetch(`purchase-orders/${id}/receive-line/`, {
        method: 'POST',
        body: JSON.stringify({
            line_id: lineId,
            quantity,
            ...(discrepancies || {})
        })
    })
    revalidatePath('/purchases')
    return result
}

export async function cancelPO(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/cancel/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}

export async function markPOInvoiced(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/mark-invoiced/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}

export async function completePO(id: number | string) {
    const result = await erpFetch(`purchase-orders/${id}/complete/`, { method: 'POST' })
    revalidatePath('/purchases')
    return result
}


// ── PO Line Management ───────────────────────────────────────

export async function addPOLine(poId: number | string, lineData: {
    product_id: number | string
    quantity: number
    unit_price: number
    tax_rate?: number
    discount_percent?: number
    description?: string
    warehouse_id?: number | string
    expected_date?: string
}) {
    const result = await erpFetch(`purchase-orders/${poId}/add-line/`, {
        method: 'POST',
        body: JSON.stringify(lineData)
    })
    revalidatePath('/purchases')
    return result
}

export async function removePOLine(poId: number | string, lineId: number | string) {
    const result = await erpFetch(`purchase-orders/${poId}/remove-line/${lineId}/`, {
        method: 'DELETE'
    })
    revalidatePath('/purchases')
    return result
}


// ── PO Dashboard ─────────────────────────────────────────────

export async function getPODashboard() {
    return await erpFetch('purchase-orders/dashboard/')
}
