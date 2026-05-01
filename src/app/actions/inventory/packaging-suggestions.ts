'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * ═══════════════════════════════════════════════════════════════
 *  Smart Packaging Suggestion Engine — client API
 * ═══════════════════════════════════════════════════════════════
 *  Backend: PackagingSuggestionRule model + /packaging-suggestions/
 *
 *  Specificity model (higher wins):
 *    category only           → 10
 *    category + brand        → 20
 *    category + brand + attr → 30
 *
 *  Override via explicit `priority` on the rule. Ties broken by
 *  usage_count (user acceptance count).
 */

export type PackagingSuggestionRule = {
    id?: number
    category?: number | null
    category_name?: string
    brand?: number | null
    brand_name?: string
    attribute?: number | null
    attribute_name?: string
    attribute_value?: string | null
    packaging: number
    packaging_name?: string
    packaging_ratio?: number
    packaging_unit_code?: string
    priority?: number
    effective_priority?: number
    specificity?: number
    usage_count?: number
    notes?: string | null
}

/**
 * List all packaging suggestion rules.
 * Optional filters: ?category=X&brand=X&attribute=X&packaging=X
 */
export async function listPackagingRules(filters: Record<string, string | number | undefined> = {}) {
    try {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
        }
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await erpFetch(`packaging-suggestions/${qs}`, { cache: 'no-store' } as any)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to list packaging rules:', e)
        return []
    }
}

/**
 * Core smart endpoint: given a product context (category, brand, attributes),
 * return the ranked list of applicable packaging suggestions.
 *
 * Rules with NULL dimensions act as wildcards — so a rule
 * { category=Tissue, brand=NULL } matches any brand of Tissue.
 */
export async function getPackagingSuggestions(context: {
    category?: number | string
    brand?: number | string
    attribute?: number | string
    attribute_value?: string
}) {
    try {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(context)) {
            if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
        }
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await erpFetch(`packaging-suggestions/suggest/${qs}`, { cache: 'no-store' } as any)
        return {
            count: Number(data?.count ?? 0),
            suggestions: (data?.suggestions ?? []) as PackagingSuggestionRule[],
            filters: data?.filters ?? {},
        }
    } catch (e) {
        console.error('Failed to fetch packaging suggestions:', e)
        return { count: 0, suggestions: [], filters: {} }
    }
}

export async function createPackagingRule(data: Omit<PackagingSuggestionRule, 'id'>) {
    const result = await erpFetch('packaging-suggestions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/units')
    revalidatePath('/inventory/packaging-suggestions')
    return result
}

export async function updatePackagingRule(id: number, data: Partial<PackagingSuggestionRule>) {
    const result = await erpFetch(`packaging-suggestions/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/units')
    revalidatePath('/inventory/packaging-suggestions')
    return result
}

export async function deletePackagingRule(id: number) {
    await erpFetch(`packaging-suggestions/${id}/`, { method: 'DELETE' })
    revalidatePath('/inventory/units')
    revalidatePath('/inventory/packaging-suggestions')
    return { success: true }
}

/**
 * Bump usage_count on a rule — called when the user accepts a suggestion
 * during product creation. Powers the "most-used first" ordering.
 */
export async function acceptPackagingSuggestion(ruleId: number) {
    try {
        return await erpFetch(`packaging-suggestions/${ruleId}/accept/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        })
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to accept suggestion:', e)
        return null
    }
}
