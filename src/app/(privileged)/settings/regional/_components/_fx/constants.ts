/**
 * FX Management — shared constants & types
 * ----------------------------------------
 * Extracted from FxRedesigned.tsx so child sub-modules can import them
 * without a circular dep. Keep this file pure data + types — no React.
 */
import type { ExchangeRate, CurrencyRatePolicy } from '@/app/actions/finance/currency'

export type FxView = 'rates' | 'policies' | 'revaluations'

export const RATE_TYPES: ExchangeRate['rate_type'][] = ['SPOT', 'AVERAGE', 'CLOSING', 'BUDGET']

export const PROVIDER_META: Record<CurrencyRatePolicy['provider'], { label: string; tone: string; needsKey: boolean }> = {
    MANUAL:            { label: 'Manual',             tone: '--app-muted-foreground', needsKey: false },
    ECB:               { label: 'ECB',                tone: '--app-success',          needsKey: false },
    FRANKFURTER:       { label: 'Frankfurter',        tone: '--app-success',          needsKey: false },
    EXCHANGERATE_HOST: { label: 'exchangerate.host',  tone: '--app-info',             needsKey: true  },
    FIXER:             { label: 'Fixer.io',           tone: '--app-info',             needsKey: true  },
    OPENEXCHANGERATES: { label: 'OpenExchangeRates',  tone: '--app-info',             needsKey: true  },
}

export const FREQ_LABEL: Record<CurrencyRatePolicy['sync_frequency'], string> = {
    ON_TRANSACTION: 'Per transaction',
    DAILY: 'Every day',
    WEEKLY: 'Every week',
    MONTHLY: 'Every month',
}

export const HEALTH = {
    fresh:  { tone: '--app-success', label: 'Healthy — synced in the last 36h' },
    stale:  { tone: '--app-warning', label: 'Stale — last sync was over 36h ago' },
    fail:   { tone: '--app-error',   label: 'Failing — last attempt errored' },
    never:  { tone: '--app-muted-foreground', label: 'Never synced' },
    manual: { tone: '--app-info',    label: 'Manual provider — does not auto-sync' },
} as const
export type HealthKey = keyof typeof HEALTH
