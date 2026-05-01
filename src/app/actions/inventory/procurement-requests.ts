'use server'

import { revalidatePath } from 'next/cache'
import { erpFetch } from '@/lib/erp-api'

export type ProcurementRequestType = 'PURCHASE' | 'TRANSFER'
export type ProcurementRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'CANCELLED'
export type ProcurementRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface ProcurementRequestRecord {
    id: number
    request_type: ProcurementRequestType
    status: ProcurementRequestStatus
    priority: ProcurementRequestPriority
    product: number
    product_name: string | null
    product_sku: string | null
    quantity: string
    from_warehouse: number | null
    from_warehouse_name: string | null
    to_warehouse: number | null
    to_warehouse_name: string | null
    supplier: number | null
    supplier_name: string | null
    suggested_unit_price: string | null
    reason: string | null
    notes: string | null
    requested_by: number | null
    requested_by_name: string | null
    reviewed_by: number | null
    reviewed_by_name: string | null
    requested_at: string
    reviewed_at: string | null
    last_bumped_at: string | null
    bump_count: number
    source_po: number | null
}

/**
 * Result envelope so callers can distinguish "empty" from "failed".
 * The previous version returned `[]` in both cases — when an auth error,
 * tenant-context miss, or backend 500 fired, the page rendered the
 * "No requests yet — go create some" empty state, hiding the real failure.
 */
export interface ListResult {
    data: ProcurementRequestRecord[]
    error?: string
    /** Total count from the paginated response, if available. */
    total?: number
}

export async function listProcurementRequests(): Promise<ListResult> {
    try {
        const data = await erpFetch('procurement-requests/', { cache: 'no-store' })
        if (Array.isArray(data)) {
            return { data: data as ProcurementRequestRecord[], total: data.length }
        }
        if (data && Array.isArray(data.results)) {
            return {
                data: data.results as ProcurementRequestRecord[],
                total: typeof data.count === 'number' ? data.count : data.results.length,
            }
        }
        return { data: [], total: 0 }
    } catch (e: any) {
        const msg = e?.message || 'Failed to load requests'
        console.error('Failed to list procurement requests', e)
        return { data: [], error: msg }
    }
}

async function lifecycleAction(id: number, verb: 'approve' | 'reject' | 'execute' | 'cancel', body?: Record<string, unknown>) {
    try {
        const result = await erpFetch(`procurement-requests/${id}/${verb}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
        })
        revalidatePath('/inventory/requests')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Action failed' }
    }
}

export async function approveProcurementRequest(id: number) { return lifecycleAction(id, 'approve') }
export async function rejectProcurementRequest(id: number, reason?: string) { return lifecycleAction(id, 'reject', reason ? { reason } : undefined) }
export async function executeProcurementRequest(id: number) { return lifecycleAction(id, 'execute') }
export async function cancelProcurementRequest(id: number) { return lifecycleAction(id, 'cancel') }

export async function convertProcurementRequestToPO(id: number): Promise<{ success: boolean; po_id?: number; po_url?: string; message?: string }> {
    try {
        const result = await erpFetch(`procurement-requests/${id}/convert-to-po/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })
        revalidatePath('/inventory/requests')
        return { success: true, po_id: result?.po_id, po_url: result?.po_url }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to convert to PO' }
    }
}

export async function bumpProcurementRequest(args: { requestId?: number; productId?: number }): Promise<{ success: boolean; previous_priority?: string; new_priority?: string; message?: string; po_hint?: string }> {
    const body: Record<string, unknown> = {}
    if (args.requestId != null) body.request_id = args.requestId
    if (args.productId != null) body.product_id = args.productId
    try {
        const result = await erpFetch(`procurement-requests/bump/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        revalidatePath('/inventory/requests')
        revalidatePath('/inventory/products')
        return {
            success: true,
            previous_priority: result?.previous_priority,
            new_priority: result?.new_priority,
            message: result?.detail,
            po_hint: result?.po_hint || undefined,
        }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to bump request' }
    }
}
