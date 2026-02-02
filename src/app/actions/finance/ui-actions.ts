'use server'

import { prisma } from "@/lib/db"
import { postFinancialEvent } from "./financial-events"

export async function postFinancialEventFromUI(eventId: number, financialAccountId: number) {
    // 1. Resolve Ledger Account from Financial Account
    const financialAccount = await prisma.financialAccount.findUnique({
        where: { id: financialAccountId },
        include: { site: true }
        // We'll need a mapping field. 
        // Current Schema: FinancialAccount does NOT have a direct 'linkedAccountId'.
        // It's usually '5700' for Cash, '5120' for Bank.
        // We should add `linkedAccountId` to `FinancialAccount` model or use a convention.
        // FOR NOW: Let's assume code '5700' is hardcoded ONLY if no better logic.
        // Better: Let's look up the FinancialAccount type.
    })

    if (!financialAccount) throw new Error("Financial Account not found")

    // Dynamic Linking Logic (Temporary until Schema Update)
    let ledgerSearchCode = '5700' // Default Cash
    if (financialAccount.type === 'BANK') ledgerSearchCode = '5120' // Default Bank
    if (financialAccount.type === 'MOBILE') ledgerSearchCode = '5121' // Default Mobile Wallet

    // Try to find exact ledger account by name or code?
    // TODO: Add `linkedAccountId` to FinancialAccount schema for 100% precision.
    const ledgerAccount = await prisma.chartOfAccount.findFirst({
        where: { code: ledgerSearchCode }
    })

    if (!ledgerAccount) {
        throw new Error(`Ledger Account for ${financialAccount.type} (${ledgerSearchCode}) not found.`)
    }

    // 2. Call the core logic
    return await postFinancialEvent(eventId, financialAccountId, ledgerAccount.id)
}

import { createFinancialEvent, FinancialEventInput } from "./financial-events"

export async function createAndPostFinancialEvent(data: FinancialEventInput & { targetAccountId: number }) {
    // 1. Create Draft
    const createRes = await createFinancialEvent(data)
    if (!createRes.success || !createRes.eventId) {
        throw new Error("Failed to create draft event")
    }

    // 2. Find Ledger Account for the Financial Account
    const financialAccount = await prisma.financialAccount.findUnique({
        where: { id: data.targetAccountId }
    })
    if (!financialAccount) throw new Error("Selected Financial Account not found")

    // Mapping Logic:
    let ledgerSearchCode = '5700'
    if (financialAccount.type === 'BANK') ledgerSearchCode = '5120'
    if (financialAccount.type === 'MOBILE') ledgerSearchCode = '5121'

    const ledgerAccount = await prisma.chartOfAccount.findFirst({
        where: { code: ledgerSearchCode }
    })
    if (!ledgerAccount) throw new Error(`Ledger Account (${ledgerSearchCode}) not found due to missing configuration `)

    // 3. Post
    await postFinancialEvent(createRes.eventId, data.targetAccountId, ledgerAccount.id)

    return { success: true, eventId: createRes.eventId }
}
