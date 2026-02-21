'use server'

import { revalidatePath } from "next/cache"

export type FinancialAccountInput = {
    name: string
    type: 'CASH' | 'BANK' | 'MOBILE'
    currency: string
    siteId?: number | null
}

import { serialize } from "@/lib/utils"

import { erpFetch } from "@/lib/erp-api"

export async function getFinancialAccounts() {
    try {
        return await erpFetch('accounts/')
    } catch (error) {
        console.error("Failed to fetch financial accounts:", error)
        return []
    }
}

export async function createFinancialAccount(data: FinancialAccountInput) {
    try {
        const result = await erpFetch('accounts/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        revalidatePath('/finance/accounts')
        return { success: true, id: result.id, ledgerCode: result.ledger_code }
    } catch (error: unknown) {
        console.error("Failed to create financial account:", error)
        throw error
    }
}

export async function assignUserToAccount(userId: number, accountId: number) {
    try {
        await erpFetch(`accounts/${accountId}/assign_user/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        })
        revalidatePath('/finance/accounts')
        return { success: true }
    } catch (e: unknown) {
        console.error("Failed to assign user:", e);
        throw e;
    }
}

export async function unassignUser(userId: number, accountId: number) {
    try {
        await erpFetch(`accounts/${accountId}/remove_user/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        })
        revalidatePath('/finance/accounts')
        return { success: true }
    } catch (e: unknown) {
        console.error("Failed to unassign user:", e);
        throw e;
    }
}

export async function deleteFinancialAccount(id: number) {
    try {
        await erpFetch(`accounts/${id}/`, { method: 'DELETE' })
        revalidatePath('/finance/accounts')
        return { success: true }
    } catch (e: unknown) {
        // Backend should handle "cannot delete if transactions exist" logic and return 400
        console.error("Failed to delete account:", e);
        throw new Error((e instanceof Error ? e.message : String(e)) || "Failed to delete account");
    }
}

export async function getOrgCurrency(): Promise<string> {
    try {
        const me = await erpFetch('auth/me/')
        // Organization base_currency is a FK, returned as object with code
        return me?.organization?.base_currency_code || me?.organization?.currency || 'USD'
    } catch {
        return 'USD'
    }
}

export async function getAccountBalance(accountId: number) {
    try {
        const coa = await erpFetch(`coa/${accountId}/statement/`)
        return {
            balance: coa?.opening_balance ?? 0,
            entries: coa?.lines?.length ?? 0
        }
    } catch {
        return { balance: 0, entries: 0 }
    }
}