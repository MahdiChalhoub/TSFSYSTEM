'use server'

import { erpFetch } from "@/lib/erp-api"
import { createJournalEntry } from "./ledger"
import { revalidatePath } from "next/cache"
import { getPostingRules } from "./posting-rules"

export async function getInventoryValuation() {
    try {
        const result = await erpFetch('inventory/valuation/')
        return result
    } catch (e) {
        console.error("Valuation Error:", e)
        return { totalValue: 0, itemCount: 0, timestamp: new Date() }
    }
}

export async function getInventoryFinancialStatus() {
    try {
        const result = await erpFetch('inventory/financial_status/')
        // Map snake_case from Django to camelCase for frontend expectations if needed
        return {
            totalValue: Number(result.total_value),
            itemCount: result.item_count,
            timestamp: result.timestamp,
            ledgerBalance: Number(result.ledger_balance),
            discrepancy: Number(result.discrepancy),
            isMapped: result.is_mapped,
            accountName: result.account_name,
            accountCode: result.account_code
        }
    } catch (e) {
        console.error("Status Error:", e)
        return { totalValue: 0, itemCount: 0, discrepancy: 0, isMapped: false }
    }
}



export async function syncInventoryValueToLedger() {
    const status = await getInventoryFinancialStatus()
    if (!status.isMapped) throw new Error("Inventory Asset account is not mapped in Posting Rules.")
    if (Math.abs(status.discrepancy) < 0.01) return { success: true, message: "Ledger is already in sync." }

    const rules = await getPostingRules()

    if (!rules.inventory?.adjustment) throw new Error("Inventory Adjustment account is not mapped in Posting Rules.")

    const absDiff = Math.abs(status.discrepancy)
    const isGain = status.discrepancy > 0

    const entryData = {
        transactionDate: new Date(),
        description: `Inventory Valuation Sync: Physical Reality vs Ledger.`,
        reference: `STOCK-SYNC-${Date.now()}`,
        status: "POSTED",
        lines: [
            {
                accountId: rules.sales.inventory!,
                debit: isGain ? absDiff : 0,
                credit: isGain ? 0 : absDiff,
                description: `Inventory Asset Adjustment (${isGain ? 'Inflow/Gain' : 'Outflow/Loss'})`
            },
            {
                accountId: rules.inventory.adjustment!,
                debit: isGain ? 0 : absDiff,
                credit: isGain ? absDiff : 0,
                description: `Counterpart for Inventory Sync`
            }
        ]
    }

    const res = await createJournalEntry(entryData)

    revalidatePath('/admin/finance/dashboard')
    revalidatePath('/admin/finance/ledger')

    return {
        success: true,
        message: `Synced ${absDiff.toFixed(2)} to ledger.`,
        entryId: res.id
    }
}
