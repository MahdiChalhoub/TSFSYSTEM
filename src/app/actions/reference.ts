'use server'

/**
 * Reference Module Server Actions
 * ================================
 * Provides access to global reference data (countries, currencies)
 * and organization-scoped activation tables.
 *
 * Backend: apps/reference/ module
 * API Base: /api/reference/
 */

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"
import type {
    RefCountry,
    RefCurrency,
    CountryCurrencyMap,
    OrgCountry,
    OrgCurrency,
    ActionResult,
} from "@/types/erp"

// =============================================================================
// GLOBAL REFERENCE DATA (SaaS-level, read-only for regular users)
// =============================================================================

/**
 * Fetch all active countries from the global reference list.
 * Supports optional search and region filtering.
 */
export async function getRefCountries(params?: {
    search?: string
    region?: string
    is_active?: boolean
}): Promise<RefCountry[]> {
    try {
        const query = new URLSearchParams()
        if (params?.search) query.set('search', params.search)
        if (params?.region) query.set('region', params.region)
        if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))

        const qs = query.toString()
        const url = qs ? `reference/countries/?${qs}` : 'reference/countries/'
        const result = await erpFetch(url)
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch countries:", error)
        return []
    }
}

/**
 * Fetch all active currencies from the global reference list.
 */
export async function getRefCurrencies(params?: {
    search?: string
    is_active?: boolean
}): Promise<RefCurrency[]> {
    try {
        const query = new URLSearchParams()
        if (params?.search) query.set('search', params.search)
        if (params?.is_active !== undefined) query.set('is_active', String(params.is_active))

        const qs = query.toString()
        const url = qs ? `reference/currencies/?${qs}` : 'reference/currencies/'
        const result = await erpFetch(url)
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch currencies:", error)
        return []
    }
}

/**
 * Fetch distinct region names for filter dropdowns.
 */
export async function getCountryRegions(): Promise<string[]> {
    try {
        const result = await erpFetch('reference/countries/regions/')
        return Array.isArray(result) ? result : []
    } catch (error) {
        console.error("[Reference] Failed to fetch regions:", error)
        return []
    }
}

/**
 * Fetch country-currency mappings (optionally filtered by country or currency).
 */
export async function getCountryCurrencyMap(params?: {
    country_id?: number
    currency_id?: number
}): Promise<CountryCurrencyMap[]> {
    try {
        const query = new URLSearchParams()
        if (params?.country_id) query.set('country_id', String(params.country_id))
        if (params?.currency_id) query.set('currency_id', String(params.currency_id))

        const qs = query.toString()
        const url = qs ? `reference/country-currency-map/?${qs}` : 'reference/country-currency-map/'
        const result = await erpFetch(url)
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch country-currency map:", error)
        return []
    }
}

// =============================================================================
// ORGANIZATION ACTIVATION (Tenant-scoped)
// =============================================================================

/**
 * Fetch the current org's enabled countries.
 */
export async function getOrgCountries(): Promise<OrgCountry[]> {
    try {
        const result = await erpFetch('reference/org-countries/')
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch org countries:", error)
        return []
    }
}

/**
 * Enable a country for the current organization.
 * Returns the created OrgCountry row in `data` so the frontend can use the
 * real DB id for subsequent disable / set-default calls (instead of a fake
 * optimistic ID that doesn't exist on the server).
 */
export async function enableOrgCountry(countryId: number, isDefault = false): Promise<ActionResult & { data?: { id: number; country: number; is_default?: boolean } }> {
    try {
        const created = await erpFetch('reference/org-countries/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                country: countryId,
                is_enabled: true,
                is_default: isDefault,
            }),
        }) as { id: number; country: number; is_default?: boolean }
        revalidatePath('/settings')
        return { success: true, data: created }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to enable country' }
    }
}

/**
 * Bulk-enable multiple countries at once.
 */
export async function bulkEnableOrgCountries(countryIds: number[]): Promise<ActionResult> {
    try {
        const result = await erpFetch('reference/org-countries/bulk-enable/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_ids: countryIds }),
        })
        revalidatePath('/settings')
        return { success: true, result }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk-enable countries' }
    }
}

/**
 * Set a country as the org's default.
 */
