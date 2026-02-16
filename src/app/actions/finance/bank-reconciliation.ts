'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getBankAccounts() {
    return await erpFetch('finance/journal/bank-reconciliation/')
}

export async function getBankReconciliation(accountId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ account_id: accountId })
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return await erpFetch(`finance/journal/bank-reconciliation/?${params.toString()}`)
}

export async function getContactStatement(contactId: string) {
    return await erpFetch(`crm/contacts/${contactId}/summary/`)
}
