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
}

export async function listProcurementRequests(): Promise<ProcurementRequestRecord[]> {
    try {
        const data = await erpFetch('procurement-requests/')
        if (Array.isArray(data)) return data as ProcurementRequestRecord[]
        if (data && Array.isArray(data.results)) return data.results as ProcurementRequestRecord[]
        return []
    } catch (e) {
        console.error('Failed to list procurement requests', e)
        return []
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
