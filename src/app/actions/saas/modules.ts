'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export async function getSaaSModules() {
    try {
        // Force bypass any caching
        return await erpFetch(`saas/modules/?_t=${Date.now()}`)
    } catch (e) {
        console.error("Failed to fetch SaaS modules:", e)
        return []
    }
}

export async function getDynamicSidebar() {
    try {
        return await erpFetch('saas/modules/sidebar/')
    } catch (e) {
        console.error("Failed to fetch dynamic sidebar:", e)
        return []
    }
}

export async function getActiveModules() {
    try {
        const modules = await erpFetch('modules/')
        if (Array.isArray(modules)) {
            return modules.filter((m: any) => m.status === 'INSTALLED').map((m: any) => m.code)
        }
        return []
    } catch (e) {
        console.error("Failed to fetch active modules:", e)
        return []
    }
}

export async function syncModulesGlobal() {
    try {
        const data = await erpFetch('saas/modules/sync_global/', {
            method: 'POST'
        })
        revalidatePath('/modules')
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
        revalidatePath('/modules')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function uninstallModuleGlobal(code: string) {
    try {
        const data = await erpFetch(`saas/modules/${code}/uninstall_global/`, {
            method: 'POST'
        })
        revalidatePath('/modules')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function deleteModule(code: string) {

    try {
        const data = await erpFetch(`saas/modules/${code}/delete_module/`, {
            method: 'POST'
        })

        revalidatePath('/modules')
        return data
    } catch (e: any) {
        console.error(`[deleteModule] Error:`, e.message)
        return { error: e.message }
    }
}

// ... existing exports ...

export async function getModuleBackups(code: string) {
    try {
        return await erpFetch(`saas/modules/${code}/backups/`)
    } catch (e) {
        console.error("Failed to fetch backups:", e)
        return []
    }
}

export async function rollbackModule(code: string, targetVersion: string) {
    try {
        const data = await erpFetch(`saas/modules/${code}/rollback_module/`, {
            method: 'POST',
            body: JSON.stringify({ target_version: targetVersion })
        })
        revalidatePath('/modules')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function uploadModule(formData: FormData) {

    try {
        // erpFetch needs to be careful with FormData (browser handles boundaries usually)
        // For server actions, we need to pass it through.
        const res = await erpFetch('saas/modules/upload_module/', {
            method: 'POST',
            body: formData,
            // DO NOT set Content-Type header manually for FormData
        })

        revalidatePath('/modules')
        return res
    } catch (e: any) {
        console.error(`[uploadModule] Error:`, e.message)
        return { error: e.message }
    }
}

export async function getOrgModules(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/modules/`)
    } catch (e) {
        console.error("Failed to fetch org modules:", e)
        return []
    }
}

export async function toggleOrgModule(orgId: string, moduleCode: string, action: 'enable' | 'disable') {
    try {
        const data = await erpFetch(`saas/org-modules/${orgId}/toggle_module/`, {
            method: 'POST',
            body: JSON.stringify({ module_code: moduleCode, action: action })
        })
        revalidatePath('/organizations')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function updateOrgModuleFeatures(orgId: string, moduleCode: string, features: string[]) {
    try {
        const data = await erpFetch(`saas/org-modules/${orgId}/update_features/`, {
            method: 'POST',
            body: JSON.stringify({ module_code: moduleCode, features: features })
        })
        revalidatePath('/organizations')
        return data
    } catch (e: any) {
        return { error: e.message }
    }
}
