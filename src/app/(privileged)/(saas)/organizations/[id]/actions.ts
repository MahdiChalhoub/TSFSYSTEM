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

export async function updateModuleFeatures(orgId: string, moduleCode: string, features: string[]) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/update_features/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module_code: moduleCode, features })
        })
    } catch (error) {
        console.error("[SaaS] Error updating features:", error)
        throw error
    }
}

export async function changeOrgPlan(orgId: string, planId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/change-plan/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: planId })
        })
    } catch (error) {
        console.error("[SaaS] Error changing plan:", error)
        throw error
    }
}

// ─── User Management ─────────────────────────────────────────────

export async function getOrgUsers(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/users/`)
    } catch (error) {
        console.error("[SaaS] Error fetching users:", error)
        return []
    }
}

export async function createOrgUser(orgId: string, data: {
    username: string
    email?: string
    password: string
    first_name?: string
    last_name?: string
    is_superuser?: boolean
}) {
    return await erpFetch(`saas/org-modules/${orgId}/create_user/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function resetOrgUserPassword(orgId: string, userId: string, newPassword: string) {
    return await erpFetch(`saas/org-modules/${orgId}/reset_password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, new_password: newPassword })
    })
}

// ─── Site Management ─────────────────────────────────────────────

export async function getOrgSites(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/sites/`)
    } catch (error) {
        console.error("[SaaS] Error fetching sites:", error)
        return []
    }
}

export async function createOrgSite(orgId: string, data: {
    name: string
    code?: string
    address?: string
    city?: string
    phone?: string
    vat_number?: string
}) {
    return await erpFetch(`saas/org-modules/${orgId}/create_site/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function toggleOrgSite(orgId: string, siteId: string) {
    return await erpFetch(`saas/org-modules/${orgId}/toggle_site/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId })
    })
}
