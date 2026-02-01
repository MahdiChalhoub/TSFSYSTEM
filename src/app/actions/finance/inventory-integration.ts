'use server'

import { prisma } from "@/lib/db"
import { getPostingRules } from "./posting-rules"
import { createJournalEntry } from "./ledger"
import { revalidatePath } from "next/cache"
import { Decimal } from "@prisma/client/runtime/library"

export async function getInventoryValuation() {
    // Calculate total value across all warehouses
    // We use the product's moving average cost (costPrice)
    const inventory = await prisma.inventory.findMany({
        include: {
            product: {
                include: {
                    unit: true
                }
            }
        }
    })

    let totalValue = new Decimal(0)
    inventory.forEach(item => {
        // Since costPrice is stored in the Base Unit (standardization), 
        // and item.quantity is also assumed to be in the Base Unit (base storage),
        // we multiply directly. 
        // If eventually we store item.quantity in DIFFERENT units per row, 
        // we'd use convertQuantity here.
        totalValue = totalValue.add(new Decimal(item.quantity.toString()).mul(new Decimal(item.product.costPrice.toString())))
    })

    return {
        totalValue: totalValue.toNumber(),
        itemCount: inventory.length,
        timestamp: new Date()
    }
}

export async function getInventoryFinancialStatus() {
    const valuation = await getInventoryValuation()
    const rules = await getPostingRules()

    if (!rules.sales.inventory) {
        return {
            ...valuation,
            ledgerBalance: 0,
            discrepancy: 0,
            isMapped: false
        }
    }

    const account = await prisma.chartOfAccount.findUnique({
        where: { id: rules.sales.inventory }
    })

    const ledgerBalance = Number(account?.balance || 0)
    const discrepancy = valuation.totalValue - ledgerBalance

    return {
        ...valuation,
        ledgerBalance,
        discrepancy,
        isMapped: true,
        accountName: account?.name,
        accountCode: account?.code
    }
}

export async function syncInventoryValueToLedger() {
    const status = await getInventoryFinancialStatus()
    if (!status.isMapped) throw new Error("Inventory Asset account is not mapped in Posting Rules.")
    if (Math.abs(status.discrepancy) < 0.01) return { success: true, message: "Ledger is already in sync." }

    const rules = await getPostingRules()

    // We need an adjustment account. We'll use inventory.adjustment from rules.
    if (!rules.inventory.adjustment) throw new Error("Inventory Adjustment account is not mapped in Posting Rules.")

    const absDiff = Math.abs(status.discrepancy)
    const isGain = status.discrepancy > 0 // We have more physical value than in ledger -> Debit Asset, Credit Adjustment

    // Create a Journal Entry
    const entryData = {
        transactionDate: new Date(),
        description: `Inventory Valuation Sync: Physical Reality vs Ledger.`,
        reference: "STOCK-SYNC",
        status: "POSTED" as const,
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

    // We need to find the fiscal year/period info
    // However, createJournalEntry usually handles this if called via server action,
    // but we need to pass the IDs if we are calling it internally.
    // Or we just use prisma directly here to be safer.

    // For now, let's use the standard createJournalEntry but we need to make sure 
    // it can find the fiscal year.

    // I will use a simplified version for now since I'm in the action.
    const res = await createJournalEntry(entryData as any)

    revalidatePath('/admin/finance/dashboard')
    revalidatePath('/admin/finance/ledger')

    return {
        success: true,
        message: `Synced ${absDiff.toFixed(2)} to ledger.`,
        entryId: (res as any).entryId
    }
}
