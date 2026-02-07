'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from 'next/cache'
import { serialize } from '@/lib/utils'

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export async function getChartOfAccounts(includeInactive: boolean = false, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const query = new URLSearchParams({
            scope,
            include_inactive: includeInactive.toString()
        }).toString()
        const result = await erpFetch(`coa/coa/?${query}`)
        return serialize(result.map((acc: any) => ({
            ...acc,
            balance: Number(acc.rollup_balance),
            directBalance: Number(acc.temp_balance)
        })))
    } catch (error) {
        console.error("Failed to fetch COA:", error)
        return []
    }
}

export async function getInactiveAccounts() {
    return getChartOfAccounts(true)
}

export async function createFinancialAccount(data: any) {
    try {
        const result = await erpFetch('accounts/', {
            method: 'POST',
            body: JSON.stringify({
                name: data.name,
                type: data.type,
                site_id: data.siteId,
                currency: data.currency || 'USD'
            })
        })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, result }
    } catch (error) {
        console.error("Failed to create financial account:", error)
        throw error
    }
}

export async function createAccount(data: any) {
    try {
        const result = await erpFetch('coa/', {
            method: 'POST',
            body: JSON.stringify({
                code: data.code,
                name: data.name,
                type: data.type,
                sub_type: data.subType,
                parent: data.parentId,
                syscohada_code: data.syscohadaCode,
                syscohada_class: data.syscohadaClass
            })
        })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, result }
    } catch (error) {
        console.error("Failed to create COA account:", error)
        throw error
    }
}

export async function updateChartOfAccount(id: number, data: any) {
    try {
        const result = await erpFetch(`coa/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({
                code: data.code,
                name: data.name,
                type: data.type,
                sub_type: data.subType,
                parent: data.parentId,
                syscohada_code: data.syscohadaCode,
                syscohada_class: data.syscohadaClass,
                is_active: data.isActive
            })
        })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, result }
    } catch (error) {
        console.error("Failed to update COA account:", error)
        throw error
    }
}

export async function getAccountStatement(accountId: number, filter?: { startDate?: Date, endDate?: Date }, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const query = new URLSearchParams({
            scope,
            start_date: filter?.startDate?.toISOString() || '',
            end_date: filter?.endDate?.toISOString() || ''
        }).toString()

        const result = await erpFetch(`coa/${accountId}/statement/?${query}`)
        return serialize({
            account: {
                ...result.account,
                balance: Number(result.account.balance)
            },
            openingBalance: Number(result.opening_balance),
            lines: result.lines.map((l: any) => ({
                ...l,
                debit: Number(l.debit),
                credit: Number(l.credit)
            }))
        })
    } catch (error) {
        console.error("Failed to fetch statement:", error)
        throw error
    }
}

export async function getTrialBalanceReport(asOfDate?: Date, legalReport: boolean = false, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const query = new URLSearchParams({
            scope,
            as_of: asOfDate?.toISOString() || ''
        }).toString()

        const result = await erpFetch(`coa/trial_balance/?${query}`)
        return serialize(result.map((acc: any) => ({
            ...acc,
            balance: Number(acc.rollup_balance),
            directBalance: Number(acc.temp_balance)
        })))
    } catch (error) {
        console.error("Failed to fetch trial balance:", error)
        return []
    }
}

export async function getProfitAndLossReport(startDate: Date, endDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // This needs a separate endpoint in Django too.
    // For now, I'll return empty if not implemented yet, or use erpFetch if I added it.
    // I didn't add P&L to services.py yet. 
    // Wait, let's just use TB for now or implement P&L in Django.
    return []
}

export async function getBalanceSheetReport(asOfDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // Also needs Django implementation.
    return { accounts: [], netProfit: 0 }
}

export async function reactivateChartOfAccount(id: number) {
    return updateChartOfAccount(id, { isActive: true })
}