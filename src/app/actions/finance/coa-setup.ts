'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export type COASetupStatus =
    | 'NOT_STARTED'
    | 'TEMPLATE_SELECTED'
    | 'TEMPLATE_IMPORTED'
    | 'MIGRATION_PENDING'
    | 'POSTING_RULES_PENDING'
    | 'COMPLETED'

export type COASetupState = {
    status: COASetupStatus
    selectedTemplate: string | null
    importedAt: string | null
    postingRulesConfigured: boolean
    migrationNeeded: boolean
    migrationCompleted: boolean
    completedAt: string | null
}

const DEFAULT_STATE: COASetupState = {
    status: 'NOT_STARTED',
    selectedTemplate: null,
    importedAt: null,
    postingRulesConfigured: false,
    migrationNeeded: false,
    migrationCompleted: false,
    completedAt: null,
}

export async function getCOASetupStatus(): Promise<COASetupState> {
    try {
        const result = await erpFetch('settings/coa_setup/')
        return { ...DEFAULT_STATE, ...result }
    } catch {
        return DEFAULT_STATE
    }
}

export async function updateCOASetupStatus(updates: Partial<COASetupState>): Promise<{ success: boolean }> {
    try {
        await erpFetch('settings/coa_setup/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
        revalidatePath('/finance')
        revalidatePath('/finance/setup')
        return { success: true }
    } catch (error) {
        console.error("Failed to update COA setup status:", error)
        return { success: false }
    }
}

export async function completeCOASetup(): Promise<{ success: boolean }> {
    return updateCOASetupStatus({
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
    })
}

export async function isCOASetupComplete(): Promise<boolean> {
    const state = await getCOASetupStatus()
    return state.status === 'COMPLETED'
}
export async function resetCOASetup(): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch('settings/coa_setup/?reset=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset: true })
        })
        revalidatePath('/finance')
        revalidatePath('/finance/setup')
        revalidatePath('/finance/chart-of-accounts')
        return { success: true }
    } catch (error) {
        console.error("Failed to reset COA setup:", error)
        return { success: false, error: error instanceof Error ? error.message : "Reset failed" }
    }
}
