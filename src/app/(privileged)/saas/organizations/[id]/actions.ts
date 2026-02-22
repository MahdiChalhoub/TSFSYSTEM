'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getOrganization(id: string) {
    try {

        const result = await erpFetch(`organizations/${id}/`)

        return result
    } catch (error: unknown) {
        console.error(`[SaaS Detail] Error fetching org ${id}:`, (error as any)?.message || error)
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

export async function hotReloadModules() {
    try {
        return await erpFetch('saas/modules/hot_reload/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error("[SaaS] Error hot-reloading modules:", error)
        throw error
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

// ─── Client Management ──────────────────────────────────────────

export async function listClients(search?: string) {
    try {
        const q = search ? `?search=${encodeURIComponent(search)}` : ''
        return await erpFetch(`saas/clients/${q}`)
    } catch (error) {
        console.error("[SaaS] Error fetching clients:", error)
        return []
    }
}

export async function createClient(data: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    company_name?: string
    address?: string
    city?: string
    country?: string
}) {
    return await erpFetch(`saas/clients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function setOrgClient(orgId: string, clientId: string | null) {
    return await erpFetch(`saas/org-modules/${orgId}/set-client/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
    })
}

// ─── Add-on Management ──────────────────────────────────────────

export async function getOrgAddons(orgId: string) {
    try {
        return await erpFetch(`saas/plans/org-addons/${orgId}/`)
    } catch (error) {
        console.error("[SaaS] Error fetching org addons:", error)
        return { purchased: [], available: [] }
    }
}

export async function purchaseAddon(orgId: string, addonId: string, quantity: number = 1, billingCycle: string = 'MONTHLY') {
    return await erpFetch(`saas/plans/org-addons/${orgId}/purchase/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addon_id: addonId, quantity, billing_cycle: billingCycle })
    })
}

export async function cancelAddon(orgId: string, purchaseId: string) {
    return await erpFetch(`saas/plans/org-addons/${orgId}/cancel/${purchaseId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    })
}

// ─── Encryption Management ──────────────────────────────────────

export async function getOrgEncryptionStatus(orgId: string) {
    try {
        return await erpFetch('saas/modules/encryption/status/', {
            headers: { 'X-Org-Id': orgId }
        })
    } catch (error) {
        console.error("[SaaS] Error fetching encryption status:", error)
        return null
    }
}

export async function toggleOrgEncryption(orgId: string, action: 'activate' | 'deactivate') {
    return await erpFetch(`saas/modules/encryption/${action}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Id': orgId },
    })
}
