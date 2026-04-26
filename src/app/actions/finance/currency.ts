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
