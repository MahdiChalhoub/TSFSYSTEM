'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ─── Read helpers ───────────────────────────────────────────────

export async function getWizardConfig() {
    try {
        const [config, currencies, businessTypes, coaTemplates, warehouses, modules, coaItems, posAccounts] = await Promise.all([
            erpFetch('auth/config/').catch(() => ({})),
            erpFetch('currencies/').catch(() => []),
            erpFetch('business-types/').catch(() => []),
            erpFetch('coa/templates/').catch(() => []),
            erpFetch('inventory/warehouses/').catch(() => ({ results: [] })),
            erpFetch('modules/').catch(() => []),
            erpFetch('coa/').catch(() => ({ results: [] })),
            erpFetch('finance/accounts/?is_pos_enabled=true').catch(() => ({ results: [] })),
        ])

        return {
            currencies: Array.isArray(currencies) ? currencies : currencies?.results || [],
            businessTypes: Array.isArray(businessTypes) ? businessTypes : businessTypes?.results || [],
            coaTemplates: Array.isArray(coaTemplates) ? coaTemplates : [],
            warehouses: Array.isArray(warehouses) ? warehouses : warehouses?.results || [],
            modules: Array.isArray(modules) ? modules : modules?.results || [],
            coaItems: Array.isArray(coaItems) ? coaItems : coaItems?.results || [],
            posAccounts: Array.isArray(posAccounts) ? posAccounts : posAccounts?.results || [],
            tenant: config?.tenant || {},
        }
    } catch (error) {
        console.error("Wizard config fetch error:", error)
        return {
            currencies: [], businessTypes: [], coaTemplates: [], warehouses: [], modules: [], coaItems: [], posAccounts: [], tenant: {},
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

export async function checkSetupReadiness(): Promise<{
    ready: boolean
    hasCompanyType: boolean
    hasCurrency: boolean
    hasFiscalYear: boolean
    hasCOA: boolean
    hasWarehouse: boolean
    hasPOSAccount: boolean
}> {
    try {
        // 1. Authoritative check: Is onboarding explicitly completed?
        const onboardingDone = await erpFetch('settings/item/onboarding_completed/').catch(() => null)
        const isCompleted = onboardingDone === true || onboardingDone?.value === true

        if (isCompleted) {
            return {
                ready: true,
                hasCompanyType: true, hasCurrency: true, hasFiscalYear: true,
                hasCOA: true, hasWarehouse: true, hasPOSAccount: true
            }
        }

        // 2. Strict Readiness Audit: verify MANDATORY accounting and operational essentials.
        // Products and Contacts are optional, but Accounting Skeleton is NOT.
        const [financialSettings, orgProfile, fiscalYears, coaItems, warehouses, posAccounts] = await Promise.all([
            erpFetch('settings/global_financial/').catch(() => ({})),
            erpFetch('organizations/me/').catch(() => ({})),
            erpFetch('fiscal-years/').catch(() => ({ results: [] })),
            erpFetch('coa/').catch(() => ({ results: [] })),
            erpFetch('inventory/warehouses/').catch(() => ({ results: [] })),
            erpFetch('finance/accounts/?is_pos_enabled=true').catch(() => ({ results: [] })),
        ])

        const companyType = financialSettings?.companyType
        const hasCompanyType = !!companyType && companyType !== ''
        const hasCurrency = !!orgProfile?.base_currency
        const fyList = Array.isArray(fiscalYears) ? fiscalYears : fiscalYears?.results || []
        const hasFiscalYear = fyList.length > 0
        const coaList = Array.isArray(coaItems) ? coaItems : coaItems?.results || []
        const hasCOA = coaList.length > 0
        const whList = Array.isArray(warehouses) ? warehouses : warehouses?.results || []
        const hasWarehouse = whList.length > 0
        const posAccList = Array.isArray(posAccounts) ? posAccounts : posAccounts?.results || []
        const hasPOSAccount = posAccList.length > 0

        // An organization is ONLY ready if ALL accounting and operational skeletons are present.
        const ready = hasCompanyType && hasCurrency && hasFiscalYear && hasCOA && hasWarehouse && hasPOSAccount

        return {
            ready,
            hasCompanyType,
            hasCurrency,
            hasFiscalYear,
            hasCOA,
            hasWarehouse,
            hasPOSAccount,
        }
    } catch (err) {
        // Safe fallback for legacy orgs or total API failure
        console.error("Critical Readiness Audit Error:", err)
        return {
            ready: true,
            hasCompanyType: true, hasCurrency: true, hasFiscalYear: true,
            hasCOA: true, hasWarehouse: true, hasPOSAccount: true
        }
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

export async function createFinancialAccount(data: {
    name: string
    type: string
    currency: string
    is_pos_enabled: boolean
    linked_coa?: string | number
    site_id?: string | number
}) {
    try {
        const result = await erpFetch('finance/accounts/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.name,
                type: data.type,
                currency: data.currency,
                is_pos_enabled: data.is_pos_enabled,
                ledger_account: data.linked_coa,
                site_id: data.site_id,
            }),
        })
        return { success: true, data: result }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to create financial account' }
    }
}

export async function initializeDefaultRegister() {
    try {
        const [me, warehouses, posAccounts, registers] = await Promise.all([
            erpFetch('auth/me/'),
            erpFetch('inventory/warehouses/'),
            erpFetch('finance/accounts/?is_pos_enabled=true'),
            erpFetch('pos-registers/'),
        ])

        const whList = warehouses?.results || []
        const accList = posAccounts?.results || []
        const regList = registers?.results || []

        if (regList.length > 0) return { success: true, message: "Register already exists" }
        if (whList.length === 0 || accList.length === 0) return { success: false, error: "Missing skeleton for register" }

        const defaultWh = whList[0]
        const defaultAcc = accList[0]

        // Create the register
        const newReg = await erpFetch('pos-registers/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Main Register",
                branch: defaultWh.id,
                warehouse: defaultWh.id,
                cash_account: defaultAcc.id,
                allowed_accounts: [defaultAcc.id],
                authorized_users: [me.id],
                is_active: true,
                opening_mode: 'STANDARD',
                payment_methods: [
                    { key: 'CASH', label: 'Cash', accountId: defaultAcc.id },
                    { key: 'CREDIT', label: 'Credit (Debt)', accountId: null }
                ]
            })
        })

        // Link user to this register
        await erpFetch(`users/${me.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cash_register_id: newReg.id })
        }).catch(() => null)

        return { success: true, data: newReg }
    } catch (error: any) {
        console.error("Failed to initialize default register:", error)
        return { success: false, error: error?.message || "Failed to initialize register" }
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
        // Multi-level initialization audit
        try {
            await initializeDefaultRegister()
        } catch (e) {
            console.warn("Non-critical: default register init failed during onboarding", e)
        }

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
