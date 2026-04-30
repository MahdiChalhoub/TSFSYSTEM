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
}

export type CurrencyRevaluation = {
    id: number
    fiscal_period: number
    period_name: string
    fiscal_year_name: string
    revaluation_date: string
    status: 'DRAFT' | 'POSTED' | 'REVERSED'
    scope: 'OFFICIAL' | 'INTERNAL'
    total_gain: string
    total_loss: string
    net_impact: string
    accounts_processed: number
    journal_entry: number | null
    je_reference: string | null
    created_at: string
    lines: CurrencyRevaluationLine[]
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

export async function runRevaluation(
    fiscalPeriodId: number,
    scope: 'OFFICIAL' | 'INTERNAL' = 'OFFICIAL',
): Promise<{ success: boolean; data?: CurrencyRevaluation | null; detail?: string; error?: string }> {
    try {
        const r = await erpFetch('currency-revaluations/run/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fiscal_period: fiscalPeriodId, scope }),
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
