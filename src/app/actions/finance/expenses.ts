'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getExpenses() {
    return await erpFetch('expenses/')
}

export async function getExpense(id: number) {
    return await erpFetch(`expenses/${id}/`)
}

export type ExpenseInput = {
    name: string
    description?: string
    category: string
    amount: number
    date: string
    source_account_id?: number
    expense_coa_id?: number
    scope?: string
}

export type ExpenseUpdateInput = {
    name?: string
    description?: string
    category?: string
    amount?: number
    date?: string
    source_account_id?: number
    expense_coa_id?: number
}

export async function createExpense(data: ExpenseInput) {
    if (!data.amount || data.amount <= 0) {
        throw new Error('Expense amount must be greater than zero.')
    }
    try {
        const expense = await erpFetch('expenses/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/expenses')
        return { success: true, id: expense.id }
    } catch (e: unknown) {
        console.error("Create Expense Failed", e)
        throw e
    }
}

export async function updateExpense(id: number, data: ExpenseUpdateInput) {
    try {
        const expense = await erpFetch(`expenses/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/expenses')
        return { success: true, data: expense }
    } catch (e: unknown) {
        console.error("Update Expense Failed", e)
        throw e
    }
}

export async function deleteExpense(id: number) {
    try {
        await erpFetch(`expenses/${id}/`, { method: 'DELETE' })
        revalidatePath('/finance/expenses')
        return { success: true }
    } catch (e: unknown) {
        console.error("Delete Expense Failed", e)
        throw e
    }
}

export async function postExpense(id: number) {
    try {
        const result = await erpFetch(`expenses/${id}/post_expense/`, {
            method: 'POST'
        })
        revalidatePath('/finance/expenses')
        return { success: true, data: result }
    } catch (e: unknown) {
        console.error("Post Expense Failed", e)
        throw e
    }
}

export async function cancelExpense(id: number) {
    try {
        const result = await erpFetch(`expenses/${id}/cancel_expense/`, {
            method: 'POST'
        })
        revalidatePath('/finance/expenses')
        return { success: true, data: result }
    } catch (e: unknown) {
        console.error("Cancel Expense Failed", e)
        throw e
    }
}
