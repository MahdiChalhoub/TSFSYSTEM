'use server'

import { revalidatePath } from 'next/cache'
import { erpFetch } from '@/lib/erp-api'

// ── Types ────────────────────────────────────────────────────────────────

export type Currency = {
    id: number
    code: string
    name: string
    symbol: string
    decimal_places: number
    is_base: boolean
    is_active: boolean
}

export type ExchangeRate = {
    id: number
    from_currency: number
    from_code: string
    to_currency: number
    to_code: string
    rate: string
    rate_type: 'SPOT' | 'AVERAGE' | 'CLOSING' | 'BUDGET'
    /** MID = mid-market (default; what most accounting books posts against)
     *  BID = price the operator pays (operator buys foreign ccy from customer)
     *  ASK = price the operator charges (operator sells foreign ccy to customer) */
    rate_side: 'MID' | 'BID' | 'ASK'
    effective_date: string
    source: string | null
}

export type AccountClassification = 'MONETARY' | 'NON_MONETARY' | 'INCOME_EXPENSE'
export type RateTypeUsed = 'CLOSING' | 'AVERAGE' | 'SPOT' | 'HISTORICAL'

export type CurrencyRevaluationLine = {
    id: number
    account: number
    account_code: string
    account_name: string
    currency: number
    currency_code: string
    balance_in_currency: string
    old_rate: string
    new_rate: string
    old_base_amount: string
    new_base_amount: string
    difference: string
    rate_type_used: RateTypeUsed
    classification: AccountClassification
}

export type CurrencyRevaluation = {
    id: number
    fiscal_period: number
    period_name: string
    fiscal_year_name: string
    revaluation_date: string
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED' | 'REJECTED'
    scope: 'OFFICIAL' | 'INTERNAL'
    total_gain: string
    total_loss: string
    net_impact: string
    accounts_processed: number
    materiality_pct: string
    excluded_account_ids: number[]
    auto_reverse_at_period_start: boolean
    reversal_journal_entry: number | null
    reversal_je_reference: string | null
    approved_by: number | null
    approver_name: string | null
    approved_at: string | null
    rejection_reason: string
    journal_entry: number | null
    je_reference: string | null
    created_at: string
    lines: CurrencyRevaluationLine[]
}

/** Output of the preview endpoint — same shape as a draft reval but unsaved. */
export type RevaluationPreview = {
    lines: Array<{
        account_id: number
        account_code: string
        account_name: string
        currency_id: number
        currency_code: string
        classification: AccountClassification
        balance_in_currency: string
        old_rate: string
        new_rate: string
        old_base_amount: string
        new_base_amount: string
        difference: string
        rate_type_used: RateTypeUsed
    }>
    skipped: Array<{ account_id: number; code: string; currency: string; reason: string }>
    total_gain: string
    total_loss: string
    net_impact: string
    revalued_base_total: string
    materiality_pct: string
    materiality_threshold: string
    requires_approval: boolean
    excluded_account_ids: number[]
    accounts_processed: number
}

export type FxExposureReport = {
    as_of: string
    base_currency: string
    sensitivity_bands: string[]
    currencies: Array<{
        currency: string
        rate: string
        total_fc: string
        total_base: string
        sensitivity: Record<string, string>
        accounts: Array<{
            account_id: number
            code: string
            name: string
            classification: AccountClassification
            balance_fc: string
            balance_base: string
            rate: string
        }>
    }>
}

// ── Currencies ───────────────────────────────────────────────────────────

/** GET /finance/currencies/ — tenant-filtered finance.Currency rows (NOT the
 *  global /currencies/ catalog, which is the 150+ ISO list). Throws on
 *  failure so callers can surface a real error instead of silently
 *  rendering an empty UI. */
export async function getCurrencies(): Promise<Currency[]> {
    const r = await erpFetch('finance/currencies/', { cache: 'no-store' })
    return Array.isArray(r) ? r : (r?.results ?? [])
}

