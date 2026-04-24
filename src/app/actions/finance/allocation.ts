'use server'

import { revalidatePath } from 'next/cache'
import { erpFetch } from '@/lib/erp-api'

export type UnallocatedPayment = {
    id: number
    contact_id: number | null
    contact_name: string
    payment_date: string | null
    amount: string
    allocated: string
    unallocated: string
    reference: string
    method: string
}

export type UnpaidInvoice = {
    id: number
    invoice_number: string | null
    contact_id: number | null
    contact_name: string
    issue_date: string | null
    due_date: string | null
    total_amount: string
    paid_amount: string
    balance_due: string
    currency: string
}

export type AllocationSuggestion = {
    payment_id: number
    suggestion: { id?: number; picks?: number[]; covers?: string }
}

export type WorkbenchReport = {
    direction: 'AR' | 'AP'
    unallocated_payments: UnallocatedPayment[]
    unpaid_invoices: UnpaidInvoice[]
    auto_suggestions: AllocationSuggestion[]
    totals: { unallocated_payments: string; unpaid_invoices: string }
}

export async function getAllocationWorkbench(
    direction: 'AR' | 'AP' = 'AR',
    contactId?: number,
): Promise<WorkbenchReport | null> {
    try {
        const q = new URLSearchParams({ direction })
        if (contactId) q.set('contact_id', String(contactId))
        return (await erpFetch(`allocation/workbench/?${q.toString()}`)) as WorkbenchReport
    } catch (e) {
        console.error('Failed to fetch allocation workbench:', e)
        return null
    }
}

export async function allocatePayment(
    paymentId: number,
    allocations: Array<{ invoice_id: number; amount: string }>,
): Promise<
    | { success: true; allocations: Array<Record<string, unknown>>; total: string }
    | { success: false; error: string }
> {
    try {
        const res = await erpFetch('allocation/allocate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_id: paymentId, allocations }),
        }) as { allocations_created: Array<Record<string, unknown>>; total_allocated: string }
        revalidatePath('/finance/payment-allocations')
        return {
            success: true,
            allocations: res.allocations_created,
            total: res.total_allocated,
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { success: false, error: message }
    }
}
