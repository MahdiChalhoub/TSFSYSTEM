'use server'

import { erpFetch } from "@/lib/erp-api"
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
        round_off: number | null
        discount: number | null
        vat_collected: number | null
    }
    purchases: {
        payable: number | null
        inventory: number | null
        vat_recoverable: number | null
        airsi_payable: number | null
        reverse_charge_vat: number | null
        discount_earned: number | null
        delivery_fees: number | null
        airsi: number | null
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
    equity: {
        capital: number | null
        draws: number | null
    }
    tax: {
        vat_payable: number | null
        vat_refund_receivable: number | null
    }
}

const EMPTY_CONFIG: PostingRulesConfig = {
    sales: { receivable: null, revenue: null, cogs: null, inventory: null, round_off: null, discount: null, vat_collected: null },
    purchases: { payable: null, inventory: null, vat_recoverable: null, airsi_payable: null, reverse_charge_vat: null, discount_earned: null, delivery_fees: null, airsi: null },
    inventory: { adjustment: null, transfer: null },
    automation: { customerRoot: null, supplierRoot: null, payrollRoot: null },
    fixedAssets: { depreciationExpense: null, accumulatedDepreciation: null },
    suspense: { reception: null },
    partners: { capital: null, loan: null, withdrawal: null },
    equity: { capital: null, draws: null },
    tax: { vat_payable: null, vat_refund_receivable: null },
}

export async function getPostingRules(): Promise<PostingRulesConfig> {
    try {
        return await erpFetch('settings/posting_rules/')
    } catch (error) {
        console.error("Failed to fetch posting rules:", error)
        return EMPTY_CONFIG
    }
}

export async function savePostingRules(config: PostingRulesConfig) {
    try {
        await erpFetch('settings/posting_rules/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch (error) {
        console.error("Failed to save posting rules:", error)
        return { success: false }
    }
}

export async function applySmartPostingRules() {
    try {
        await erpFetch('settings/smart_apply/', {
            method: 'POST'
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch (error) {
        console.error("Failed to apply smart posting rules:", error)
        return { success: false }
    }
}