export async function createCurrency(
    payload: Pick<Currency, 'code' | 'name' | 'symbol' | 'decimal_places' | 'is_base' | 'is_active'>
): Promise<{ success: boolean; data?: Currency; error?: string }> {
    try {
        const data = await erpFetch('finance/currencies/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }) as Currency
        revalidatePath('/finance/currencies')
        return { success: true, data }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function updateCurrency(
    id: number, payload: Partial<Currency>
): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`finance/currencies/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/finance/currencies')
        return { success: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

// ── Exchange rates ───────────────────────────────────────────────────────

/** GET /exchange-rates/. Throws on failure — see getCurrencies. */
export async function getExchangeRates(opts: { fromCode?: string; rateType?: string } = {}): Promise<ExchangeRate[]> {
    const q = new URLSearchParams()
    if (opts.fromCode) q.set('from_code', opts.fromCode)
    if (opts.rateType) q.set('rate_type', opts.rateType)
    const path = q.toString() ? `exchange-rates/?${q.toString()}` : 'exchange-rates/'
    const r = await erpFetch(path, { cache: 'no-store' })
    return Array.isArray(r) ? r : (r?.results ?? [])
}

export async function createExchangeRate(payload: {
    from_currency: number
    to_currency: number
    rate: string
    rate_type: ExchangeRate['rate_type']
    /** MID = mid-market (default), BID/ASK = the buy/sell sides of a quote.
     *  Operators can enter all three sides for a single (date, pair, type) by
     *  calling this action three times — backend's unique-together includes
     *  rate_side. */
    rate_side?: 'MID' | 'BID' | 'ASK'
    effective_date: string
    source?: string
}): Promise<{ success: boolean; data?: ExchangeRate; error?: string }> {
    try {
        const data = await erpFetch('exchange-rates/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'MANUAL', ...payload }),
        }) as ExchangeRate
        revalidatePath('/finance/currencies')
        return { success: true, data }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function updateExchangeRate(
    id: number,
    payload: Partial<Pick<ExchangeRate, 'rate' | 'rate_type' | 'rate_side' | 'effective_date' | 'source'>>,
): Promise<{ success: boolean; data?: ExchangeRate; error?: string }> {
    try {
        const data = await erpFetch(`exchange-rates/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }) as ExchangeRate
        revalidatePath('/finance/currencies')
        return { success: true, data }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function deleteExchangeRate(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`exchange-rates/${id}/`, { method: 'DELETE' })
        revalidatePath('/finance/currencies')
        return { success: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

// ── Revaluations ─────────────────────────────────────────────────────────

/** GET /currency-revaluations/. Throws on failure — see getCurrencies. */
export async function getRevaluations(periodId?: number): Promise<CurrencyRevaluation[]> {
    const path = periodId
        ? `currency-revaluations/?fiscal_period=${periodId}`
        : 'currency-revaluations/'
    const r = await erpFetch(path, { cache: 'no-store' })
    return Array.isArray(r) ? r : (r?.results ?? [])
}

// ── Rate policies (auto-sync + adjustment factor) ────────────────────────

export type CurrencyRatePolicy = {
    id: number
    from_currency: number
    from_code: string
    to_currency: number
    to_code: string
    rate_type: 'SPOT' | 'AVERAGE' | 'CLOSING'
    provider: 'MANUAL' | 'ECB' | 'FRANKFURTER' | 'EXCHANGERATE_HOST' | 'FIXER' | 'OPENEXCHANGERATES'
    provider_config: Record<string, any>
    auto_sync: boolean
    /** How often the cron / on-demand engine refreshes this policy.
     *  ON_TRANSACTION = pulled the moment an FX-using transaction is about to
     *  post (real-time). DAILY/WEEKLY/MONTHLY = cron honours the cadence and
     *  skips runs that are still fresh. */
    sync_frequency: 'ON_TRANSACTION' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
    multiplier: string
    markup_pct: string
    /** When non-zero, sync writes a triple (MID, BID, ASK) per (date, pair,
     *  rate_type). 0/0 keeps the prior single-MID-row behaviour. */
    bid_spread_pct: string
    ask_spread_pct: string
    last_synced_at: string | null
    last_sync_status: 'OK' | 'FAIL' | 'SKIPPED' | null
    last_sync_error: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

/** GET /currency-rate-policies/. Throws on failure — see getCurrencies. */
export async function getRatePolicies(): Promise<CurrencyRatePolicy[]> {
    const r = await erpFetch('currency-rate-policies/', { cache: 'no-store' })
    return Array.isArray(r) ? r : (r?.results ?? [])
}

export async function createRatePolicy(payload: {
    from_currency: number
    to_currency: number
    rate_type: CurrencyRatePolicy['rate_type']
    provider: CurrencyRatePolicy['provider']
    auto_sync?: boolean
    sync_frequency?: CurrencyRatePolicy['sync_frequency']
    multiplier?: string
    markup_pct?: string
    bid_spread_pct?: string
    ask_spread_pct?: string
    provider_config?: Record<string, any>
}): Promise<{ success: boolean; data?: CurrencyRatePolicy; error?: string }> {
    try {
        const data = await erpFetch('currency-rate-policies/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: true, multiplier: '1.000000', markup_pct: '0.0000', ...payload }),
        }) as CurrencyRatePolicy
        revalidatePath('/finance/currencies')
        return { success: true, data }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function updateRatePolicy(
    id: number, payload: Partial<CurrencyRatePolicy>,
): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`currency-rate-policies/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        revalidatePath('/finance/currencies')
        return { success: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function deleteRatePolicy(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch(`currency-rate-policies/${id}/`, { method: 'DELETE' })
        revalidatePath('/finance/currencies')
        return { success: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** Re-assign the broker for many policies in one shot.
 *  Scopes:
 *    - 'all'     → every active policy switches to `provider`.
 *    - 'include' → only policies whose from_code is in the list.
 *    - 'exclude' → every active policy except those in the list. */
export async function bulkUpdateRatePolicyProvider(payload: {
    provider: CurrencyRatePolicy['provider']
    provider_config?: Record<string, any>
    scope: 'all' | 'include' | 'exclude'
    from_currency_codes?: string[]
    /** When true (only meaningful for scope='include'), create a fresh policy
     *  for any code in `from_currency_codes` that has no policy yet. */
    create_if_missing?: boolean
    rate_type?: CurrencyRatePolicy['rate_type']
}): Promise<{
    success: boolean
    updated?: CurrencyRatePolicy[]
    created?: CurrencyRatePolicy[]
    count?: number
    error?: string
}> {
    try {
        const r = await erpFetch('currency-rate-policies/bulk-update-provider/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }) as { updated: CurrencyRatePolicy[]; created?: CurrencyRatePolicy[]; count: number }
        revalidatePath('/finance/currencies')
        return { success: true, updated: r.updated, created: r.created, count: r.count }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function bulkCreateRatePolicies(payload: {
    provider?: 'ECB' | 'MANUAL'
    rate_type?: CurrencyRatePolicy['rate_type']
    auto_sync?: boolean
    multiplier?: string
    markup_pct?: string
    from_currency_ids?: number[]
} = {}): Promise<{
    success: boolean
    created?: CurrencyRatePolicy[]
    skipped?: Array<{ from_code: string; reason: string }>
    count?: number
    error?: string
}> {
    try {
        const r = await erpFetch('currency-rate-policies/bulk-create/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }) as { created: CurrencyRatePolicy[]; skipped: Array<{ from_code: string; reason: string }>; count: number }
        revalidatePath('/finance/currencies')
        return { success: true, created: r.created, skipped: r.skipped, count: r.count }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function syncRatePolicy(id: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const r = await erpFetch(`currency-rate-policies/${id}/sync-now/`, {
            method: 'POST',
        }) as { ok: boolean; message: string }
        revalidatePath('/finance/currencies')
        return { success: r.ok, message: r.message }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function syncAllRatePolicies(): Promise<{ success: boolean; results?: Array<{ ok: boolean; message: string }>; error?: string }> {
    try {
        const r = await erpFetch('currency-rate-policies/sync-all/', {
            method: 'POST',
        }) as { results: Array<{ ok: boolean; message: string }>; count: number }
        revalidatePath('/finance/currencies')
        return { success: true, results: r.results }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** POST /currency-revaluations/preview/ — compute without writing. */
export async function previewRevaluation(payload: {
    fiscalPeriodId: number
    scope?: 'OFFICIAL' | 'INTERNAL'
    excludedAccountIds?: number[]
}): Promise<{ success: boolean; data?: RevaluationPreview; error?: string }> {
    try {
        const r = await erpFetch('currency-revaluations/preview/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fiscal_period: payload.fiscalPeriodId,
                scope: payload.scope ?? 'OFFICIAL',
                excluded_account_ids: payload.excludedAccountIds ?? [],
            }),
        }) as RevaluationPreview
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function runRevaluation(payload: {
    fiscalPeriodId: number
    scope?: 'OFFICIAL' | 'INTERNAL'
    excludedAccountIds?: number[]
    autoReverse?: boolean
    forcePost?: boolean
}): Promise<{ success: boolean; data?: CurrencyRevaluation | null; detail?: string; error?: string }> {
    try {
        const r = await erpFetch('currency-revaluations/run/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fiscal_period: payload.fiscalPeriodId,
                scope: payload.scope ?? 'OFFICIAL',
                excluded_account_ids: payload.excludedAccountIds ?? [],
                auto_reverse: payload.autoReverse ?? true,
                force_post: payload.forcePost ?? false,
            }),
        }) as CurrencyRevaluation | { detail: string; revaluation: null }
        revalidatePath('/finance/currencies')
        revalidatePath('/finance/fiscal-years')
        if ('revaluation' in r && r.revaluation === null) {
            return { success: true, data: null, detail: r.detail }
        }
        return { success: true, data: r as CurrencyRevaluation }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** POST /currency-revaluations/{id}/approve/ — flip PENDING_APPROVAL → POSTED. */
export async function approveRevaluation(id: number): Promise<{ success: boolean; data?: CurrencyRevaluation; error?: string }> {
    try {
        const r = await erpFetch(`currency-revaluations/${id}/approve/`, { method: 'POST' }) as CurrencyRevaluation
        revalidatePath('/finance/currencies')
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** POST /currency-revaluations/{id}/reject/ — flip PENDING_APPROVAL → REJECTED. */
export async function rejectRevaluation(id: number, reason: string): Promise<{ success: boolean; data?: CurrencyRevaluation; error?: string }> {
    try {
        const r = await erpFetch(`currency-revaluations/${id}/reject/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        }) as CurrencyRevaluation
        revalidatePath('/finance/currencies')
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** POST /currency-revaluations/{id}/reverse-at-next-period/ — auto-reverse on day 1 of next period. */
export async function reverseRevaluationAtNextPeriod(id: number): Promise<{ success: boolean; reversalJeId?: number | null; data?: CurrencyRevaluation; error?: string }> {
    try {
        const r = await erpFetch(`currency-revaluations/${id}/reverse-at-next-period/`, { method: 'POST' }) as {
            reversal_journal_entry_id: number | null
            revaluation: CurrencyRevaluation
        }
        revalidatePath('/finance/currencies')
        return { success: true, reversalJeId: r.reversal_journal_entry_id, data: r.revaluation }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** Per-period result row from a catchup run. Exactly one of `revaluation_id`,
 *  `skipped_reason`, or `error` is present. The last row may carry a `summary`. */
export type CatchupResult = {
    period_id: number
    period_name: string
    revaluation_id?: number
    status?: string
    skipped_reason?: string
    error?: string
    summary?: { run: number; skipped: number; errors: number; total: number }
}

/** POST /currency-revaluations/catchup/ — run revals for every unrevalued period through a target.
 *  Each period runs in its own atomic block; failures are recorded but do not
 *  roll back successful prior periods. Set `stopOnError=true` to bail on first failure. */
export async function catchupRevaluations(payload: {
    throughPeriodId: number
    scope?: 'OFFICIAL' | 'INTERNAL'
    autoReverse?: boolean
    forcePost?: boolean
    stopOnError?: boolean
}): Promise<{ success: boolean; results?: CatchupResult[]; error?: string }> {
    try {
        const r = await erpFetch('currency-revaluations/catchup/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                through_period: payload.throughPeriodId,
                scope: payload.scope ?? 'OFFICIAL',
                auto_reverse: payload.autoReverse ?? true,
                force_post: payload.forcePost ?? false,
                stop_on_error: payload.stopOnError ?? false,
            }),
        }) as { results: CatchupResult[] }
        revalidatePath('/finance/currencies')
        return { success: true, results: r.results }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** Realized-FX integrity report — flags PAID foreign-currency invoices
 *  that are missing a realized-FX adjustment JE. */
export type RealizedFxIntegrityReport = {
    clean: boolean
    missing_realized_fx: Array<{
        invoice_id: number
        currency: string
        amount: string
        booking_rate: string
    }>
}

/** GET /currency-revaluations/realized-fx-integrity/ */
export async function getRealizedFxIntegrity(): Promise<{
    success: boolean; data?: RealizedFxIntegrityReport; error?: string
}> {
    try {
        const r = await erpFetch('currency-revaluations/realized-fx-integrity/', { cache: 'no-store' }) as RealizedFxIntegrityReport
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export type FxSettings = {
    materiality_threshold_pct: string
}

/** GET /currency-revaluations/fx-settings/ */
export async function getFxSettings(): Promise<{ success: boolean; data?: FxSettings; error?: string }> {
    try {
        const r = await erpFetch('currency-revaluations/fx-settings/', { cache: 'no-store' }) as FxSettings
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** PATCH /currency-revaluations/fx-settings/ — body { materiality_threshold_pct }. */
export async function updateFxSettings(payload: { materialityThresholdPct: string | number }): Promise<{
    success: boolean; data?: FxSettings; error?: string
}> {
    try {
        const r = await erpFetch('currency-revaluations/fx-settings/', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materiality_threshold_pct: String(payload.materialityThresholdPct) }),
        }) as FxSettings
        revalidatePath('/finance/currencies')
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** GET /currency-revaluations/exposure/ — read-only FX exposure snapshot. */
export async function getFxExposure(opts: { asOf?: string; scope?: 'OFFICIAL' | 'INTERNAL' } = {}): Promise<{ success: boolean; data?: FxExposureReport; error?: string }> {
    try {
        const q = new URLSearchParams()
        if (opts.asOf) q.set('as_of', opts.asOf)
        if (opts.scope) q.set('scope', opts.scope)
        const path = q.toString() ? `currency-revaluations/exposure/?${q.toString()}` : 'currency-revaluations/exposure/'
        const r = await erpFetch(path, { cache: 'no-store' }) as FxExposureReport
        return { success: true, data: r }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}
