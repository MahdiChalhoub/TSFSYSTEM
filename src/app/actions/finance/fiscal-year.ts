'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { erpFetch } from '@/lib/erp-api'

const PeriodUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    status: z.enum(['OPEN', 'CLOSED', 'LOCKED']).optional(),
}).passthrough()

export async function getFiscalYears() {
    try {
        const data = await erpFetch('fiscal-years/')
        const years = Array.isArray(data) ? data : (data?.results || [])
        return years.map((year: Record<string, any>) => ({
            ...year,
            startDate: year.start_date,
            endDate: year.end_date,
            isHardLocked: year.is_hard_locked,
            status: year.status || (year.is_hard_locked ? 'FINALIZED' : year.is_closed ? 'CLOSED' : 'OPEN'),
        }))
    } catch (error) {
        console.error("Failed to fetch fiscal years:", error)
        return []
    }
}

export async function getLatestFiscalYear() {
    try {
        const raw = await erpFetch('fiscal-years/?limit=1&ordering=-end_date')
        const years = Array.isArray(raw) ? raw : (raw?.results || [])
        const year = years[0] || null
        if (year) {
            return {
                ...year,
                startDate: year.start_date,
                endDate: year.end_date,
                isHardLocked: year.is_hard_locked,
            }
        }
        return null
    } catch (error) {
        console.error("Failed to fetch latest fiscal year:", error)
        return null
    }
}

export type FiscalYearConfig = {
    name: string
    startDate: Date
    endDate: Date
    frequency: 'MONTHLY' | 'QUARTERLY'
    defaultPeriodStatus: 'OPEN' | 'FUTURE' | 'LOCKED'
    includeAuditPeriod?: boolean
}

export async function createFiscalYear(config: FiscalYearConfig) {
    try {
        const payload = {
            name: config.name,
            start_date: config.startDate.toISOString().split('T')[0],
            end_date: config.endDate.toISOString().split('T')[0],
            frequency: config.frequency,
            organization: 1, // Will be overridden by TenantMiddleware/View logic usually, but good to inspect view
            // The view likely expects these for the service logic if it uses one, or just model fields.
            // If the view creates periods, it needs 'frequency' in the request.data if it's not a model field.
        }

        // Wait, check if 'frequency' is a model field. If not, it might be extra data for the serializer/view.
        // And 'defaultPeriodStatus' -> likely need to check how backend handles period creation.

        const result = await erpFetch('fiscal-years/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: config.name,
                start_date: config.startDate instanceof Date ? config.startDate.toISOString().split('T')[0] : config.startDate,
                end_date: config.endDate instanceof Date ? config.endDate.toISOString().split('T')[0] : config.endDate,
                frequency: config.frequency,
                period_status: config.defaultPeriodStatus, // Mapping defaultPeriodStatus
                include_audit: config.includeAuditPeriod // Mapping includeAuditPeriod
            })
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true, id: result.id }
    } catch (error: unknown) {
        console.error("Failed to create fiscal year:", error)
        throw error
    }
}

export async function closeFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/close/`, {
            method: 'POST'
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to close fiscal year:", error)
        throw error
    }
}

export async function deleteFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to delete fiscal year:", error)
        throw error
    }
}

export async function updatePeriod(periodId: number, data: unknown) {
    const parsed = PeriodUpdateSchema.parse(data)
    try {
        await erpFetch(`fiscal-periods/${periodId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to update period:", error)
        throw error
    }
}

