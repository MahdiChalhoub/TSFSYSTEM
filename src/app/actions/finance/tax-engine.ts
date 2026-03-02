'use server'

import { erpFetch } from '@/lib/erp-api'

// ── VAT Return Report ─────────────────────────────────────────
export async function getVatReturnReport(periodStart: string, periodEnd: string) {
    return await erpFetch(`finance/vat-return/report/?period_start=${periodStart}&period_end=${periodEnd}`)
}

export async function getVatReturnDashboard() {
    return await erpFetch('finance/vat-return/dashboard/')
}

// ── VAT Settlement ────────────────────────────────────────────
export async function calculateVatSettlement(periodStart: string, periodEnd: string) {
    return await erpFetch(`finance/vat-settlement/calculate/?period_start=${periodStart}&period_end=${periodEnd}`)
}

export async function postVatSettlement(payload: {
    period_start: string
    period_end: string
    bank_account_id: number | string
}) {
    return await erpFetch('finance/vat-settlement/post/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

// ── OrgTaxPolicy ──────────────────────────────────────────────
export async function getOrgTaxPolicy() {
    return await erpFetch('finance/org-tax-policies/')
}

export async function saveOrgTaxPolicy(id: number | null, data: Record<string, unknown>) {
    if (id) {
        return await erpFetch(`finance/org-tax-policies/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }
    return await erpFetch('finance/org-tax-policies/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

// ── CounterpartyTaxProfile ────────────────────────────────────
export async function getCounterpartyTaxProfiles() {
    return await erpFetch('finance/counterparty-tax-profiles/')
}

export async function saveCounterpartyTaxProfile(id: number | null, data: Record<string, unknown>) {
    if (id) {
        return await erpFetch(`finance/counterparty-tax-profiles/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }
    return await erpFetch('finance/counterparty-tax-profiles/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

// ── PeriodicTaxAccrual ────────────────────────────────────────
export async function runPeriodicTaxAccrual(payload: {
    period_start: string
    period_end: string
    mode?: string
}) {
    return await erpFetch('finance/periodic-tax/run/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function getPeriodicTaxAccruals() {
    return await erpFetch('finance/periodic-tax/')
}
