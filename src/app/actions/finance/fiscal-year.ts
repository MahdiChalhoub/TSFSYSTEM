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

export type FiscalYearDTO = {
    id: number
    name: string
    startDate: string
    endDate: string
    status: 'OPEN' | 'CLOSED' | 'FINALIZED'
    isClosed: boolean
    isHardLocked: boolean
    closedAt: string | null
    // raw passthrough for fields the UI hasn't migrated yet
    [key: string]: unknown
}

/**
 * Single source of truth for converting a raw backend FiscalYear payload
 * into the camelCase shape the frontend uses. Keeps every caller consistent.
 */
function normalizeFiscalYear(year: Record<string, any>): FiscalYearDTO {
    const status: FiscalYearDTO['status'] =
        year.status ?? (year.is_hard_locked ? 'FINALIZED' : year.is_closed ? 'CLOSED' : 'OPEN')
    return {
        ...year,
        id: year.id,
        name: year.name,
        startDate: year.start_date,
        endDate: year.end_date,
        status,
        isClosed: status !== 'OPEN',
        isHardLocked: status === 'FINALIZED',
        closedAt: year.closed_at ?? null,
    }
}

export async function getFiscalYears(): Promise<FiscalYearDTO[]> {
    try {
        const data = await erpFetch('fiscal-years/')
        const years = Array.isArray(data) ? data : (data?.results || [])
        return years.map(normalizeFiscalYear)
    } catch (error) {
        console.error("Failed to fetch fiscal years:", error)
        return []
    }
}

/** @deprecated Picks the year with the latest end_date, which may not cover today. Use {@link getCurrentFiscalYear} for "active" year resolution. */
export async function getLatestFiscalYear(): Promise<FiscalYearDTO | null> {
    try {
        const raw = await erpFetch('fiscal-years/?limit=1&ordering=-end_date')
        const years = Array.isArray(raw) ? raw : (raw?.results || [])
        const year = years[0] || null
        return year ? normalizeFiscalYear(year) : null
    } catch (error) {
        console.error("Failed to fetch latest fiscal year:", error)
        return null
    }
}

/**
 * Returns the fiscal year covering today (today ∈ [start_date, end_date]),
 * or null if no year covers today. Use this — not getLatestFiscalYear — when
 * resolving the "active" year for posting.
 */
export async function getCurrentFiscalYear(): Promise<FiscalYearDTO | null> {
    try {
        const raw = await erpFetch('fiscal-years/current/')
        return raw ? normalizeFiscalYear(raw) : null
    } catch {
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

export async function createFiscalYear(config: FiscalYearConfig): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
        const result = await erpFetch('fiscal-years/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: config.name,
                start_date: config.startDate instanceof Date ? config.startDate.toISOString().split('T')[0] : config.startDate,
                end_date: config.endDate instanceof Date ? config.endDate.toISOString().split('T')[0] : config.endDate,
                frequency: config.frequency,
                period_status: config.defaultPeriodStatus,
                include_audit: config.includeAuditPeriod,
            })
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true, id: result.id }
    } catch (error: unknown) {
        console.error("Failed to create fiscal year:", error)
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
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
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
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

export async function closePeriod(periodId: number) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/close/`, { method: 'POST' })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function softLockPeriod(periodId: number) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/soft-lock/`, { method: 'POST' })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function hardLockPeriod(periodId: number) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/hard-lock/`, { method: 'POST' })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function reopenPeriod(periodId: number) {
    try {
        await erpFetch(`fiscal-periods/${periodId}/reopen/`, { method: 'POST' })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function requestReopenPeriod(periodId: number, reason: string) {
    try {
        const res = await erpFetch(`fiscal-periods/${periodId}/request-reopen/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        })
        return { success: true, tasksCreated: res?.tasks_created ?? 0 }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
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
export type CanaryReport = {
    ran_at: string
    orgs_total: number
    orgs_clean: number
    orgs_drifted: number
    details: Array<{
        org_id: string
        org_slug: string | null
        safe: boolean
        years_drift: number
        years_missing_je: number
        first_broken_year: string | null
        parent_purity_clean: boolean
        parent_offender_count: number
        parent_offenders_top?: Array<Record<string, string>>
        subledger_clean: boolean
        subledger_offender_count: number
        subledger_offenders_top?: Array<Record<string, string>>
        snapshot_chain_clean: boolean
        snapshot_chain_rows: number
        snapshot_chain_breaks: number
        snapshot_chain_breaks_top?: Array<Record<string, string>>
        balance_integrity_clean: boolean
        balance_integrity_drifted_accounts: number
        balance_integrity_rows: number
        balance_integrity_drifts_top?: Array<Record<string, string>>
        // FX integrity
        fx_integrity_clean?: boolean
        fx_stale_rate_lines?: number
        fx_missing_revaluations?: number
        fx_orphaned_revaluations?: number
        // Revenue recognition
        revenue_recognition_clean?: boolean
        revenue_overdue_rows?: number
        revenue_orphan_obligations?: number
        revenue_over_recognised?: number
        // Consolidation
        consolidation_clean?: boolean
        consolidation_failed_runs?: number
        consolidation_missing_ic?: number
        consolidation_missing_runs?: number
        // Close checklist
        close_checklist_clean?: boolean
        close_checklist_abandoned?: number
        close_checklist_overdue?: number
        // Realized FX
        realized_fx_clean?: boolean
        realized_fx_missing?: number
        // Tax coverage
        tax_coverage_clean?: boolean
        tax_uncovered_countries?: number
        tax_uncovered_top?: string[]
    }>
}

