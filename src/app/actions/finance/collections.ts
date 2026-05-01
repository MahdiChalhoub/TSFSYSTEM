'use server'

import { revalidatePath } from 'next/cache'
import { erpFetch, handleAuthError } from '@/lib/erp-api'

export type OverdueCustomerRow = {
    contact_id: number
    contact_name: string
    contact_email: string
    contact_phone: string
    credit_limit: string
    payment_terms_days: number
    total_overdue: string
    invoice_count: number
    oldest_days: number
    oldest_invoice_id: number | null
    invoice_ids: number[]
    last_reminder_level: number
    last_reminder_sent_at: string | null
    next_suggested_level: number
    bucket: 'current' | '30_days' | '60_days' | '90_plus'
}

export type OverdueReport = {
    rows: OverdueCustomerRow[]
    summary: {
        customers: number
        total_overdue: string
        buckets: Record<string, number>
    }
}

export type DunningHistoryRow = {
    id: number
    contact_id: number
    contact_name: string
    level: number
    method: string
    status: string
    amount_overdue: string
    oldest_invoice_days: number
    invoices_referenced_count: number
    subject: string
    sent_at: string | null
    sent_by: string | null
}

export async function getOverdueCustomers(): Promise<OverdueReport | null> {
    try {
        return (await erpFetch('collections/overdue-customers/')) as OverdueReport
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to fetch overdue customers:', e)
        return null
    }
}

export async function getDunningHistory(
    contactId?: number,
    limit = 50,
): Promise<DunningHistoryRow[]> {
    try {
        const q = new URLSearchParams({ limit: String(limit) })
        if (contactId) q.set('contact_id', String(contactId))
        return (await erpFetch(`collections/history/?${q.toString()}`)) as DunningHistoryRow[]
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to fetch dunning history:', e)
        return []
    }
}

export type ContactStatement = {
    contact: { id: number; name: string; email: string; phone?: string;
               credit_limit?: string; payment_terms_days?: number }
    period: { start: string; end: string }
    opening_balance: string
    transactions: Array<{
        date: string | null
        type: string
        reference: string
        description: string
        debit: string
        credit: string
        running_balance: string
    }>
    closing_balance: string
    aging: {
        total: string; current: string;
        days_30: string; days_60: string;
        days_90: string; days_90_plus: string;
    }
}

export async function getContactStatement(
    contactId: number,
    opts: { startDate?: string; endDate?: string } = {},
): Promise<ContactStatement | null> {
    try {
        const q = new URLSearchParams({ contact_id: String(contactId) })
        if (opts.startDate) q.set('start_date', opts.startDate)
        if (opts.endDate) q.set('end_date', opts.endDate)
        return (await erpFetch(`statement/contact/?${q.toString()}`)) as ContactStatement
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to fetch contact statement:', e)
        return null
    }
}

export async function sendDunningReminder(
    contactId: number,
    level: number,
    opts: { method?: string; notes?: string; autoBody?: boolean } = {},
): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
        const res = await erpFetch('collections/send-reminder/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact_id: contactId,
                level,
                method: opts.method ?? 'EMAIL',
                notes: opts.notes ?? '',
                auto_body: opts.autoBody ?? true,
            }),
        }) as { id: number }
        revalidatePath('/finance/collections')
        return { success: true, id: res.id }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { success: false, error: message }
    }
}
