'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getPlanDetail(id: string) {
    try {
        return await erpFetch(`saas/plans/${id}/`)
    } catch (error: any) {
        console.error("[SaaS] Error fetching plan detail:", error)
        return null
    }
}

export async function updatePlan(id: string, data: any) {
    return await erpFetch(`saas/plans/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function togglePlanPublic(id: string) {
    return await erpFetch(`saas/plans/${id}/toggle_public/`, {
        method: 'POST',
    })
}

export async function getAddons() {
    try {
        return await erpFetch('saas/plans/addons/')
    } catch (error: any) {
        console.error("[SaaS] Error fetching addons:", error)
        return []
    }
}

export async function createAddon(data: any) {
    return await erpFetch('saas/plans/addons/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function updateAddon(id: string, data: any) {
    return await erpFetch(`saas/plans/addons/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
}

export async function deleteAddon(id: string) {
    return await erpFetch(`saas/plans/addons/${id}/`, {
        method: 'DELETE',
    })
}