export async function setDefaultOrgCountry(countryId: number): Promise<ActionResult> {
    try {
        await erpFetch('reference/org-countries/set-default/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_id: countryId }),
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set default country' }
    }
}

/**
 * Disable (delete) an org country activation.
 */
export async function disableOrgCountry(orgCountryId: number): Promise<ActionResult> {
    try {
        await erpFetch(`reference/org-countries/${orgCountryId}/`, {
            method: 'DELETE',
        })
        revalidatePath('/settings')
        revalidatePath('/inventory/countries')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to disable country' }
    }
}

/**
 * Fetch the current org's enabled currencies.
 */
export async function getOrgCurrencies(): Promise<OrgCurrency[]> {
    try {
        const result = await erpFetch('reference/org-currencies/')
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch org currencies:", error)
        return []
    }
}

/**
 * Enable a currency for the current organization.
 * Returns the created OrgCurrency row in `data` so the frontend can use the
 * real DB id for subsequent disable / set-default calls.
 */
export async function enableOrgCurrency(
    currencyId: number,
    options?: { is_default?: boolean; is_transaction_currency?: boolean; is_reporting_currency?: boolean }
): Promise<ActionResult & { data?: { id: number; currency: number; is_default?: boolean } }> {
    try {
        const created = await erpFetch('reference/org-currencies/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currency: currencyId,
                is_enabled: true,
                is_default: options?.is_default ?? false,
                is_transaction_currency: options?.is_transaction_currency ?? true,
                is_reporting_currency: options?.is_reporting_currency ?? false,
            }),
        }) as { id: number; currency: number; is_default?: boolean }
        revalidatePath('/settings')
        return { success: true, data: created }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to enable currency' }
    }
}

/**
 * Bulk-enable multiple currencies at once.
 */
export async function bulkEnableOrgCurrencies(currencyIds: number[]): Promise<ActionResult> {
    try {
        const result = await erpFetch('reference/org-currencies/bulk-enable/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency_ids: currencyIds }),
        })
        revalidatePath('/settings')
        return { success: true, result }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk-enable currencies' }
    }
}

/**
 * Set a currency as the org's base/default.
 */
export async function setDefaultOrgCurrency(currencyId: number): Promise<ActionResult> {
    try {
        await erpFetch('reference/org-currencies/set-default/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency_id: currencyId }),
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set default currency' }
    }
}

/**
 * Disable (delete) an org currency activation.
 */
export async function disableOrgCurrency(orgCurrencyId: number): Promise<ActionResult> {
    try {
        await erpFetch(`reference/org-currencies/${orgCurrencyId}/`, {
            method: 'DELETE',
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to disable currency' }
    }
}

// =============================================================================
// SOURCING COUNTRIES (Tenant-scoped — Product Origin Countries)
// =============================================================================

/**
 * Fetch the current org's sourcing countries (product origin countries).
 */
export async function getSourcingCountries(): Promise<any[]> {
    try {
        const result = await erpFetch('reference/sourcing-countries/')
        return Array.isArray(result) ? result : result?.results || []
    } catch (error) {
        console.error("[Reference] Failed to fetch sourcing countries:", error)
        return []
    }
}

/**
 * Enable a single sourcing country for the current organization.
 */
export async function enableSourcingCountry(countryId: number, notes = ''): Promise<ActionResult> {
    try {
        await erpFetch('reference/sourcing-countries/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                country: countryId,
                is_enabled: true,
                notes,
            }),
        })
        revalidatePath('/inventory/countries')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to enable sourcing country' }
    }
}

/**
 * Bulk-enable multiple sourcing countries at once.
 */
export async function bulkEnableSourcingCountries(countryIds: number[]): Promise<ActionResult> {
    try {
        const result = await erpFetch('reference/sourcing-countries/bulk-enable/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_ids: countryIds }),
        })
        revalidatePath('/inventory/countries')
        return { success: true, result }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk-enable sourcing countries' }
    }
}

/**
 * Bulk-disable (remove) multiple sourcing countries at once.
 */
export async function bulkDisableSourcingCountries(countryIds: number[]): Promise<ActionResult> {
    try {
        const result = await erpFetch('reference/sourcing-countries/bulk-disable/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country_ids: countryIds }),
        })
        revalidatePath('/inventory/countries')
        return { success: true, result }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to disable sourcing countries' }
    }
}

/**
 * Disable (delete) a single sourcing country activation.
 */
export async function disableSourcingCountry(sourcingCountryId: number): Promise<ActionResult> {
    try {
        await erpFetch(`reference/sourcing-countries/${sourcingCountryId}/`, {
            method: 'DELETE',
        })
        revalidatePath('/inventory/countries')
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to disable sourcing country' }
    }
}

