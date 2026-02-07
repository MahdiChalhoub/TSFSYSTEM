'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export type FinancialEventInput = {
    eventType: 'PARTNER_CAPITAL_INJECTION' | 'PARTNER_LOAN' | 'PARTNER_WITHDRAWAL' | 'REFUND_RECEIVED'
    amount: number
    date: Date
    reference?: string
    notes?: string
    contactId?: number
    currency?: string
    targetAccountId?: number
}

export async function getFinancialEvents(type?: FinancialEventInput['eventType']) {
    let url = 'financial-events/'
    if (type) url += `?type=${type}`
    return await erpFetch(url)
}

export async function getFinancialEvent(id: number) {
    return await erpFetch(`financial-events/${id}/`)
}

export async function createFinancialEvent(data: FinancialEventInput) {
    try {
        const event = await erpFetch('financial-events/create_event/', {
            method: 'POST',
            body: JSON.stringify({
                event_type: data.eventType,
                amount: data.amount,
                date: data.date,
                reference: data.reference,
                notes: data.notes,
                contact_id: data.contactId,
                currency: data.currency,
                account_id: data.targetAccountId // If provided, backend posts immediately
            })
        })

        revalidatePath('/admin/finance/events')
        return { success: true, eventId: event.id }
    } catch (e: any) {
        console.error("Create Event Failed", e)
        throw e
    }
}

export async function updateFinancialEvent(id: number, data: Partial<FinancialEventInput>) {
    // Current backend might not support update if posted.
    // Assuming backend standard ViewSet update
    try {
        await erpFetch(`financial-events/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({
                amount: data.amount,
                date: data.date,
                reference: data.reference,
                notes: data.notes,
                contact_id: data.contactId
            })
        })
        revalidatePath('/admin/finance/events')
        return { success: true }
    } catch (e) {
        console.error("Update Event Failed", e)
        throw e
    }
}

export async function postFinancialEvent(id: number, financialAccountId: number, ledgerAccountId: number) {
    // ledgerAccountId might be used implicitly by backend rules, or passed if backend requires it.
    // Our backend post_event only takes 'account_id' (financialAccount).
    try {
        await erpFetch(`financial-events/${id}/post_event/`, {
            method: 'POST',
            body: JSON.stringify({
                account_id: financialAccountId
            })
        })
        return { success: true }
    } catch (e) {
        console.error("Post Event Failed", e)
        throw e
    }
}