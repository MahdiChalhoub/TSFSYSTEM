'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export type PostingRule = {
    key: string
    label: string
    description: string
    accountId: number | null
}

export type PostingRulesConfig = {
    sales: {
        receivable: number | null
        revenue: number | null
        cogs: number | null
        inventory: number | null
    }
    purchases: {
        payable: number | null
        inventory: number | null
        tax: number | null
    }
    inventory: {
        adjustment: number | null
        transfer: number | null
    }
    automation: {
        customerRoot: number | null
        supplierRoot: number | null
        payrollRoot: number | null
    }
    fixedAssets: {
        depreciationExpense: number | null
        accumulatedDepreciation: number | null
    }
    suspense: {
        reception: number | null
    }
    partners: {
        capital: number | null
        loan: number | null
        withdrawal: number | null
    }
}

const DEFAULT_CONFIG: PostingRulesConfig = {
    sales: { receivable: null, revenue: null, cogs: null, inventory: null },
    purchases: { payable: null, inventory: null, tax: null },
    inventory: { adjustment: null, transfer: null },
    automation: { customerRoot: null, supplierRoot: null, payrollRoot: null },
    fixedAssets: { depreciationExpense: null, accumulatedDepreciation: null },
    suspense: { reception: null },
    partners: { capital: null, loan: null, withdrawal: null }
}

export async function getPostingRules(tx?: any): Promise<PostingRulesConfig> {
    const db = tx || prisma
    const setting = await db.systemSettings.findUnique({
        where: { key: 'finance_posting_rules' }
    })

    if (!setting) return DEFAULT_CONFIG

    try {
        const stored = JSON.parse(setting.value)
        return {
            ...DEFAULT_CONFIG,
            ...stored,
            sales: { ...DEFAULT_CONFIG.sales, ...(stored.sales || {}) },
            purchases: { ...DEFAULT_CONFIG.purchases, ...(stored.purchases || {}) },
            inventory: { ...DEFAULT_CONFIG.inventory, ...(stored.inventory || {}) },
            automation: { ...DEFAULT_CONFIG.automation, ...(stored.automation || {}) },
            fixedAssets: { ...DEFAULT_CONFIG.fixedAssets, ...(stored.fixedAssets || {}) },
            suspense: { ...DEFAULT_CONFIG.suspense, ...(stored.suspense || {}) },
            partners: { ...DEFAULT_CONFIG.partners, ...(stored.partners || {}) }
        }
    } catch {
        return DEFAULT_CONFIG
    }
}

export async function savePostingRules(config: PostingRulesConfig, tx?: any) {
    const db = tx || prisma
    await db.systemSettings.upsert({
        where: { key: 'finance_posting_rules' },
        update: { value: JSON.stringify(config) },
        create: { key: 'finance_posting_rules', value: JSON.stringify(config) }
    })

    try {
        revalidatePath('/admin/finance/settings/posting-rules')
    } catch (e) {
        // Skip revalidation if called from a standalone script
    }
    return { success: true }
}

export async function applySmartPostingRules(tx?: any) {
    const db = tx || prisma
    // 1. Get all accounts
    const accounts = await db.chartOfAccount.findMany({
        where: { isActive: true },
        select: { id: true, code: true }
    })

    // 2. Load existing or default config
    const currentConfig = await getPostingRules(tx)
    const newConfig: PostingRulesConfig = JSON.parse(JSON.stringify(currentConfig))

    // Helper to find ID by code
    const find = (code: string) => accounts.find((a: any) => a.code === code)?.id || null

    // 3. Match logic (IFRS, Lebanese, French standard codes)
    newConfig.sales.receivable = find('1110') || find('1300') || newConfig.sales.receivable
    newConfig.sales.revenue = find('4100') || find('4101') || find('701') || newConfig.sales.revenue
    newConfig.sales.cogs = find('5100') || find('5101') || find('6000') || find('601') || newConfig.sales.cogs
    newConfig.sales.inventory = find('1120') || find('1121') || find('31') || newConfig.sales.inventory

    newConfig.purchases.payable = find('2101') || find('2100.1') || find('2100') || find('401') || newConfig.purchases.payable
    newConfig.purchases.inventory = find('1120') || find('5101') || find('6011') || find('607') || find('1121') || newConfig.purchases.inventory
    newConfig.purchases.tax = find('2111') || find('2110') || find('2300') || find('4456') || newConfig.purchases.tax

    newConfig.inventory.adjustment = find('5104') || find('9001') || find('709') || newConfig.inventory.adjustment
    newConfig.inventory.transfer = find('1120') || find('9002') || newConfig.inventory.transfer

    newConfig.automation.customerRoot = find('1110') || find('1111') || find('411') || newConfig.automation.customerRoot
    newConfig.automation.supplierRoot = find('2101') || find('2100.1') || find('401') || newConfig.automation.supplierRoot
    newConfig.automation.payrollRoot = find('2121') || find('2200') || find('421') || newConfig.automation.payrollRoot

    newConfig.fixedAssets.accumulatedDepreciation = find('1210') || find('1211') || find('281') || newConfig.fixedAssets.accumulatedDepreciation

    newConfig.suspense.reception = find('2102') || find('9004') || newConfig.suspense.reception

    newConfig.partners.capital = find('1010') || find('101') || find('3000') || newConfig.partners.capital
    newConfig.partners.loan = find('1600') || find('161') || find('2500') || newConfig.partners.loan
    newConfig.partners.withdrawal = find('4550') || find('455') || find('3100') || newConfig.partners.withdrawal

    // 4. Save the results
    await savePostingRules(newConfig, tx)
    return { success: true }
}
