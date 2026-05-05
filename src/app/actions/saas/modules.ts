'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { revalidatePath, revalidateTag } from 'next/cache'

// Both getSaaSModules and getDynamicSidebar are layout chrome — fired on
// every privileged page render. HTTP fetch cache (per-user via
// Authorization header) keeps them cheap for 5 min. Tag `sidebar` busts
// both at once when modules install/uninstall.
export async function getSaaSModules() {
    try {
        return await erpFetch('saas/modules/', {
            next: { revalidate: 300, tags: ['saas-modules', 'sidebar'] },
        } as any)
    } catch (e) {
        handleAuthError(e)
        console.error("Failed to fetch SaaS modules:", e)
        return []
    }
}

export async function getModuleDependencyGraph(organizationId?: string) {
    try {
        const q = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : ''
        return await erpFetch(`saas/modules/dependency-graph/${q}`)
    } catch (e) {
        console.error('Failed to fetch module dependency graph:', e)
        return { nodes: [], edges: [], organization_id: organizationId ?? null }
    }
}

export async function getDynamicSidebar() {
    try {
        return await erpFetch('saas/modules/sidebar/', {
            next: { revalidate: 300, tags: ['dynamic-sidebar', 'sidebar'] },
        } as any)
    } catch (e) {
        handleAuthError(e)
        console.error("Failed to fetch dynamic sidebar:", e)
        return []
    }
}

/** Bust both sidebar caches in one call (after module install/uninstall). */
export async function revalidateSidebarCache() {
    revalidateTag('sidebar')
}

export async function getActiveModules() {
    try {
        const modules = await erpFetch('modules/')
        if (Array.isArray(modules)) {
            return modules.filter((m: Record<string, any>) => m.status === 'INSTALLED').map((m: Record<string, any>) => m.code)
        }
        return []
    } catch (e) {
        handleAuthError(e)
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
        revalidateTag('sidebar')
        return data
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}

export async function installModuleGlobal(code: string) {
    try {
        const data = await erpFetch(`saas/modules/${code}/install_global/`, {
            method: 'POST'
        })
        revalidatePath('/modules')
        revalidateTag('sidebar')
        return data
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}

export async function uninstallModuleGlobal(code: string) {
    try {
        const data = await erpFetch(`saas/modules/${code}/uninstall_global/`, {
            method: 'POST'
        })
        revalidatePath('/modules')
        revalidateTag('sidebar')
        return data
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}

export async function deleteModule(code: string) {

    try {
        const data = await erpFetch(`saas/modules/${code}/delete_module/`, {
            method: 'POST'
        })

        revalidatePath('/modules')
        return data
    } catch (e: unknown) {
        console.error(`[deleteModule] Error:`, (e instanceof Error ? e.message : String(e)))
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}

// ... existing exports ...

export async function getModuleBackups(code: string) {
    try {
        return await erpFetch(`saas/modules/${code}/backups/`)
    } catch (e) {
        handleAuthError(e)
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
        revalidateTag('sidebar')
        return data
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
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
    } catch (e: unknown) {
        console.error(`[uploadModule] Error:`, (e instanceof Error ? e.message : String(e)))
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}

export async function getOrgModules(orgId: string) {
    try {
        return await erpFetch(`saas/org-modules/${orgId}/modules/`)
    } catch (e) {
        handleAuthError(e)
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
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
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
    } catch (e: unknown) {
        return { error: (e instanceof Error ? e.message : String(e)) }
    }
}
