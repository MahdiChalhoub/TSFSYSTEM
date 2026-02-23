'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from 'next/cache'

export type FinancialSettingsState = {
    companyType?: string
    currency?: string
    defaultTaxRate?: number
    salesTaxPercentage?: number
    purchaseTaxPercentage?: number
    worksInTTC?: boolean
    allowHTEntryForTTC?: boolean
    declareTVA?: boolean
    dualView?: boolean
    customTaxRules?: string
    pricingCostBasis?: string
    officialAccessPin?: string
    // Auto-Declaration & Protection Strategy (Sales/POS)
    autoDeclarationEnabled?: boolean
    autoDeclareThreshold?: number // Transactions > X are always OFFICIAL
    autoDeclareThresholdMode?: 'ABOVE' | 'BELOW'
    autoDeclarePercentage?: number // X% of transactions <= Threshold are OFFICIAL

    // Advanced Rules Engine (Rules of Engagement)
    declarationRules?: {
        id: string
        name: string
        startTime: string // "HH:mm"
        endTime: string // "HH:mm"
        maxTransactionAmount?: number
        minTransactionAmount?: number
        limitDailyTurnover?: number // Stop rule if total declared > X
        allowedMethods?: string[] // ["CASH", "WAVE", "OM"]
        allowedAccountIds?: number[] // For "WAVE Declared vs WAVE Internal" scenarios
        forceScope: 'OFFICIAL' | 'INTERNAL'
    }[]

    // Emergency & Integrity Controls
    emergencyForceDeclared?: boolean // Panic button: everything becomes OFFICIAL
    highValueAlertThreshold?: number // Amount > X asks for user confirmation
    autoDeclareDailyLimit?: number // Max daily amount to route to OFFICIAL
    controllableAccountIds?: number[] // Wallets/Banks that MUST be OFFICIAL
    integrityAlertEnabled?: boolean // Alert cashier when daily limit reached
}

export async function getSettingsLockStatus() {
    // For now, always return unlocked to allow smooth migration.
    // In production, we'd check if fiscal year is open or there are posted entries.
    return { isLocked: false, reason: null }
}

export async function getFinancialSettings() {
    try {
        const result = await erpFetch('settings/global_financial/')
        return {
            ...result,
            defaultTaxRate: Number(result.defaultTaxRate),
            salesTaxPercentage: Number(result.salesTaxPercentage),
            purchaseTaxPercentage: Number(result.purchaseTaxPercentage),
        }
    } catch (error: unknown) {
        const isContextError = (error instanceof Error ? error.message : String(error)) && (error instanceof Error ? error.message : String(error)).includes('No organization context');

        if (!isContextError) {
            console.error("Failed to fetch settings:", error)
        }

        return {
            companyType: 'REGULAR',
            currency: 'USD',
            defaultTaxRate: 0.11,
            salesTaxPercentage: 0,
            purchaseTaxPercentage: 0
        }
    }
}

export async function updateFinancialSettings(data: FinancialSettingsState) {
    try {
        await erpFetch('settings/global_financial/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/settings')
        return { success: true }
    } catch (error) {
        console.error("Failed to update settings:", error)
        return { success: false }
    }
}