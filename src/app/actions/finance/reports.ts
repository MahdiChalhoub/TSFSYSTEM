'use server'

import { erpFetch } from "@/lib/erp-api"

// ─── Aged Reports ────────────────────────────────────────────────

export async function getAgedReceivables() {
    return await erpFetch('finance/payments/aged_receivables/')
}

export async function getAgedPayables() {
    return await erpFetch('finance/payments/aged_payables/')
}

// ─── Financial Statements ────────────────────────────────────────

export async function getTrialBalance(asOf?: string, scope?: string) {
    const params = new URLSearchParams()
    if (asOf) params.set('as_of', asOf)
    if (scope) params.set('scope', scope)
    const query = params.toString() ? `?${params.toString()}` : ''
    return await erpFetch(`finance/coa/trial_balance/${query}`)
}

export async function getAccountStatement(accountId: number) {
    return await erpFetch(`finance/coa/${accountId}/statement/`)
}

// ─── Helper: Financial Accounts ──────────────────────────────────

export async function getCustomerBalances() {
    return await erpFetch('finance/customer-balances/')
}

export async function getSupplierBalances() {
    return await erpFetch('finance/supplier-balances/')
}
