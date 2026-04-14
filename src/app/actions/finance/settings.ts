'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from 'next/cache'

// ── Types ──

export type GeneralSettings = {
    currency?: string
    defaultTaxRate?: number
}

export type SetupStepStatus = 'complete' | 'partial' | 'not_started'

export type SetupStep = {
    id: string
    label: string
    status: SetupStepStatus
    summary: string
    detail?: string
}

export type AccountingSetupStatus = {
    steps: SetupStep[]
    completedCount: number
    totalCount: number
    generalSettings: GeneralSettings
}

// ── Aggregated Setup Status ──

export async function getAccountingSetupStatus(): Promise<AccountingSetupStatus> {
    const steps: SetupStep[] = []
    let generalSettings: GeneralSettings = { currency: 'XOF', defaultTaxRate: 0.18 }

    // 1. Tax Engine Profile
    try {
        const pol = await erpFetch('finance/org-tax-policies/')
        const policies = Array.isArray(pol) ? pol : (pol?.results || [])
        const active = policies.find((p: Record<string, unknown>) => p.is_default) || policies[0]
        steps.push({
            id: 'tax_policy',
            label: 'Tax Engine Profile',
            status: active ? 'complete' : 'not_started',
            summary: active ? `${active.name || 'Active Policy'}` : 'No tax policy configured',
            detail: active ? `${active.country_code || '—'} · VAT ${active.vat_output_enabled ? 'ON' : 'OFF'}` : undefined,
        })
    } catch {
        steps.push({
            id: 'tax_policy',
            label: 'Tax Engine Profile',
            status: 'not_started',
            summary: 'Unable to load tax policy',
        })
    }

    // 2. Chart of Accounts
    try {
        const [setupRaw, coaRaw] = await Promise.all([
            erpFetch('settings/coa_setup/').catch(() => null),
            erpFetch('finance/chart-of-accounts/').catch(() => null),
        ])
        const setup = setupRaw || {}
        const accounts = Array.isArray(coaRaw) ? coaRaw : (coaRaw?.results || [])
        const accountCount = coaRaw?.count ?? accounts.length
        const isComplete = setup.status === 'COMPLETED' || accountCount > 0

        steps.push({
            id: 'coa',
            label: 'Chart of Accounts',
            status: isComplete ? 'complete' : 'not_started',
            summary: isComplete ? `${accountCount} accounts` : 'No Chart of Accounts imported',
            detail: setup.selectedTemplate ? `Template: ${setup.selectedTemplate}` : undefined,
        })
    } catch {
        steps.push({
            id: 'coa',
            label: 'Chart of Accounts',
            status: 'not_started',
            summary: 'Unable to load COA status',
        })
    }

    // 3. Posting Rules
    try {
        const rules = await erpFetch('settings/posting_rules/')
        let totalSlots = 0
        let filledSlots = 0
        if (rules && typeof rules === 'object') {
            for (const section of Object.values(rules)) {
                if (section && typeof section === 'object') {
                    for (const val of Object.values(section as Record<string, unknown>)) {
                        totalSlots++
                        if (val !== null && val !== undefined && val !== '') filledSlots++
                    }
                }
            }
        }
        const status: SetupStepStatus = filledSlots === 0 ? 'not_started' : filledSlots >= 5 ? 'complete' : 'partial'
        steps.push({
            id: 'posting_rules',
            label: 'Posting Rules',
            status,
            summary: totalSlots > 0 ? `${filledSlots}/${totalSlots} accounts mapped` : 'No rules configured',
        })
    } catch {
        steps.push({
            id: 'posting_rules',
            label: 'Posting Rules',
            status: 'not_started',
            summary: 'Unable to load posting rules',
        })
    }

    // 4. Fiscal Year
    try {
        const raw = await erpFetch('fiscal-years/')
        const years = Array.isArray(raw) ? raw : (raw?.results || [])
        const openYear = years.find((y: Record<string, unknown>) => !y.is_hard_locked && !y.is_closed)
        steps.push({
            id: 'fiscal_year',
            label: 'Fiscal Year',
            status: openYear ? 'complete' : years.length > 0 ? 'partial' : 'not_started',
            summary: openYear ? `${openYear.name}` : years.length > 0 ? 'All years closed' : 'No fiscal year created',
            detail: openYear ? `${openYear.start_date} → ${openYear.end_date}` : undefined,
        })
    } catch {
        steps.push({
            id: 'fiscal_year',
            label: 'Fiscal Year',
            status: 'not_started',
            summary: 'Unable to load fiscal years',
        })
    }

    // Load general settings
    try {
        const result = await erpFetch('settings/global_financial/')
        generalSettings = {
            currency: result.currency || 'XOF',
            defaultTaxRate: Number(result.defaultTaxRate) || 0.18,
        }
    } catch { /* defaults */ }

    const completedCount = steps.filter(s => s.status === 'complete').length

    return { steps, completedCount, totalCount: steps.length, generalSettings }
}

