'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

export interface ModuleInfo {
    code: string
    name: string
    version: string
    description: string
    dependencies: string[]
    is_core: boolean
    status: 'INSTALLED' | 'DISABLED' | 'UNINSTALLED'
}

export async function getModules(): Promise<ModuleInfo[]> {
    try {
        return await erpFetch('modules/') as ModuleInfo[]
    } catch (e) {
        console.error("Failed to fetch modules:", e)
        return []
    }
}

export async function enableModule(code: string) {
    try {
        const data = await erpFetch(`/api/modules/${code}/enable/`, {
            method: 'POST'
        })
        revalidatePath('/settings/modules')
        return data as { message: string, error?: string }
    } catch (e: any) {
        try {
            return JSON.parse(e.message)
        } catch {
            return { error: e.message }
        }
    }
}

export async function disableModule(code: string) {
    try {
        const data = await erpFetch(`/api/modules/${code}/disable/`, {
            method: 'POST'
        })
        revalidatePath('/settings/modules')
        return data as { message: string, error?: string }
    } catch (e: any) {
        try {
            return JSON.parse(e.message)
        } catch {
            return { error: e.message }
        }
    }
}
