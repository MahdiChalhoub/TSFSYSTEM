'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Read helpers ───────────────────────────────────────────────

export async function getWizardConfig() {
    try {
        const [config, currencies, businessTypes, coaTemplates, warehouses, modules] = await Promise.all([
            erpFetch('auth/config/').catch(() => ({})),
            erpFetch('currencies/').catch(() => []),
            erpFetch('business-types/').catch(() => []),
            erpFetch('coa/templates/').catch(() => []),
            erpFetch('inventory/warehouses/').catch(() => ({ results: [] })),
            erpFetch('modules/').catch(() => []),
        ])

        return {
            currencies: Array.isArray(currencies) ? currencies : currencies?.results || [],
            businessTypes: Array.isArray(businessTypes) ? businessTypes : businessTypes?.results || [],
            coaTemplates: Array.isArray(coaTemplates) ? coaTemplates : [],
            warehouses: Array.isArray(warehouses) ? warehouses : warehouses?.results || [],
            modules: Array.isArray(modules) ? modules : modules?.results || [],
            tenant: config?.tenant || {},
        }
    } catch (error) {
        console.error("Wizard config fetch error:", error)
        return {
            currencies: [],
            businessTypes: [],
            coaTemplates: [],
            warehouses: [],
            modules: [],
            tenant: {},
        }
    }
}

export async function getOrganizationProfile() {
    try {
        return await erpFetch('organizations/me/')
    } catch (error) {
        console.error("Org profile fetch error:", error)
        return null
    }
}

export async function getOnboardingStatus() {
    try {
        const settings = await erpFetch('settings/item/onboarding_completed/')
        return settings === true || settings?.value === true
    } catch {
        return false
    }
}

/**
 * Check if the organization has completed mandatory setup:
 * 1. Onboarding was previously completed (existing orgs skip the wizard)
 * 2. OR: Fiscal regime + base_currency + fiscal year are all configured
 * 
 * This is a ONE-TIME gate: once onboarding_completed is set, the wizard
 * never blocks access again.
 */
export async function checkSetupReadiness(): Promise<{
    ready: boolean
    hasCompanyType: boolean
    hasCurrency: boolean
    hasFiscalYear: boolean
}> {
    try {
        // Fast path: if onboarding was already completed, skip all checks
        const onboardingDone = await erpFetch('settings/item/onboarding_completed/').catch(() => null)
        if (onboardingDone === true || onboardingDone?.value === true) {
            return { ready: true, hasCompanyType: true, hasCurrency: true, hasFiscalYear: true }
        }

        // Full check for first-time setup
        const [financialSettings, orgProfile, fiscalYears] = await Promise.all([
            erpFetch('settings/global_financial/').catch(() => ({})),
            erpFetch('organizations/me/').catch(() => ({})),
            erpFetch('fiscal-years/').catch(() => ({ results: [] })),
        ])

        const companyType = financialSettings?.companyType
        // companyType defaults to REGULAR in the backend, so it's ok if not explicitly set
        const hasCompanyType = !!companyType && companyType !== ''
        const hasCurrency = !!orgProfile?.base_currency
        const fyList = Array.isArray(fiscalYears) ? fiscalYears : fiscalYears?.results || []
        const hasFiscalYear = fyList.length > 0

        // An org is "ready" if it has currency + fiscal year (companyType defaults to REGULAR)
        const ready = hasCurrency && hasFiscalYear

        return {
            ready,
            hasCompanyType,
            hasCurrency,
            hasFiscalYear,
        }
    } catch {
        // If we can't check, assume ready to avoid blocking existing orgs
        return { ready: true, hasCompanyType: true, hasCurrency: true, hasFiscalYear: true }
    }
}

// ─── Write helpers ──────────────────────────────────────────────

export async function saveBusinessProfile(data: {
    name?: string
    business_email?: string
    phone?: string
    website?: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    country?: string
    timezone?: string
    business_type_id?: string
    base_currency_id?: string
    vat_number?: string
    legal_entity?: string
    logo?: string
}) {
    try {
        await erpFetch('organizations/me/', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to save business profile' }
    }
}

export async function saveFiscalRegime(regime: string) {
    try {
        // Save companyType to global financial settings
        await erpFetch('settings/global_financial/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyType: regime }),
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to save fiscal regime' }
    }
}

export async function saveFinancialSetup(data: {
    base_currency_id?: string
    coa_template?: string
    fiscal_year_name?: string
    fiscal_year_start?: string
    fiscal_year_end?: string
    works_in_ttc?: boolean
}) {
    try {
        // 1. Update currency on org if provided
        if (data.base_currency_id) {
            await erpFetch('organizations/me/', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_currency_id: data.base_currency_id }),
            })
        }

        // 2. Apply COA template if selected
        if (data.coa_template) {
            await erpFetch('coa/apply_template/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_key: data.coa_template,
                    reset: false,
                }),
            })
        }

        // 3. Create fiscal year (MANDATORY)
        if (data.fiscal_year_name && data.fiscal_year_start && data.fiscal_year_end) {
            try {
                await erpFetch('fiscal-years/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.fiscal_year_name,
                        start_date: data.fiscal_year_start,
                        end_date: data.fiscal_year_end,
                        frequency: 'MONTHLY',
                    }),
                })
            } catch (error: any) {
                // Ignore overlap errors - it means it's already created
                if (!error?.message?.toLowerCase().includes('overlap')) {
                    throw error
                }
            }
        }

        // 4. Save global financial settings (TTC mode)
        if (data.works_in_ttc !== undefined) {
            await erpFetch('settings/global_financial/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worksInTTC: data.works_in_ttc }),
            })
        }

        // 5. Auto-apply smart posting rules after COA
        try {
            await erpFetch('settings/smart_apply/', { method: 'POST' })
        } catch {
            // Non-critical — can fail silently
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to save financial setup' }
    }
}

export async function createWarehouse(data: {
    name: string
    code: string
    location_type?: string
    address?: string
    city?: string
    phone?: string
}) {
    try {
        const result = await erpFetch('inventory/warehouses/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        return { success: true, data: result }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to create warehouse' }
    }
}

export async function bulkCreateWarehouses(warehouses: any[]) {
    try {
        const results = []
        for (const wh of warehouses) {
            if (!wh.name) continue
            const r = await erpFetch('inventory/warehouses/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wh),
            })
            results.push(r)
        }
        return { success: true, data: results }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to bulk create warehouses' }
    }
}

export async function saveModulePreferences(enabledModules: string[]) {
    try {
        await erpFetch('settings/item/enabled_modules/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enabledModules),
        })
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to save module preferences' }
    }
}

export async function completeOnboarding() {
    try {
        await erpFetch('settings/item/onboarding_completed/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(true),
        })
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to mark onboarding complete' }
    }
}
