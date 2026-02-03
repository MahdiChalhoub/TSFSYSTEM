'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export async function getSaaSModules() {
    try {
        return await erpFetch('saas/modules/')
    } catch (e) {
        console.error("Failed to fetch SaaS modules:", e)
        return []
    }
}

export async function syncModulesGlobal() {
    try {
        const data = await erpFetch('saas/modules/sync_global/', {
            method: 'POST'
        })
        revalidatePath('/admin/saas/modules')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function installModuleGlobal(code: string) {
    try {
        const data = await erpFetch(`saas/modules/${code}/install_global/`, {
            method: 'POST'
        })
        revalidatePath('/admin/saas/modules')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function getOrgModules(orgId: string) {
    try {
        return await erpFetch(`/api/saas/org-modules/${orgId}/modules/`)
    } catch (e) {
        console.error("Failed to fetch org modules:", e)
        return []
    }
}

export async function toggleOrgModule(orgId: string, moduleCode: string, action: 'enable' | 'disable') {
    try {
        const data = await erpFetch(`/api/saas/org-modules/${orgId}/toggle_module/`, {
            method: 'POST',
            body: JSON.stringify({ module_code: moduleCode, action: action })
        })
        revalidatePath('/admin/saas/organizations')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}
