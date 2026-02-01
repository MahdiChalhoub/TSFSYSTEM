'use server'

import { prisma } from "@/lib/db"
import { postFinancialEvent } from "./financial-events"

export async function postFinancialEventFromUI(eventId: number, financialAccountId: number) {
    // 1. Find Default Cash Account (Ledger) -> 5700
    // In a real app, we'd map FinancialAccount -> LedgerAccount.
    // Here we default to '5700' (Main Cash).
    const cashAccount = await prisma.chartOfAccount.findFirst({
        where: { code: '5700' }
    })

    if (!cashAccount) {
        throw new Error("Default Cash Account (5700) not found in Ledger.")
    }

    // 2. Call the core logic
    return await postFinancialEvent(eventId, financialAccountId, cashAccount.id)
}

import { createFinancialEvent, FinancialEventInput } from "./financial-events"

export async function createAndPostFinancialEvent(data: FinancialEventInput & { targetAccountId: number }) {
    // 1. Create Draft
    const createRes = await createFinancialEvent(data)
    if (!createRes.success || !createRes.eventId) {
        throw new Error("Failed to create draft event")
    }

    // 2. Find Ledger Account for the Financial Account (Simplified: Default to Cash 5700)
    // TODO: Improve mapping using FinancialAccount -> LinkedLedgerAccount
    const cashAccount = await prisma.chartOfAccount.findFirst({
        where: { code: '5700' }
    })
    if (!cashAccount) throw new Error("Default Cash Account (5700) not found")

    // 3. Post
    // Note: If post fails, we leave it as DRAFT (which is safe). 
    // Ideally we wrap in transaction, but these are separate actions right now. 
    // For UI speed, this sequence is acceptable.
    await postFinancialEvent(createRes.eventId, data.targetAccountId, cashAccount.id)

    return { success: true, eventId: createRes.eventId }
}
