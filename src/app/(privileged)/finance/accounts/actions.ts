'use server'

import { revalidatePath } from "next/cache"

export type FinancialAccountInput = {
    name: string
    type: 'CASH' | 'BANK' | 'MOBILE' | 'PETTY_CASH' | 'SAVINGS' | 'FOREIGN' | 'ESCROW' | 'INVESTMENT'
    currency: string
    description?: string
    siteId?: number | null
}

import { serialize } from "@/lib/utils"

import { erpFetch } from "@/lib/erp-api"

export async function getFinancialAccounts() {
    try {
        const data = await erpFetch('accounts/?page_size=500')
        // TenantModelViewSet uses cursor pagination → {results: [...]}
        if (Array.isArray(data)) return data
        if (data?.results && Array.isArray(data.results)) return data.results
        return []
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
        // Source of truth: reference/org-currencies/ (same as /settings/regional)
        const data = await erpFetch('reference/org-currencies/')
        const list = Array.isArray(data) ? data : data?.results || []
        // Find the org's default currency
        const defaultCur = list.find((c: any) => c.is_default)
        if (defaultCur) {
            return defaultCur.currency_code || defaultCur.currency_data?.code || 'USD'
        }
        // Fallback: first enabled currency
        if (list.length > 0) {
            return list[0].currency_code || list[0].currency_data?.code || 'USD'
        }
        return 'USD'
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

export async function togglePosAccess(accountId: number, enabled: boolean) {
    try {
        await erpFetch(`accounts/${accountId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_pos_enabled: enabled })
        })
        revalidatePath('/finance/accounts')
        return { success: true }
    } catch (e: unknown) {
        console.error("Failed to toggle POS access:", e);
        throw e;
    }
}
export async function getChartOfAccounts() {
    return await erpFetch('finance/coa/');
}
export async function getAccountCategories() {
    const data = await erpFetch('finance/account-categories/?page_size=500');
    // TenantModelViewSet uses cursor pagination → {results: [...]}
    // Normalize to always return a flat array for the frontend
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    return [];
}
export async function createAccountCategory(data: unknown) {
    revalidatePath('/finance/account-categories');
    return await erpFetch('finance/account-categories/', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateAccountCategory(id: number, data: unknown) {
    revalidatePath('/finance/account-categories');
    return await erpFetch(`finance/account-categories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteAccountCategory(id: number) {
    revalidatePath('/finance/account-categories');
    return await erpFetch(`finance/account-categories/${id}/`, { method: 'DELETE' });
}
