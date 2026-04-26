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

export async function getCurrencies(): Promise<Currency[]> {
    try {
        const r = await erpFetch('currencies/', { cache: 'no-store' })
        return Array.isArray(r) ? r : (r?.results ?? [])
    } catch (e) {
        console.error('getCurrencies failed:', e)
        return []
    }
}

export async function createCurrency(
    payload: Pick<Currency, 'code' | 'name' | 'symbol' | 'decimal_places' | 'is_base' | 'is_active'>
): Promise<{ success: boolean; data?: Currency; error?: string }> {
    try {
        const data = await erpFetch('currencies/', {
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
        await erpFetch(`currencies/${id}/`, {
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

export async function getExchangeRates(opts: { fromCode?: string; rateType?: string } = {}): Promise<ExchangeRate[]> {
    try {
        const q = new URLSearchParams()
        if (opts.fromCode) q.set('from_code', opts.fromCode)
        if (opts.rateType) q.set('rate_type', opts.rateType)
        const path = q.toString() ? `exchange-rates/?${q.toString()}` : 'exchange-rates/'
        const r = await erpFetch(path, { cache: 'no-store' })
        return Array.isArray(r) ? r : (r?.results ?? [])
    } catch (e) {
        console.error('getExchangeRates failed:', e)
        return []
    }
}

export async function createExchangeRate(payload: {
    from_currency: number
    to_currency: number
    rate: string
    rate_type: ExchangeRate['rate_type']
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

// ── Revaluations ─────────────────────────────────────────────────────────

export async function getRevaluations(periodId?: number): Promise<CurrencyRevaluation[]> {
    try {
        const path = periodId
            ? `currency-revaluations/?fiscal_period=${periodId}`
            : 'currency-revaluations/'
        const r = await erpFetch(path, { cache: 'no-store' })
        return Array.isArray(r) ? r : (r?.results ?? [])
    } catch (e) {
        console.error('getRevaluations failed:', e)
        return []
    }
}

// ── Rate policies (auto-sync + adjustment factor) ────────────────────────

export type CurrencyRatePolicy = {
    id: number
    from_currency: number
    from_code: string
    to_currency: number
    to_code: string
    rate_type: 'SPOT' | 'AVERAGE' | 'CLOSING'
    provider: 'MANUAL' | 'ECB' | 'FIXER' | 'OPENEXCHANGERATES'
    provider_config: Record<string, any>
    auto_sync: boolean
    multiplier: string
    markup_pct: string
    last_synced_at: string | null
    last_sync_status: 'OK' | 'FAIL' | 'SKIPPED' | null
    last_sync_error: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export async function getRatePolicies(): Promise<CurrencyRatePolicy[]> {
    try {
        const r = await erpFetch('currency-rate-policies/', { cache: 'no-store' })
        return Array.isArray(r) ? r : (r?.results ?? [])
    } catch (e) {
        console.error('getRatePolicies failed:', e)
        return []
    }
}

export async function createRatePolicy(payload: {
    from_currency: number
    to_currency: number
    rate_type: CurrencyRatePolicy['rate_type']
    provider: CurrencyRatePolicy['provider']
    auto_sync?: boolean
    multiplier?: string
    markup_pct?: string
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