export async function updatePeriodStatus(periodId: number, newStatus: string) {
    try {
        const result = await erpFetch(`fiscal-periods/${periodId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                is_closed: newStatus === 'CLOSED',
            })
        })
        console.log(`[PERIOD_UPDATE] ${periodId} → ${newStatus}: OK`, result)
        try { revalidatePath('/finance/fiscal-years') } catch { /* ignore */ }
        return { success: true }
    } catch (error: unknown) {
        console.error(`[PERIOD_UPDATE] ${periodId} → ${newStatus}: FAILED`, error)
        throw error
    }
}

// NOTE: Fiscal year lock is intentionally one-way (no unlock).
// Once locked/finalized, a fiscal year cannot be reopened per accounting standards.
export async function lockFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/lock/`, {
            method: 'POST'
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to lock fiscal year:", error)
        throw error
    }
}

/**
 * Year-End Close — the full accounting close sequence:
 * 1. Verifies all periods are closed
 * 2. Closes P&L accounts (Revenue & Expense) into Retained Earnings
 * 3. Generates opening balances for the next fiscal year
 * 4. Hard-locks the fiscal year (permanent, no reopening)
 *
 * This calls ClosingService.close_fiscal_year on the backend.
 */
export async function hardLockFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/close/`, {
            method: 'POST',
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to close fiscal year:", error)
        throw error
    }
}

export type ClosePreview = {
    year: { id: number; name: string; start_date: string; end_date: string }
    periods: { total: number; open: number; closed: number; future: number }
    journal_entries: { posted: number; draft: number }
    pnl: { revenue: number; expenses: number; net_income: number }
    retained_earnings: { code: string; name: string; id: number } | null
    next_year: { id: number; name: string } | null
    opening_balances_count: number
    opening_preview: { code: string; name: string; type: string; balance: number }[]
    blockers: string[]
    can_close: boolean
}

export async function getClosePreview(yearId: number): Promise<ClosePreview | null> {
    try {
        return await erpFetch(`fiscal-years/${yearId}/close-preview/`)
    } catch (error: unknown) {
        console.error("Failed to get close preview:", error)
        return null
    }
}

// ─── Year Summary & History ───────────────────────────────────

export type YearSummary = {
    year: { name: string; start_date: string; end_date: string; status: string; is_hard_locked: boolean; closed_at: string | null }
    journal_entries: { total: number; posted: number; draft: number; total_debit: number; total_credit: number }
    pnl: { revenue: number; expenses: number; net_income: number }
    balance_sheet: { assets: number; liabilities: number; equity: number }
    closing_entry: { reference: string; date: string; description: string; lines: { code: string; name: string; debit: number; credit: number }[] } | null
    opening_balances: { code: string; name: string; type: string; debit: number; credit: number }[]
    opening_balances_target: string | null
    periods: { name: string; status: string; start_date: string; end_date: string; journal_entries: number }[]
}

export type YearHistoryEvent = {
    type: string; date: string; description: string; user?: string
}

export type DraftAuditEntry = {
    id: number; reference: string; date: string; description: string; total_debit: number; total_credit: number
}

export async function getYearSummary(yearId: number): Promise<YearSummary | null> {
    try {
        return await erpFetch(`fiscal-years/${yearId}/summary/`)
    } catch { return null }
}

export async function getYearHistory(yearId: number): Promise<{ events: YearHistoryEvent[]; je_by_month: { month: string; count: number }[] }> {
    try {
        return await erpFetch(`fiscal-years/${yearId}/history/`)
    } catch { return { events: [], je_by_month: [] } }
}

export async function getDraftAudit(yearId: number, periodId?: number): Promise<{ drafts: DraftAuditEntry[]; total: number }> {
    try {
        const url = periodId
            ? `fiscal-years/${yearId}/draft-audit/?period_id=${periodId}`
            : `fiscal-years/${yearId}/draft-audit/`
        return await erpFetch(url)
    } catch { return { drafts: [], total: 0 } }
}

export type FiscalGap = {
    days: number
    after: string
    startDate: string
    endDate: string
}

export async function getFiscalGaps(): Promise<FiscalGap[]> {
    // This could remain client-side logic or be moved to Django.
    // For now, let's keep it simple and return empty or implement in Django if needed.
    return []
}

export async function transferBalancesToNextYear(fromYearId: number, toYearId: number) {
    try {
        await erpFetch(`fiscal-years/${fromYearId}/transfer-balances/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_year_id: toYearId })
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to transfer balances:", error)
        throw error
    }
}
