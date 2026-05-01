'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'

/**
 * Fetch the effective ListViewPolicy for a specific view key.
 * Returns merged policy from SaaS → Org → Global cascade.
 */
export async function getListViewPolicy(viewKey: string) {
    try {
        const res = await erpFetch(`listview-policies/resolve/${viewKey}/`)
        return res ?? null
    } catch (error) {
        handleAuthError(error)
        return null
    }
}

/**
 * Fetch policies for multiple view keys at once.
 */
export async function getListViewPoliciesBulk(viewKeys: string[]) {
    try {
        const res = await erpFetch(`listview-policies/resolve-bulk/?keys=${viewKeys.join(',')}`)
        return res ?? {}
    } catch (error) {
        handleAuthError(error)
        return {}
    }
}

/**
 * CRUD for SaaS admins — create/update a policy
 */
export async function saveListViewPolicy(data: {
    id?: number
    organization?: string | null
    view_key: string
    config: Record<string, unknown>
    notes?: string
}) {
    if (data.id) {
        return erpFetch(`listview-policies/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
    }
    return erpFetch(`listview-policies/`, { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteListViewPolicy(id: number) {
    return erpFetch(`listview-policies/${id}/`, { method: 'DELETE' })
}

export async function listAllPolicies() {
    return erpFetch(`listview-policies/`)
}

/**
 * Get available model keys that can be configured.
 */
export async function getAvailableModels() {
    try {
        return await erpFetch(`listview-policies/available-models/`)
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

/**
 * Get all fields for a specific model (for toggle UI).
 */
export async function getModelFields(modelKey: string) {
    try {
        return await erpFetch(`listview-policies/model-fields/${modelKey}/`)
    } catch (error) {
        handleAuthError(error)
        return null
    }
}
