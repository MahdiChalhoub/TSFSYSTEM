'use server'

import { createFinancialEvent, postFinancialEvent, FinancialEventInput } from "./financial-events"

export async function postFinancialEventFromUI(eventId: number, financialAccountId: number) {
    // Backend handles the ledger account resolution via FinancialAccount.ledger_account
    return await postFinancialEvent(eventId, financialAccountId, 0) // ledgerAccountId is ignored by backend now
}

export async function createAndPostFinancialEvent(data: FinancialEventInput & { targetAccountId: number }) {
    // 1. Create with immediate posting if targetAccountId is provided
    const createRes = await createFinancialEvent({
        ...data,
        targetAccountId: data.targetAccountId
    })

    return { success: true, eventId: createRes.eventId }
}
