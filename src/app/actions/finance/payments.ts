'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ── Payments ─────────────────────────────────────────────
export async function getPayments(type?: string, status?: string) {
    const params = new URLSearchParams()
    if (type) params.append('type', type)
    if (status) params.append('status', status)
    const qs = params.toString()
    return await erpFetch(`payments/${qs ? `?${qs}` : ''}`)
}

export async function getPayment(id: number) {
    return await erpFetch(`payments/${id}/`)
}

export async function recordSupplierPayment(data: {
    contact_id: number
    amount: number
    payment_date: string
    method: string
    reference?: string
    supplier_invoice_id?: number
    payment_account_id?: number
}) {
    if (!data.amount || data.amount <= 0) {
        throw new Error('Payment amount must be greater than zero.')
    }
    const result = await erpFetch('payments/supplier_payment/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/payments')
    return result
}

export async function recordCustomerReceipt(data: {
    contact_id: number
    amount: number
    payment_date: string
    method: string
    reference?: string
    sales_order_id?: number
    payment_account_id?: number
}) {
    if (!data.amount || data.amount <= 0) {
        throw new Error('Receipt amount must be greater than zero.')
    }
    const result = await erpFetch('payments/customer_receipt/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/payments')
    return result
}

export async function getAgedReceivables() {
    return await erpFetch('payments/aged_receivables/')
}

export async function getAgedPayables() {
    return await erpFetch('payments/aged_payables/')
}

// ── Customer Balances ────────────────────────────────────
export async function getCustomerBalances() {
    return await erpFetch('customer-balances/')
}

// ── Supplier Balances ────────────────────────────────────
export async function getSupplierBalances() {
    return await erpFetch('supplier-balances/')
}