export type CloseChecklistItem = {
    state_id: number
    item_id: number
    order: number
    name: string
    category: string
    is_required: boolean
    is_complete: boolean
    auto_checked: boolean
    completed_at: string | null
    completed_by: string | null
    notes: string
    auto_check_signal: string
}

export type CloseChecklistReport = {
    run_id: number
    status: 'OPEN' | 'READY' | 'CLOSED' | 'CANCELLED'
    template_name: string
    ready_to_close: boolean
    total_items: number
    completed_items: number
    required_missing: number
    items: CloseChecklistItem[]
}

export async function getCloseChecklist(fiscalYearId: number): Promise<CloseChecklistReport | null> {
    try {
        return await erpFetch(`fiscal-years/${fiscalYearId}/close-checklist/`) as CloseChecklistReport
    } catch (error) {
        console.error('Failed to fetch close checklist:', error)
        return null
    }
}

export async function toggleCloseChecklistItem(
    fiscalYearId: number,
    stateId: number,
    complete: boolean,
    notes?: string,
): Promise<{ success: boolean; ready_to_close?: boolean; run_status?: string; error?: string }> {
    try {
        const res = await erpFetch(`fiscal-years/${fiscalYearId}/close-checklist/toggle/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state_id: stateId, complete, notes }),
        }) as { ready_to_close: boolean; run_status: string }
        revalidatePath('/finance/fiscal-years')
        return { success: true, ready_to_close: res.ready_to_close, run_status: res.run_status }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function addCloseChecklistItem(
    fiscalYearId: number,
    name: string,
    category: string = 'OTHER',
    isRequired: boolean = false,
): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`fiscal-years/${fiscalYearId}/close-checklist/add-item/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, is_required: isRequired }),
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function deleteCloseChecklistItem(
    fiscalYearId: number,
    stateId: number,
): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`fiscal-years/${fiscalYearId}/close-checklist/delete-item/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state_id: stateId }),
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export type YoyDelta = {
    current: string
    prior: string
    delta: string
    pct: number | null
}

export type YoyReport = {
    current_year: { id: number; name: string; start: string; end: string }
    prior_year: { id: number; name: string; start: string; end: string } | null
    pnl: { revenue: YoyDelta; expenses: YoyDelta; net_income: YoyDelta }
    balance_sheet: { assets: YoyDelta; liabilities: YoyDelta; equity: YoyDelta }
    accounts: Array<{
        account_id: number; code: string; name: string; type: string;
        current: string; prior: string; delta: string; pct: number | null;
    }>
}

export async function getYoyComparison(yearId: number): Promise<YoyReport | null> {
    try {
        return await erpFetch(`fiscal-years/${yearId}/yoy-comparison/`) as YoyReport
    } catch (error) {
        console.error('Failed to fetch YoY comparison:', error)
        return null
    }
}

export type MultiYearReport = {
    years: Array<{ id: number; name: string; start: string; end: string }>
    rollups: Array<{ section: 'pnl' | 'balance_sheet' | string; label: string; values: string[] }>
    per_account: Array<{
        account_id: number; code: string; name: string; type: string;
        section: 'pnl' | 'balance_sheet' | 'other';
        values: string[];
    }>
}

export async function getMultiYearComparison(years: number = 3): Promise<MultiYearReport | null> {
    try {
        return await erpFetch(`fiscal-years/multi-year-comparison/?years=${years}`) as MultiYearReport
    } catch (error) {
        console.error('Failed to fetch multi-year comparison:', error)
        return null
    }
}

export type SnapshotChainRow = {
    kind: 'year' | 'period'
    id: number
    label: string
    scope: string
    captured_at: string | null
    content_hash: string | null
    prev_hash: string | null
    status: 'intact' | 'content_drift' | 'chain_break'
    recomputed_hash?: string
    expected_prev?: string | null
}

export type SnapshotChainReport = {
    rows_checked: number
    breaks: number
    clean: boolean
    chain: SnapshotChainRow[]
}

export async function getSnapshotChain(): Promise<SnapshotChainReport | null> {
    try {
        return await erpFetch('fiscal-years/snapshot-chain/') as SnapshotChainReport
    } catch (error) {
        console.error('Failed to fetch snapshot chain:', error)
        return null
    }
}

export type PPALineInput = {
    account_id: number
    debit: string | number
    credit: string | number
    description?: string
}

export type PPAResult = {
    journal_entry_id: number | null
    journal_entry_reference?: string
    lines: Array<{
        account_id: number
        debit: string
        credit: string
        description: string
    }>
    redirected_count: number
    target_fiscal_year: string
    total_debit: string
    total_credit: string
    dry_run: boolean
}

export async function previewPriorPeriodAdjustment(
    yearId: number,
    lines: PPALineInput[],
    reason: string,
    currentPeriodId?: number,
): Promise<
    | { success: true; preview: PPAResult }
    | { success: false; error: string }
> {
    try {
        const res = await erpFetch(`fiscal-years/${yearId}/prior-period-adjustment/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lines, reason, dry_run: true,
                current_period_id: currentPeriodId,
            }),
        }) as PPAResult
        return { success: true, preview: res }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function postPriorPeriodAdjustment(
    yearId: number,
    lines: PPALineInput[],
    reason: string,
    currentPeriodId?: number,
): Promise<
    | { success: true; result: PPAResult }
    | { success: false; error: string }
