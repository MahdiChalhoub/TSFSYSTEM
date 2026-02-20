'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"


// ── Invoice CRUD ─────────────────────────────────────────────

export async function getInvoices(type?: string, invoiceStatus?: string, contactId?: string, subType?: string) {
    const params = new URLSearchParams()
    if (type) params.append('type', type)
    if (invoiceStatus) params.append('status', invoiceStatus)
    if (contactId) params.append('contact_id', contactId)
    if (subType) params.append('sub_type', subType)
    const qs = params.toString()
    return await erpFetch(`invoices/${qs ? `?${qs}` : ''}`)
}

export async function getInvoice(id: number | string) {
    return await erpFetch(`invoices/${id}/`)
}

export async function createInvoice(data: {
    type: string
    sub_type?: string
    contact: number | string
    issue_date: string
    payment_terms: string
    payment_terms_days?: number
    display_mode?: string
    default_tax_rate?: number
    currency?: string
    exchange_rate?: number
    notes?: string
    internal_notes?: string
    site?: number | string
    lines?: Array<{
        product?: number | string
        description: string
        quantity: number
        unit_price: number
        tax_rate?: number
        discount_percent?: number
    }>
}) {
    const result = await erpFetch('invoices/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/invoices')
    return result
}

export async function updateInvoice(id: number | string, data: Record<string, unknown>) {
    const result = await erpFetch(`invoices/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/invoices')
    return result
}

export async function deleteInvoice(id: number | string) {
    const result = await erpFetch(`invoices/${id}/`, {
        method: 'DELETE'
    })
    revalidatePath('/finance/invoices')
    return result
}


// ── Invoice Lifecycle Actions ────────────────────────────────

export async function sendInvoice(id: number | string) {
    const result = await erpFetch(`invoices/${id}/send_invoice/`, {
        method: 'POST'
    })
    revalidatePath('/finance/invoices')
    return result
}

export async function recordInvoicePayment(id: number | string, data: {
    amount: number
    method?: string
    payment_account_id?: number | string
    description?: string
    reference?: string
}) {
    const result = await erpFetch(`invoices/${id}/record_payment/`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/invoices')
    revalidatePath('/finance/payments')
    return result
}

export async function cancelInvoice(id: number | string) {
    const result = await erpFetch(`invoices/${id}/cancel_invoice/`, {
        method: 'POST'
    })
    revalidatePath('/finance/invoices')
    return result
}

export async function addInvoiceLine(id: number | string, lineData: {
    product?: number | string
    description: string
    quantity: number
    unit_price: number
    tax_rate?: number
    discount_percent?: number
}) {
    const result = await erpFetch(`invoices/${id}/add_line/`, {
        method: 'POST',
        body: JSON.stringify(lineData)
    })
    revalidatePath('/finance/invoices')
    return result
}


// ── Invoice Dashboard ────────────────────────────────────────

export async function getInvoiceDashboard() {
    return await erpFetch('invoices/dashboard/')
}


// ── Invoice Lines (standalone) ───────────────────────────────

export async function getInvoiceLines(invoiceId: number | string) {
    return await erpFetch(`invoice-lines/?invoice_id=${invoiceId}`)
}

export async function deleteInvoiceLine(lineId: number | string) {
    const result = await erpFetch(`invoice-lines/${lineId}/`, {
        method: 'DELETE'
    })
    revalidatePath('/finance/invoices')
    return result
}
