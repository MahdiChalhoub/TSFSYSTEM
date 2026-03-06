'use server'

import { erpFetch } from '@/lib/erp-api'

export type GoodsReceiptLine = {
    id: number
    product: number
    product_name: string
    product_barcode: string
    product_sku: string
    po_line: number | null
    qty_ordered: number
    qty_received: number
    qty_rejected: number
    expiry_date: string | null
    batch_number: string
    line_status: string
    rejection_reason: string
    rejection_notes: string
    is_unexpected: boolean
    approval_status: string
    transfer_requirement: string
    // Decision engine
    stock_on_location: number
    total_stock: number
    avg_daily_sales: number
    remaining_shelf_life_days: number | null
    safe_qty: number
    safe_qty_after_receipt: number
    receipt_coverage_pct: number
    sales_performance_score: number
    adjustment_risk_score: number
    recommended_action: string | null
    decision_warnings: string[]
    evidence_attachment: string | null
    processed_by: number | null
    processed_at: string | null
    created_at: string
}

export type GoodsReceipt = {
    id: number
    receipt_number: string
    mode: 'DIRECT' | 'PO_BASED'
    status: string
    purchase_order: number | null
    po_number: string | null
    warehouse: number
    warehouse_name: string
    supplier: number | null
    supplier_name: string | null
    received_by: number | null
    supplier_ref: string
    notes: string
    started_at: string | null
    completed_at: string | null
    created_at: string
    updated_at: string
    lines: GoodsReceiptLine[]
    line_count: number
}

// ── Session management ──

export async function startReceivingSession(data: {
    mode: 'DIRECT' | 'PO_BASED'
    warehouse_id: number
    purchase_order_id?: number | null
    supplier_id?: number | null
    supplier_ref?: string
    notes?: string
}): Promise<GoodsReceipt> {
    return await erpFetch('inventory/goods-receipts/start-session/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function getReceivingSession(id: number): Promise<GoodsReceipt> {
    return await erpFetch(`inventory/goods-receipts/${id}/`)
}

export async function listReceivingSessions(status?: string): Promise<GoodsReceipt[]> {
    const url = status ? `inventory/goods-receipts/?status=${status}` : 'inventory/goods-receipts/'
    const data = await erpFetch(url)
    return Array.isArray(data) ? data : (data?.results ?? [])
}

// ── Line operations ──

export async function addReceivingLine(sessionId: number, data: {
    product_id: number
    qty_received?: number
    qty_rejected?: number
    expiry_date?: string | null
    batch_number?: string
    po_line_id?: number | null
}): Promise<GoodsReceiptLine> {
    return await erpFetch(`inventory/goods-receipts/${sessionId}/add-line/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function receiveLine(sessionId: number, data: {
    line_id: number
    qty_received: number
    expiry_date?: string | null
    batch_number?: string
}): Promise<GoodsReceiptLine> {
    return await erpFetch(`inventory/goods-receipts/${sessionId}/receive-line/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function rejectLine(sessionId: number, data: {
    line_id: number
    qty_rejected: number
    rejection_reason: string
    rejection_notes?: string
    evidence_attachment?: string
}): Promise<GoodsReceiptLine> {
    return await erpFetch(`inventory/goods-receipts/${sessionId}/reject-line/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}

export async function finalizeReceiving(sessionId: number): Promise<GoodsReceipt> {
    return await erpFetch(`inventory/goods-receipts/${sessionId}/finalize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
}

export async function getDecisionPreview(sessionId: number, data: {
    product_id: number
    qty_received?: number
    expiry_date?: string | null
}): Promise<Record<string, any>> {
    return await erpFetch(`inventory/goods-receipts/${sessionId}/decision-preview/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}
