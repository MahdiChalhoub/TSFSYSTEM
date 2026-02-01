'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// Using similar type definition structure as User/Product
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
}

export async function getSettingsLockStatus() {
    // 1. Check for any OPEN fiscal years
    const openYear = await prisma.fiscalYear.findFirst({
        where: { status: 'OPEN' }
    })

    // 2. Check for any POSTED transactions
    const postedEntries = await prisma.journalEntry.count({
        where: { status: 'POSTED' }
    })

    if (openYear) return { isLocked: true, reason: `Fiscal Year "${openYear.name}" is currently OPEN. Core configuration is locked until year-end closure.` }
    if (postedEntries > 0) return { isLocked: true, reason: `System contains ${postedEntries} posted journal entries. Structural changes must be performed between fiscal cycles.` }

    return { isLocked: false, reason: null }
}

export async function getFinancialSettings() {
    // @ts-ignore
    let settings = await prisma.financialSettings.findFirst()

    // Auto-create if missing (failsafe)
    if (!settings) {
        // @ts-ignore
        settings = await prisma.financialSettings.create({
            data: {
                companyType: 'REGULAR',
                currency: 'USD',
                defaultTaxRate: 0.11,
            }
        })
    }

    return {
        ...settings,
        defaultTaxRate: Number(settings.defaultTaxRate),
        salesTaxPercentage: Number(settings.salesTaxPercentage),
        purchaseTaxPercentage: Number(settings.purchaseTaxPercentage),
    }
}

export async function updateFinancialSettings(data: FinancialSettingsState) {
    const current = await getFinancialSettings()
    const lock = await getSettingsLockStatus()

    // Protected Fields
    const isStructuralChange =
        current.companyType !== data.companyType ||
        current.currency !== data.currency ||
        current.worksInTTC !== data.worksInTTC ||
        current.declareTVA !== data.declareTVA

    if (lock.isLocked && isStructuralChange) {
        throw new Error(`CRITICAL VIOLATION: ${lock.reason}`)
    }

    // @ts-ignore
    await prisma.financialSettings.update({
        where: { id: current.id },
        data: {
            companyType: data.companyType,
            currency: data.currency,
            defaultTaxRate: data.defaultTaxRate,
            salesTaxPercentage: data.salesTaxPercentage,
            purchaseTaxPercentage: data.purchaseTaxPercentage,

            // Custom flags
            worksInTTC: data.worksInTTC,
            allowHTEntryForTTC: data.allowHTEntryForTTC,
            declareTVA: data.declareTVA,
            dualView: data.dualView,

            customTaxRules: data.customTaxRules
        }
    })

    revalidatePath('/admin/finance/settings')
    return { success: true }
}
