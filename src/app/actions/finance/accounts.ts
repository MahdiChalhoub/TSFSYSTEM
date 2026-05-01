'use server'

import { erpFetch, ErpApiError } from "@/lib/erp-api"
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { serialize } from '@/lib/utils'
import { z } from 'zod'

const FinancialAccountSchema = z.object({
    name: z.string().min(1, 'Account name is required'),
    type: z.string().min(1, 'Account type is required'),
    siteId: z.number().int().positive().optional(),
    currency: z.string().default('USD'),
})

const CoaAccountSchema = z.object({
    code: z.string().min(1, 'Account code is required'),
    name: z.string().min(1, 'Account name is required'),
    type: z.string().min(1, 'Account type is required'),
    subType: z.string().optional(),
    parentId: z.number().int().positive().nullable().optional(),
    syscohadaCode: z.string().optional(),
    syscohadaClass: z.string().optional(),
    isActive: z.boolean().optional(),
    isInternal: z.boolean().optional(),
    // Multi-currency / revaluation controls. The classification drives which
    // rate the period-end revaluation uses (closing/average/historical).
    currency: z.string().optional(),
    revaluationRequired: z.boolean().optional(),
    monetaryClassification: z.enum(['MONETARY', 'NON_MONETARY', 'INCOME_EXPENSE']).optional(),
}).passthrough()

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export async function getChartOfAccounts(includeInactive: boolean = false, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const query = new URLSearchParams({
            scope,
            include_inactive: includeInactive.toString()
        }).toString()
        // no-store: the scope toggle must reflect immediately. The default 30s
        // revalidate window would let a stale OFFICIAL response stick around
        // after the user flips to INTERNAL, making the toggle look broken.
        const result = await erpFetch(`coa/coa/?${query}`, { cache: 'no-store' })
        return serialize(result.map((acc: Record<string, any>) => ({
            ...acc,
            balance: Number(acc.rollup_balance ?? 0),
            directBalance: Number(acc.temp_balance ?? 0)
        })))
    } catch (error) {
        // Auth failure = stale/expired token. Force re-auth instead of
        // silently rendering an empty page (which looks like "no COA data"
        // and hides the real cause).
        if (error instanceof ErpApiError && (error.status === 401 || error.status === 403)) {
            redirect('/login?error=session_expired')
        }
        console.error("Failed to fetch COA:", error)
        return []
    }
}

export async function getInactiveAccounts() {
    return getChartOfAccounts(true)
}

export async function createFinancialAccount(data: unknown) {
    const parsed = FinancialAccountSchema.parse(data)
    try {
        const result = await erpFetch('accounts/', {
            method: 'POST',
            body: JSON.stringify({
                name: parsed.name,
                type: parsed.type,
                site_id: parsed.siteId,
                currency: parsed.currency
            })
        })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, result }
    } catch (error) {
        console.error("Failed to create financial account:", error)
        throw error
    }
}

export async function createAccount(data: unknown) {
    const parsed = CoaAccountSchema.parse(data)
    try {
        const result = await erpFetch('coa/', {
            method: 'POST',
            body: JSON.stringify({
                code: parsed.code,
                name: parsed.name,
                type: parsed.type,
                sub_type: parsed.subType,
                parent: parsed.parentId,
                syscohada_code: parsed.syscohadaCode,
                syscohada_class: parsed.syscohadaClass,
                is_internal: parsed.isInternal ?? false,
                currency: parsed.currency,
                revaluation_required: parsed.revaluationRequired ?? false,
                monetary_classification: parsed.monetaryClassification ?? 'MONETARY',
            })
        })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, result }
    } catch (error) {
        console.error("Failed to create COA account:", error)
        throw error
    }
}