> {
    try {
        const res = await erpFetch(`fiscal-years/${yearId}/prior-period-adjustment/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lines, reason, dry_run: false,
                current_period_id: currentPeriodId,
            }),
        }) as PPAResult
        revalidatePath('/finance/fiscal-years')
        return { success: true, result: res }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export type PPAHistoryRow = {
    id: number
    reference: string | null
    transaction_date: string | null
    description: string
    created_by: string | null
    line_count: number
}

export async function listPriorPeriodAdjustments(yearId: number): Promise<PPAHistoryRow[]> {
    try {
        return await erpFetch(`fiscal-years/${yearId}/prior-period-adjustments/`) as PPAHistoryRow[]
    } catch (error) {
        console.error('Failed to list PPAs:', error)
        return []
    }
}

export async function getIntegrityCanary(): Promise<CanaryReport | null> {
    try {
        return await erpFetch('fiscal-years/integrity-canary/') as CanaryReport
    } catch (error) {
        console.error('Failed to fetch integrity canary:', error)
        return null
    }
}

export async function lockFiscalYear(id: number) {
    try {
        await erpFetch(`fiscal-years/${id}/lock/`, {
            method: 'POST'
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
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
export type DryRunClosePreview = {
    dry_run: boolean
    fiscal_year_id: number
    fiscal_year_name: string
    closing_jes: Array<{
        scope: string
        lines: number
        total_debit: string
        total_credit: string
        pnl_net?: string
    }>
    opening_jes: Array<{
        scope: string
        target_year: string
        lines: number
        total_debit: string
        total_credit: string
    }>
    messages: string[]
    invariants_passed: boolean
    snapshot_captured: boolean
    final_status?: string
}

export async function previewCloseFiscalYear(id: number, closeDate?: string): Promise<
    | { success: true; preview: DryRunClosePreview }
    | { success: false; error: string }
> {
    try {
        const res = await erpFetch(`fiscal-years/${id}/finalize/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dry_run: true, close_date: closeDate }),
        }) as { preview: DryRunClosePreview }
        return { success: true, preview: res.preview }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}

export async function hardLockFiscalYear(id: number, closeDate?: string) {
    try {
        // Uses /finalize/ — explicit alias for year-end close.
        await erpFetch(`fiscal-years/${id}/finalize/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(closeDate ? { close_date: closeDate } : {}),
        })
        revalidatePath('/finance/fiscal-years')
        return { success: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
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
    closing_entry: { id: number; reference: string; date: string; description: string; lines: { code: string; name: string; debit: number; credit: number }[] } | null
    opening_balances: { code: string; name: string; type: string; debit: number; credit: number }[]
    opening_balances_target: string | null
    opening_balances_received: { code: string; name: string; type: string; debit: number; credit: number }[]
    // Traceability — the SYSTEM_OPENING JE(s) that produced the lines
    // above. One entry per scope (OFFICIAL / INTERNAL).
    opening_entries: { id: number; reference: string; scope: string; transaction_date: string | null; line_count: number; total_debit: number; total_credit: number }[]
    opening_entries_received: { id: number; reference: string; scope: string; transaction_date: string | null; line_count: number; total_debit: number; total_credit: number }[]
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
