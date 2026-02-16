'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getDeferredExpenses() {
    return await erpFetch('deferred-expenses/')
}

export async function getDeferredExpense(id: number) {
    return await erpFetch(`deferred-expenses/${id}/`)
}

export type DeferredExpenseInput = {
    name: string
    description?: string
    category: string
    total_amount: number
    start_date: string
    duration_months: number
    source_account_id: number
    deferred_coa_id?: number
    expense_coa_id?: number
    scope?: string
}

export async function createDeferredExpense(data: DeferredExpenseInput) {
    try {
        const expense = await erpFetch('deferred-expenses/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/deferred-expenses')
        return { success: true, id: expense.id }
    } catch (e: any) {
        console.error("Create Deferred Expense Failed", e)
        throw e
    }
}

export async function recognizeDeferredExpense(id: number, periodDate: string) {
    try {
        const result = await erpFetch(`deferred-expenses/${id}/recognize/`, {
            method: 'POST',
            body: JSON.stringify({ period_date: periodDate })
        })
        revalidatePath('/finance/deferred-expenses')
        return { success: true, data: result }
    } catch (e: any) {
        console.error("Recognize Deferred Expense Failed", e)
        throw e
    }
}