export async function updateChartOfAccount(id: number, data: unknown) {
    const parsed = CoaAccountSchema.partial().parse(data)
    try {
        const result = await erpFetch(`coa/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({
                code: parsed.code,
                name: parsed.name,
                type: parsed.type,
                sub_type: parsed.subType,
                parent: parsed.parentId,
                syscohada_code: parsed.syscohadaCode,
                syscohada_class: parsed.syscohadaClass,
                is_active: parsed.isActive,
                is_internal: parsed.isInternal,
                currency: parsed.currency,
                revaluation_required: parsed.revaluationRequired,
                monetary_classification: parsed.monetaryClassification,
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
                balance: Number(result.account.balance ?? 0)
            },
            openingBalance: Number(result.opening_balance ?? 0),
            lines: result.lines.map((l: Record<string, any>) => ({
                ...l,
                debit: Number(l.debit ?? 0),
                credit: Number(l.credit ?? 0)
            }))
        })
    } catch (error) {
        console.error("Failed to fetch statement:", error)
        throw error
    }
}

export async function getTrialBalanceReport(
    asOfDate?: Date | null,
    fyStartDate?: Date | null,
    scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL',
) {
    try {
        // Send *local* YYYY-MM-DD dates so the backend treats them as
        // business days (and upgrades as_of to end-of-day). Sending UTC
        // ISO strings instead would silently drop the last ~24h of
        // postings for users east of UTC.
        const toLocalIso = (d: Date) => {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${y}-${m}-${day}`
        }
        const params: Record<string, string> = { scope }
        if (asOfDate) params.as_of = toLocalIso(asOfDate)
        if (fyStartDate) params.fy_start_date = toLocalIso(fyStartDate)
        const query = new URLSearchParams(params).toString()

        const result = await erpFetch(`coa/trial_balance/?${query}`)
        return serialize(result.map((acc: Record<string, any>) => ({
            ...acc,
            // Backend returns parent_id (snake_case); viewers expect parentId
            // (matches the COA endpoint convention). Without this remap the
            // root-only filter `!a.parentId` matched every account, parents
            // double-counted children, and Σ DR ≠ Σ CR.
            parentId: acc.parent_id ?? acc.parentId ?? null,
            balance: Number(acc.rollup_balance ?? 0),
            directBalance: Number(acc.temp_balance ?? 0),
            // Opening / movement split (non-zero only when fyStartDate is set)
            opening: Number(acc.rollup_opening ?? 0),
            movement: Number(acc.rollup_movement ?? 0),
            directOpening: Number(acc.temp_opening ?? 0),
            directMovement: Number(acc.temp_movement ?? 0),
        })))
    } catch (error) {
        console.error("Failed to fetch trial balance:", error)
        return []
    }
}

export async function getProfitAndLossReport(startDate: Date, endDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        // Pass date range to backend so it returns period-specific balances
        const query = new URLSearchParams({
            scope,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
        }).toString()
        const result = await erpFetch(`coa/trial_balance/?${query}`)
        return serialize(
            result
                .filter((acc: Record<string, any>) => acc.type === 'INCOME' || acc.type === 'EXPENSE')
                .map((acc: Record<string, any>) => ({
                    ...acc,
                    parentId: acc.parent_id ?? acc.parentId ?? null,
                    balance: Number(acc.rollup_balance ?? 0),
                    directBalance: Number(acc.temp_balance ?? 0)
                }))
        )
    } catch (error) {
        console.error("Failed to fetch P&L report:", error)
        return []
    }
}

export async function getBalanceSheetReport(asOfDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    try {
        const query = new URLSearchParams({
            scope,
            as_of: asOfDate.toISOString()
        }).toString()
        const result = await erpFetch(`coa/trial_balance/?${query}`)
        const mapped = result.map((acc: Record<string, any>) => ({
            ...acc,
            parentId: acc.parent_id ?? acc.parentId ?? null,
            balance: Number(acc.rollup_balance ?? 0),
            directBalance: Number(acc.temp_balance ?? 0)
        }))

        // Net Profit = Total Income - Total Expense
        // Root-level accounts only (rollup_balance already aggregates children).
        // Use parentId, not the legacy `parent` field which the API doesn't return.
        const totalIncome = mapped
            .filter((a: Record<string, any>) => a.type === 'INCOME' && !a.parentId)
            .reduce((sum: number, a: Record<string, any>) => sum + a.balance, 0)
        const totalExpense = mapped
            .filter((a: Record<string, any>) => a.type === 'EXPENSE' && !a.parentId)
            .reduce((sum: number, a: Record<string, any>) => sum + a.balance, 0)

        return serialize({
            accounts: mapped.filter((a: Record<string, any>) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)),
            netProfit: totalIncome - totalExpense
        })
    } catch (error) {
        console.error("Failed to fetch balance sheet:", error)
        return { accounts: [], netProfit: 0 }
    }
}

/** POST /coa/bulk-classify/ — apply IAS 21/ASC 830 defaults to all accounts (smart),
 *  or apply explicit classification to a list of ids. */
export async function bulkClassifyAccounts(payload:
    | { scope: 'smart' }
    | { ids: number[]; classification: 'MONETARY' | 'NON_MONETARY' | 'INCOME_EXPENSE'; revaluationRequired?: boolean }
): Promise<{ success: boolean; updated?: number; skipped?: number; details?: any[]; error?: string }> {
    try {
        const body = 'scope' in payload
            ? { scope: 'smart' }
            : {
                ids: payload.ids,
                classification: payload.classification,
                revaluation_required: payload.revaluationRequired,
            }
        const r = await erpFetch('coa/bulk-classify/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }) as { updated: number; skipped: number; details: any[] }
        revalidatePath('/finance/chart-of-accounts')
        return { success: true, ...r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function reactivateChartOfAccount(id: number) {
    return updateChartOfAccount(id, { isActive: true })
}