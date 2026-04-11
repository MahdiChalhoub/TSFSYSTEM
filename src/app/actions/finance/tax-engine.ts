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

// ── CustomTaxRule ─────────────────────────────────────────────
export async function getCustomTaxRules() {
    return await erpFetch('finance/custom-tax-rules/')
}

export async function saveCustomTaxRule(id: number | null, data: Record<string, unknown>) {
    if (id) {
        return await erpFetch(`finance/custom-tax-rules/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }
    return await erpFetch('finance/custom-tax-rules/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function deleteCustomTaxRule(id: number) {
    return await erpFetch(`finance/custom-tax-rules/${id}/`, {
        method: 'DELETE',
    })
}

// ── TaxJurisdictionRule ───────────────────────────────────────
export async function getTaxJurisdictionRules() {
    return await erpFetch('finance/tax-jurisdiction-rules/')
}

export async function saveTaxJurisdictionRule(id: number | null, data: Record<string, unknown>) {
    if (id) {
        return await erpFetch(`finance/tax-jurisdiction-rules/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }
    return await erpFetch('finance/tax-jurisdiction-rules/', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function deleteTaxJurisdictionRule(id: number) {
    return await erpFetch(`finance/tax-jurisdiction-rules/${id}/`, {
        method: 'DELETE',
    })
}

export async function resolveJurisdiction(payload: {
    origin_country: string
    destination_country: string
    destination_region?: string
    counterparty_country?: string
    is_export?: boolean
    is_b2b?: boolean
    tax_type?: string
}) {
    return await erpFetch('finance/tax-jurisdiction-rules/resolve/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

// ── Delete helpers ────────────────────────────────────────────
export async function deleteOrgTaxPolicy(id: number) {
    return await erpFetch(`finance/org-tax-policies/${id}/`, { method: 'DELETE' })
}

export async function deleteCounterpartyTaxProfile(id: number) {
    return await erpFetch(`finance/counterparty-tax-profiles/${id}/`, { method: 'DELETE' })
}

export async function seedCounterpartyPresets() {
    return await erpFetch('finance/counterparty-tax-profiles/seed-presets/', { method: 'POST' })
}

export async function setDefaultOrgTaxPolicy(id: number) {
    return await erpFetch(`finance/org-tax-policies/${id}/set-default/`, { method: 'POST' })
}

// ── Country Tax Templates (SaaS-level) ────────────────────────
export async function getCountryTaxTemplates() {
    return await erpFetch('finance/country-tax-templates/')
}

export async function getCountryTaxTemplate(countryCode: string) {
    return await erpFetch(`finance/country-tax-templates/by-country/${countryCode.toUpperCase()}/`)
}

// ── Template → Org Policy Import ──────────────────────────────
export async function getAvailableTemplates() {
    return await erpFetch('finance/org-tax-policies/available-templates/')
}

export async function importFromTemplate(countryCode: string, presetNames?: string[]) {
    return await erpFetch('finance/org-tax-policies/import-from-template/', {
        method: 'POST',
        body: JSON.stringify({
            country_code: countryCode,
            preset_names: presetNames || [],
        }),
    })
}

// ── Template → Counterparty Profile Import ─────────────────────
export async function getCounterpartyAvailableTemplates() {
    return await erpFetch('finance/counterparty-tax-profiles/available-templates/')
}

export async function importCounterpartyFromTemplate(countryCode: string, presetNames?: string[]) {
    return await erpFetch('finance/counterparty-tax-profiles/import-from-template/', {
        method: 'POST',
        body: JSON.stringify({
            country_code: countryCode,
            preset_names: presetNames || [],
        }),
    })
}

// ── Template → Custom Tax Rule Import ──────────────────────────
export async function getCustomTaxRuleAvailableTemplates() {
    return await erpFetch('finance/custom-tax-rules/available-templates/')
}

export async function importCustomTaxRuleFromTemplate(countryCode: string, presetNames?: string[]) {
    return await erpFetch('finance/custom-tax-rules/import-from-template/', {
        method: 'POST',
        body: JSON.stringify({
            country_code: countryCode,
            preset_names: presetNames || [],
        }),
    })
}