// ── Save General Settings ──

export async function updateGeneralSettings(data: GeneralSettings) {
    try {
        // Load existing settings and merge (preserve companyType for backward compat)
        let existing: Record<string, unknown> = {}
        try {
            existing = await erpFetch('settings/global_financial/')
        } catch { /* fresh org */ }

        // Auto-derive companyType from OrgTaxPolicy if not set
        let companyType = existing.companyType || 'REGULAR'
        try {
            const pol = await erpFetch('finance/org-tax-policies/')
            const policies = Array.isArray(pol) ? pol : (pol?.results || [])
            const active = policies.find((p: Record<string, unknown>) => p.is_default) || policies[0]
            if (active) {
                if (active.vat_output_enabled && Number(active.vat_input_recoverability) >= 0.99) {
                    companyType = 'REAL'
                } else if (!active.vat_output_enabled && active.periodic_amount) {
                    companyType = 'MICRO'
                } else if (active.vat_output_enabled) {
                    companyType = 'MIXED' // conservative — org has some VAT config
                } else {
                    companyType = 'REGULAR'
                }
            }
        } catch { /* keep existing */ }

        await erpFetch('settings/global_financial/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...existing,
                currency: data.currency,
                defaultTaxRate: data.defaultTaxRate,
                companyType, // backward compat — derived from OrgTaxPolicy
            })
        })
        revalidatePath('/finance/settings')
        return { success: true }
    } catch (error) {
        console.error("Failed to update settings:", error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// ── Lock Status ──
export async function getSettingsLockStatus() {
    return { isLocked: false, reason: null }
}

// ── Backward Compatibility ──
// These functions are still imported by:
//   - src/hooks/pos/useTerminal.ts
//   - src/app/(privileged)/purchases/new/page.tsx
//   - src/components/dev/DebugOverlay.tsx

export type FinancialSettingsState = {
    companyType?: string
    currency?: string
    defaultTaxRate?: number
    salesTaxPercentage?: number
    purchaseTaxPercentage?: number
    worksInTTC?: boolean
    allowHTEntryForTTC?: boolean
    declareTVA?: boolean
    dualView?: boolean
}

export async function getFinancialSettings(): Promise<FinancialSettingsState> {
    try {
        const result = await erpFetch('settings/global_financial/')
        return {
            ...result,
            defaultTaxRate: Number(result.defaultTaxRate),
            salesTaxPercentage: Number(result.salesTaxPercentage),
            purchaseTaxPercentage: Number(result.purchaseTaxPercentage),
        }
    } catch {
        return {
            companyType: 'REGULAR',
            currency: 'XOF',
            defaultTaxRate: 0.18,
            salesTaxPercentage: 0,
            purchaseTaxPercentage: 0,
        }
    }
}

export async function updateFinancialSettings(data: FinancialSettingsState) {
    try {
        await erpFetch('settings/global_financial/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/settings')
        return { success: true }
    } catch (error) {
        console.error("Failed to update settings:", error)
        return { success: false }
    }
}