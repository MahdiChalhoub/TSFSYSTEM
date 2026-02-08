'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getOrganization(id: string) {
    try {
        console.log(`[SaaS Detail] Fetching org: organizations/${id}/`)
        const result = await erpFetch(`organizations/${id}/`)
        console.log(`[SaaS Detail] Org result:`, result ? 'OK' : 'null')
        return result
    } catch (error: any) {
        console.error(`[SaaS Detail] Error fetching org ${id}:`, error?.message || error)
        return null
    }
}

export async function getOrgUsage(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/usage/`)
    } catch (error) {
        console.error("[SaaS] Error fetching usage:", error)
        return null
    }
}

export async function getOrgBilling(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/billing/`)
    } catch (error) {
        console.error("[SaaS] Error fetching billing:", error)
        return []
    }
}

export async function getOrgModules(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/modules/`)
    } catch (error) {
        console.error("[SaaS] Error fetching modules:", error)
        return []
    }
}

export async function toggleOrgModule(orgId: string, moduleCode: string, action: 'enable' | 'disable') {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/toggle_module/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module_code: moduleCode, action })
        })
    } catch (error) {
        console.error("[SaaS] Error toggling module:", error)
        throw error
    }
}
